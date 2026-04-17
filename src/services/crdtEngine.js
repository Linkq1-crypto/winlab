/**
 * CRDT Sync Engine — Yjs + IndexedDB
 * Conflict-free state with eventual consistency
 *
 * Architecture:
 * Client → Yjs doc → IndexedDB persistence
 *            ↓
 *       Push/Pull sync (batched + diff-only)
 *            ↓
 *       Server (append-only event log)
 */

import * as Y from 'yjs';
import { openDB } from 'idb';

// ──── IndexedDB Setup ────
const DB_NAME = 'winlab-crdt';
const DB_VERSION = 1;
const STORE_UPDATES = 'updates';
const STORE_STATE_VECTOR = 'stateVector';
const STORE_META = 'meta';

let _dbPromise;

export async function getDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Yjs updates (binary)
      if (!db.objectStoreNames.contains(STORE_UPDATES)) {
        db.createObjectStore(STORE_UPDATES, { keyPath: 'id' });
      }

      // State vector for efficient diff
      if (!db.objectStoreNames.contains(STORE_STATE_VECTOR)) {
        db.createObjectStore(STORE_STATE_VECTOR);
      }

      // Metadata (lastSync, deviceId)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    },
  });

  return _dbPromise;
}

// ──── Device ID ────
let _deviceId;

export function getDeviceId() {
  if (_deviceId) return _deviceId;
  _deviceId = localStorage.getItem('crdt-device-id');
  if (!_deviceId) {
    _deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('crdt-device-id', _deviceId);
  }
  return _deviceId;
}

// ──── Yjs Doc Manager ────

/**
 * Create a synced Yjs document
 * @param {string} roomName - Room/channel name
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true] - Persist to IndexedDB
 * @param {Function} [opts.onUpdate] - Callback on local update
 * @returns {Promise<{ doc, provider }>
 */
