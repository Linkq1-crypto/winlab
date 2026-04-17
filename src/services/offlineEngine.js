/**
 * Offline Queue + Sync Engine
 * Event-based local-first architecture with eventual consistency
 *
 * Flow:
 * User action → save event locally → UI updates immediately → sync in background
 * If offline → queue persists → auto-replay when online
 */

// ──── IndexedDB Setup ────
const DB_NAME = 'winlab-offline';
const DB_VERSION = 1;
const STORE_EVENTS = 'events';
const STORE_QUEUE = 'offline-queue';

let _dbPromise;

function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Events store (all local actions)
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const eventStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        eventStore.createIndex('type', 'type', { unique: false });
        eventStore.createIndex('synced', 'synced', { unique: false });
      }

      // Offline queue (failed requests to retry)
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('retries', 'retries', { unique: false });
      }
    };
  });

  return _dbPromise;
}

// ──── Event Store ────

/**
 * Save an event locally
 * @param {object} event
 * @param {string} event.type - Event type (e.g. 'UPDATE_TICKET')
 * @param {object} event.payload - Event data
 * @param {string} [event.deviceId] - Device identifier
 * @returns {Promise<object>} Saved event
 */
export async function saveEvent(event) {
  const db = await openDB();

  const fullEvent = {
    id: event.id || `evt_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9)}`,
    type: event.type,
    payload: event.payload,
    deviceId: event.deviceId || getDeviceId(),
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.put(fullEvent);

    request.onsuccess = () => resolve(fullEvent);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get unsynced events
 * @returns {Promise<Array>}
 */
export async function getUnsyncedEvents() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_EVENTS);
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark event as synced
 * @param {string} eventId
 */
export async function markSynced(eventId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.get(eventId);

    request.onsuccess = () => {
      const event = request.result;
      if (event) {
        event.synced = true;
        store.put(event);
      }
      resolve(event);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all events (for debug/analysis)
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
export async function getAllEvents(limit = 100) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readonly');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.getAll();

    request.onsuccess = () => {
      const events = request.result
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
      resolve(events);
    };
    request.onerror = () => reject(request.error);
  });
}

// ──── Offline Queue ────

/**
 * Queue a failed request for offline replay
 * @param {object} action
 * @param {string} action.url - Request URL
 * @param {string} action.method - HTTP method
 * @param {object} [action.body] - Request body
 * @returns {Promise<object>}
 */
export async function queueAction(action) {
  const db = await openDB();

  const queuedAction = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    url: action.url,
    method: action.method || 'POST',
    body: action.body,
    timestamp: Date.now(),
    retries: 0,
    maxRetries: 5,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.put(queuedAction);

    request.onsuccess = () => resolve(queuedAction);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get queued actions
 * @returns {Promise<Array>}
 */
export async function getQueuedActions() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove queued action
 * @param {string} actionId
 */
export async function dequeueAction(actionId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.delete(actionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ──── Sync Engine ────

/**
 * Sync unsynced events to server
 * @param {object} [opts]
 * @param {Function} [opts.onProgress] - Progress callback (synced, total)
 * @param {Function} [opts.onConflict] - Conflict handler
 * @returns {Promise<object>} { synced: number, failed: number }
 */
export async function syncEvents(opts = {}) {
  const { onProgress, onConflict } = opts;

  const events = await getUnsyncedEvents();

  if (events.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    try {
      const response = await fetch('/api/helpdesk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        await markSynced(event.id);
        synced++;
      } else if (response.status === 409 && onConflict) {
        // Conflict detected
        const serverData = await response.json();
        const resolved = onConflict(event, serverData);

        if (resolved) {
          await markSynced(event.id);
          synced++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    onProgress?.(synced + failed, events.length);
  }

  return { synced, failed };
}

/**
 * Replay queued offline actions
 * @returns {Promise<object>} { replayed: number, failed: number }
 */
export async function replayQueuedActions() {
  const actions = await getQueuedActions();

  if (actions.length === 0) {
    return { replayed: 0, failed: 0 };
  }

  let replayed = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (response.ok) {
        await dequeueAction(action.id);
        replayed++;
      } else {
        // Increment retry count
        action.retries += 1;
        if (action.retries >= action.maxRetries) {
          await dequeueAction(action.id); // Remove after max retries
        } else {
          // Update retry count
          const db = await openDB();
          const tx = db.transaction(STORE_QUEUE, 'readwrite');
          tx.objectStore(STORE_QUEUE).put(action);
        }
        failed++;
      }
    } catch {
      action.retries += 1;
      if (action.retries >= action.maxRetries) {
        await dequeueAction(action.id);
      }
      failed++;
    }
  }

  return { replayed, failed };
}

// ──── Auto-sync Triggers ────

let _syncInterval;
let _syncing = false;

/**
 * Start automatic sync
 * @param {object} [opts]
 * @param {number} [opts.interval=10000] - Sync interval in ms
 * @param {Function} [opts.onProgress]
 * @param {Function} [opts.onConflict]
 */
export function startAutoSync(opts = {}) {
  if (_syncInterval) {
    clearInterval(_syncInterval);
  }

  const interval = opts.interval || 10000;

  _syncInterval = setInterval(async () => {
    if (_syncing || !navigator.onLine) return;

    _syncing = true;
    try {
      await syncEvents({ onProgress: opts.onProgress, onConflict: opts.onConflict });
      await replayQueuedActions();
    } catch (err) {
      console.error('[Sync] Auto-sync failed:', err.message);
    } finally {
      _syncing = false;
    }
  }, interval);

  // Immediate sync on start
  if (navigator.onLine) {
    syncEvents({ onProgress: opts.onProgress, onConflict: opts.onConflict });
  }
}

/**
 * Stop automatic sync
 */
export function stopAutoSync() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
}

// ──── Device ID ────
let _deviceId;

function getDeviceId() {
  if (_deviceId) return _deviceId;
  _deviceId = localStorage.getItem('deviceId');
  if (!_deviceId) {
    _deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', _deviceId);
  }
  return _deviceId;
}

// ──── Conflict Resolution (Last Write Wins) ────

/**
 * Default conflict resolver: last write wins
 * @param {object} localEvent
 * @param {object} serverData
 * @returns {boolean} true if local should win
 */
export function lastWriteWins(localEvent, serverData) {
  return localEvent.timestamp > serverData.timestamp;
}

/**
 * Merge progress: take the highest step
 * @param {object} localEvent
 * @param {object} serverData
 * @returns {object} Merged result
 */
export function mergeProgress(localEvent, serverData) {
  return {
    ...localEvent,
    payload: {
      ...localEvent.payload,
      step: Math.max(localEvent.payload.step, serverData.payload?.step || 0),
    },
  };
}

// ──── Status ────

/**
 * Get offline status
 * @returns {Promise<object>}
 */
export async function getOfflineStatus() {
  const [unsynced, queued] = await Promise.all([
    getUnsyncedEvents(),
    getQueuedActions(),
  ]);

  return {
    online: navigator.onLine,
    unsyncedCount: unsynced.length,
    queuedCount: queued.length,
    syncing: _syncing,
    deviceId: getDeviceId(),
  };
}

export default {
  saveEvent,
  getUnsyncedEvents,
  markSynced,
  getAllEvents,
  queueAction,
  getQueuedActions,
  dequeueAction,
  syncEvents,
  replayQueuedActions,
  startAutoSync,
  stopAutoSync,
  lastWriteWins,
  mergeProgress,
  getOfflineStatus,
};
