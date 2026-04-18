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
const DB_VERSION = 2;
const STORE_EVENTS = 'events';
const STORE_QUEUE = 'offline-queue';
const STORE_SEQ = 'sequence';

let _dbPromise;

function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const eventStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        eventStore.createIndex('timestamp', 'timestamp', { unique: false });
        eventStore.createIndex('type', 'type', { unique: false });
        eventStore.createIndex('synced', 'synced', { unique: false });
        eventStore.createIndex('sequence', 'sequence', { unique: false });
      } else {
        // v1→v2 migration: add sequence index if missing
        const tx = event.target.transaction;
        const store = tx.objectStore(STORE_EVENTS);
        if (!store.indexNames.contains('sequence')) {
          store.createIndex('sequence', 'sequence', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('retries', 'retries', { unique: false });
      }

      // Monotonic sequence counter per device
      if (!db.objectStoreNames.contains(STORE_SEQ)) {
        db.createObjectStore(STORE_SEQ);
      }
    };
  });

  return _dbPromise;
}

// ──── Sequence Counter ────
// Returns next monotonic integer for this device — clock-drift safe.
async function nextSequence(deviceId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SEQ, 'readwrite');
    const store = tx.objectStore(STORE_SEQ);
    const getReq = store.get(deviceId);

    getReq.onsuccess = () => {
      const next = (getReq.result ?? 0) + 1;
      const putReq = store.put(next, deviceId);
      putReq.onsuccess = () => resolve(next);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ──── Event Schema ────

export const EVENT_TYPES = Object.freeze({
  CONTEXT:     'context_event',
  BIOMETRIC:   'biometric_event',
  MOTION:      'motion_event',
  SYSTEM:      'system_event',
  USER_ACTION: 'user_action_event',
  RISK_SIGNAL: 'risk_signal',
});

const VALID_EVENT_TYPES = new Set(Object.values(EVENT_TYPES));

// ──── Event Store ────

/**
 * Save an event locally
 * @param {object} event
 * @param {string} event.type - Must be one of EVENT_TYPES values
 * @param {object} event.payload - Event data
 * @param {string} [event.deviceId] - Device identifier
 * @param {object} [event.context] - Override auto-detected context
 * @returns {Promise<object>} Saved event with sequence + schema_version
 */
export async function saveEvent(event, opts = {}) {
  if (!VALID_EVENT_TYPES.has(event.type)) {
    throw new Error(`[offlineEngine] Invalid event_type: "${event.type}". Must be one of: ${[...VALID_EVENT_TYPES].join(', ')}`);
  }

  const db = await openDB();
  const deviceId = event.deviceId || getDeviceId();
  const sequence = await nextSequence(deviceId);

  const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
  const eventId = event.id || crypto.randomUUID?.() || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullEvent = {
    id: eventId,
    event_id: eventId,
    tenant_id: event.tenantId || getTenantId(),
    device_id: deviceId,
    sequence,
    schema_version: 1,
    timestamp: Date.now(),
    event_type: event.type,
    type: event.type,
    payload: { data: event.payload ?? {} },
    context: event.context ?? {
      network_state: conn?.effectiveType ?? (navigator.onLine ? 'unknown' : 'offline'),
      battery: null,
    },
    synced: false,
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    const store = tx.objectStore(STORE_EVENTS);
    const request = store.put(fullEvent);

    request.onsuccess = () => {
      // Fast path: immediate local risk hint (sync, no network)
      // Slow path: server intelligence layer runs after syncEvents()
      let hint = null;
      if (!opts.skipHint) {
        import('./edgeRiskHint.js')
          .then(({ pushAndHint }) => { hint = pushAndHint(fullEvent); })
          .catch(() => {});
      }
      resolve({ event: fullEvent, hint });
    };
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

    // Order by (device_id, sequence) — guaranteed ordering even with clock drift
    request.onsuccess = () => {
      const events = request.result.slice().sort((a, b) => {
        if (a.device_id < b.device_id) return -1;
        if (a.device_id > b.device_id) return 1;
        return (a.sequence ?? 0) - (b.sequence ?? 0);
      });
      resolve(events);
    };
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

// Batch sizes adapt to connection quality — fewer round trips on slow links.
const BATCH_SIZES = Object.freeze({
  'slow-2g': 5,
  '2g':      10,
  '3g':      25,
  '4g':      50,
  unknown:   20,
});

function getBatchSize() {
  const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
  return BATCH_SIZES[conn?.effectiveType] ?? BATCH_SIZES.unknown;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Sync unsynced events to server in adaptive batches.
 * Batch size is chosen by connection quality (2G→5, 4G→50).
 * A failed batch is retried event-by-event so partial progress is saved.
 *
 * @param {object}   [opts]
 * @param {string}   [opts.endpoint='/api/helpdesk/sync']
 * @param {Function} [opts.onProgress] - (synced, total) callback
 * @param {Function} [opts.onConflict] - (localEvent, serverData) → boolean
 * @returns {Promise<{ synced: number, failed: number, batches: number }>}
 */
export async function syncEvents(opts = {}) {
  const { onProgress, onConflict, endpoint = '/api/helpdesk/sync' } = opts;

  const events = await getUnsyncedEvents();
  if (events.length === 0) return { synced: 0, failed: 0, batches: 0 };

  const batchSize = getBatchSize();
  const batches   = chunkArray(events, batchSize);

  let synced = 0;
  let failed = 0;

  for (const batch of batches) {
    try {
      const response = await fetch(endpoint + '/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });

      if (response.ok) {
        const { acknowledged = [], conflicts = [] } = await response.json();

        // Mark acknowledged events as synced
        for (const id of acknowledged) {
          await markSynced(id);
          synced++;
        }

        // Handle per-event conflicts
        for (const { id, serverData } of conflicts) {
          const localEvent = batch.find(e => e.id === id);
          if (localEvent && onConflict) {
            const resolved = onConflict(localEvent, serverData);
            if (resolved) { await markSynced(id); synced++; }
            else failed++;
          } else {
            failed++;
          }
        }

        // Events not in acknowledged or conflicts = server didn't see them
        const accounted = new Set([...acknowledged, ...conflicts.map(c => c.id)]);
        for (const e of batch) {
          if (!accounted.has(e.id)) failed++;
        }
      } else {
        // Batch rejected — fall back to one-by-one to salvage partial progress
        for (const event of batch) {
          try {
            const r = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event),
            });
            if (r.ok) { await markSynced(event.id); synced++; }
            else if (r.status === 409 && onConflict) {
              const serverData = await r.json();
              if (onConflict(event, serverData)) { await markSynced(event.id); synced++; }
              else failed++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }
      }
    } catch {
      // Network error — entire batch failed, will retry on next sync cycle
      failed += batch.length;
    }

    onProgress?.(synced + failed, events.length);
  }

  return { synced, failed, batches: batches.length };
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

// ──── Tenant ID ────
// Reads from app config injected at build time or runtime window.__TENANT_ID__
function getTenantId() {
  if (typeof window !== 'undefined') {
    return window.__TENANT_ID__ || localStorage.getItem('tenantId') || 'default';
  }
  return 'default';
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