export async function createCrdtDoc(roomName, opts = {}) {
  const { persist = true, onUpdate } = opts;
  const db = await getDB();
  const doc = new Y.Doc();

  // Load persisted state
  if (persist) {
    const storedUpdates = await db.getAll(STORE_UPDATES);
    if (storedUpdates.length > 0) {
      // Merge all stored updates
      const merged = Y.mergeUpdates(storedUpdates.map(u => u.update));
      Y.applyUpdate(doc, merged);
    }
  }

  // Listen for local changes
  doc.on('update', async (update, origin, doc) => {
    // Persist update
    if (persist) {
      const id = `update_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await db.put(STORE_UPDATES, {
        id,
        update,
        room: roomName,
        deviceId: getDeviceId(),
        timestamp: Date.now(),
        synced: false,
      });
    }

    // Save state vector for efficient diff
    if (persist) {
      const stateVector = Y.encodeStateVector(doc);
      await db.put(STORE_STATE_VECTOR, stateVector, 'local');
    }

    onUpdate?.(update);
  });

  return { doc, db, roomName };
}

// ──── Push/Pull Sync ────

/**
 * Get unsynced updates (diff-only)
 * @param {Y.Doc} doc
 * @param {Uint8Array} [serverStateVector] - Server's state vector
 * @returns {Uint8Array} Delta update
 */
export function getDeltaUpdate(doc, serverStateVector) {
  if (serverStateVector) {
    // Efficient diff — only what server doesn't have
    return Y.encodeStateAsUpdate(doc, serverStateVector);
  }

  // Full update (first sync or server has nothing)
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Push unsynced updates to server
 * @param {object} params
 * @param {Y.Doc} params.doc - Yjs document
 * @param {string} params.room - Room name
 * @param {string} params.apiUrl - Sync endpoint
 * @param {Function} [params.onProgress] - Progress callback
 * @returns {Promise<object>} { pushed: number, ackIds: string[] }
 */
export async function pushUpdates(params) {
  const { doc, room, apiUrl, onProgress } = params;
  const db = await getDB();

  // Get unsynced updates
  const unsynced = await db.getAll(STORE_UPDATES);
  const pending = unsynced.filter(u => !u.synced && u.room === room);

  if (pending.length === 0) {
    return { pushed: 0, ackIds: [] };
  }

  // Create delta update
  const delta = getDeltaUpdate(doc);

  try {
    const response = await fetch(apiUrl + '/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room,
        deviceId: getDeviceId(),
        update: Array.from(delta), // Convert Uint8Array to JSON-safe
        updateCount: pending.length,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { ack } = await response.json();

    // Mark acknowledged updates as synced
    for (const u of pending) {
      if (ack.includes(u.id) || ack === true) {
        u.synced = true;
        await db.put(STORE_UPDATES, u);
      }
    }

    // Clean up old synced updates (keep last 100)
    const allSynced = unsynced.filter(u => u.synced);
    if (allSynced.length > 100) {
      const toDelete = allSynced.slice(0, allSynced.length - 100);
      for (const u of toDelete) {
        await db.delete(STORE_UPDATES, u.id);
      }
    }

    onProgress?.({ pushed: pending.length, ack });
    return { pushed: pending.length, ackIds: ack };
  } catch (err) {
    console.error('[CRDT] Push failed:', err.message);
    return { pushed: 0, ackIds: [] };
  }
}

/**
 * Pull updates from server
 * @param {object} params
 * @param {Y.Doc} params.doc - Yjs document
 * @param {string} params.room - Room name
 * @param {string} params.apiUrl - Sync endpoint
 * @param {Function} [params.onUpdate] - Called when remote updates applied
 * @returns {Promise<object>} { pulled: number, hasChanges: boolean }
 */
export async function pullUpdates(params) {
  const { doc, room, apiUrl, onUpdate } = params;
  const db = await getDB();

  try {
    // Get last sync timestamp
    const lastSync = await db.get(STORE_META, `lastSync:${room}`) || 0;

    const response = await fetch(`${apiUrl}/pull?room=${room}&since=${lastSync}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { updates, stateVector } = await response.json();

    let applied = 0;

    if (updates && updates.length > 0) {
      // Convert arrays back to Uint8Array
      const binaryUpdates = updates.map(u => new Uint8Array(u));

      // Merge and apply
      const merged = Y.mergeUpdates(binaryUpdates);
      Y.applyUpdate(doc, merged);
      applied = updates.length;
      onUpdate?.({ count: applied });
    }

    // Update last sync time
    await db.put(STORE_META, Date.now(), `lastSync:${room}`);

    // If server sent state vector, save it for efficient diff next push
    if (stateVector) {
      await db.put(STORE_STATE_VECTOR, new Uint8Array(stateVector), 'server');
    }

    return { pulled: applied, hasChanges: applied > 0 };
  } catch (err) {
    console.error('[CRDT] Pull failed:', err.message);
    return { pulled: 0, hasChanges: false };
  }
}

// ──── Auto Sync ────

let _syncIntervals = {};

/**
 * Start automatic push/pull sync
 * @param {object} params
 * @param {Y.Doc} params.doc - Yjs document
 * @param {string} params.room - Room name
 * @param {string} params.apiUrl - Sync endpoint
 * @param {number} [params.interval=5000] - Sync interval ms
 * @param {Function} [params.onPush]
 * @param {Function} [params.onPull]
 */
export function startAutoSync(params) {
  const { room, doc, apiUrl, interval = 5000, onPush, onPull } = params;

  if (_syncIntervals[room]) {
    clearInterval(_syncIntervals[room]);
  }

  const sync = async () => {
    if (!navigator.onLine) return;

    try {
      const pushResult = await pushUpdates({ doc, room, apiUrl });
      onPush?.(pushResult);

      const pullResult = await pullUpdates({ doc, room, apiUrl, onUpdate: onPull });
      onPull?.(pullResult);
    } catch (err) {
      console.error('[CRDT] Auto-sync error:', err.message);
    }
  };

  // Immediate sync
  if (navigator.onLine) sync();

  // Periodic sync
  _syncIntervals[room] = setInterval(sync, interval);

  // Sync on reconnect
  const onOnline = () => sync();
  window.addEventListener('online', onOnline);

  return () => {
    clearInterval(_syncIntervals[room]);
    delete _syncIntervals[room];
    window.removeEventListener('online', onOnline);
  };
}

/**
 * Stop auto sync for a room
 */
export function stopAutoSync(room) {
  if (_syncIntervals[room]) {
    clearInterval(_syncIntervals[room]);
    delete _syncIntervals[room];
  }
}

// ──── Utility ────

/**
 * Get sync status
 * @param {string} room
 * @returns {Promise<object>}
 */
export async function getSyncStatus(room) {
  const db = await getDB();
  const allUpdates = await db.getAll(STORE_UPDATES);
  const roomUpdates = allUpdates.filter(u => u.room === room);

  const unsynced = roomUpdates.filter(u => !u.synced).length;
  const total = roomUpdates.length;
  const lastSync = await db.get(STORE_META, `lastSync:${room}`) || 0;

  return {
    room,
    online: navigator.onLine,
    unsynced,
    total,
    lastSync: lastSync ? new Date(lastSync).toISOString() : null,
    deviceId: getDeviceId(),
  };
}

export default {
  createCrdtDoc,
  pushUpdates,
  pullUpdates,
  startAutoSync,
  stopAutoSync,
  getSyncStatus,
  getDeviceId,
  getDB,
};
