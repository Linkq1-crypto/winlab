/**
 * React Hooks for CRDT + AI Learning Cache
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import {
  createCrdtDoc,
  startAutoSync,
  stopAutoSync,
  getSyncStatus,
  pushUpdates,
  pullUpdates,
} from '../services/crdtEngine.js';
import { createWebRTCProvider, getWebRTCStatus, hasPeers } from '../services/webRTCSync.js';
import { findBestCachedResponse, cacheAIResponse, recordFeedback } from '../services/aiLearningCache.js';

// ──── useCrdt Hook ────

/**
 * React hook for CRDT-managed state
 * @param {string} room - Room/channel name
 * @param {object} [opts]
 * @param {string} [opts.apiUrl=/api/sync] - Server sync endpoint
 * @param {number} [opts.syncInterval=5000] - Auto-sync interval
 * @param {boolean} [opts.enableWebRTC=true] - Enable P2P sync
 * @returns {object} { doc, map, status, sync, connected }
 */
export function useCrdt(room, opts = {}) {
  const {
    apiUrl = '/api/sync',
    syncInterval = 5000,
    enableWebRTC = true,
  } = opts;

  const [doc, setDoc] = useState(null);
  const [map, setMap] = useState(null);
  const [status, setStatus] = useState({ room, online: navigator.onLine, unsynced: 0, total: 0 });
  const [peerCount, setPeerCount] = useState(0);
  const [initialized, setInitialized] = useState(false);

  const stopSyncRef = useRef(null);

  // Initialize Yjs doc
  useEffect(() => {
    let cleanup;

    async function init() {
      const { doc, db } = await createCrdtDoc(room, {
        onUpdate: (update) => {
          setStatus(prev => ({ ...prev, unsynced: (prev.unsynced || 0) + 1 }));
        },
      });

      const yMap = doc.getMap(room);
      setDoc(doc);
      setMap(yMap);
      setInitialized(true);

      // Start auto sync
      const stopSync = startAutoSync({
        doc,
        room,
        apiUrl,
        interval: syncInterval,
        onPush: (result) => {
          setStatus(prev => ({
            ...prev,
            lastPush: Date.now(),
            pushed: result.pushed,
          }));
          updateSyncStatus();
        },
        onPull: (result) => {
          setStatus(prev => ({
            ...prev,
            lastPull: Date.now(),
            pulled: result.pulled,
            hasChanges: result.hasChanges,
          }));
          updateSyncStatus();
        },
      });

      stopSyncRef.current = stopSync;

      // WebRTC P2P sync
      if (enableWebRTC) {
        const provider = createWebRTCProvider({
          doc,
          room,
          onPeerConnected: () => setPeerCount(prev => prev + 1),
          onPeerDisconnected: () => setPeerCount(prev => Math.max(0, prev - 1)),
        });

        cleanup = () => {
          stopSync();
          provider.destroy();
        };
      } else {
        cleanup = stopSync;
      }
    }

    init();

    return () => {
      if (cleanup) cleanup();
      if (doc) doc.destroy();
    };
  }, [room, apiUrl, syncInterval, enableWebRTC]);

  // Update sync status periodically
  const updateSyncStatus = useCallback(async () => {
    if (!room) return;
    try {
      const s = await getSyncStatus(room);
      setStatus(prev => ({ ...prev, ...s }));
    } catch {}
  }, [room]);

  useEffect(() => {
    if (!initialized) return;

    const interval = setInterval(updateSyncStatus, 10000);
    updateSyncStatus();

    return () => clearInterval(interval);
  }, [initialized, updateSyncStatus]);

  // Update peer count
  useEffect(() => {
    if (!initialized) return;

    const interval = setInterval(() => {
      const peerStatus = getWebRTCStatus(room);
      if (peerStatus) setPeerCount(peerStatus.peerCount);
    }, 5000);

    return () => clearInterval(interval);
  }, [initialized, room]);

  // Force manual sync
  const forceSync = useCallback(async () => {
    if (!doc) return;
    await pushUpdates({ doc, room, apiUrl });
    await pullUpdates({ doc, room, apiUrl });
    await updateSyncStatus();
  }, [doc, room, apiUrl, updateSyncStatus]);

  // Update a value in the CRDT map
  const set = useCallback((key, value) => {
    if (!map) return;
    map.set(key, value);
  }, [map]);

  // Get a value from the CRDT map
  const get = useCallback((key) => {
    if (!map) return undefined;
    return map.get(key);
  }, [map]);

  // Get all values as plain object
  const toJSON = useCallback(() => {
    if (!map) return {};
    return map.toJSON();
  }, [map]);

  return useMemo(() => ({
    doc,
    map,
    status,
    peerCount,
    initialized,
    online: status.online,
    hasPeers: peerCount > 0,
    set,
    get,
    toJSON,
    forceSync,
  }), [doc, map, status, peerCount, initialized, set, get, toJSON, forceSync]);
}

// ──── useAICache Hook ────

/**
 * React hook for AI learning cache
 * @param {object} [opts]
 * @param {string} [opts.language] - Language filter
 * @param {string} [opts.intent] - Intent filter
 * @returns {object} { findCached, cacheResponse, recordFeedback }
 */
export function useAICache(opts = {}) {
  const { language, intent } = opts;

  const findCached = useCallback((query, threshold = 0.8) => {
    return findBestCachedResponse(query, { language, intent, threshold });
  }, [language, intent]);

  const cacheResponse = useCallback((params) => {
    return cacheAIResponse(params);
  }, []);

  const recordFb = useCallback((key, feedback) => {
    recordFeedback(key, feedback);
  }, []);

  return useMemo(() => ({
    findCached,
    cacheResponse,
    recordFeedback: recordFb,
  }), [findCached, cacheResponse, recordFb]);
}

// ──── useAIReply Hook (combines cache + AI) ────

/**
 * React hook for AI reply with cache optimization
 * @param {object} [opts]
 * @param {Function} opts.generateAI - Function to call AI API
 * @param {string} [opts.language]
 * @param {string} [opts.intent]
 * @returns {object} { reply, loading, source, recordFeedback }
 */
export function useAIReply(opts = {}) {
  const { generateAI, language = 'en', intent = 'other' } = opts;

  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(''); // 'cache' | 'ai' | 'error'
  const [cacheKey, setCacheKey] = useState('');

  const aiCache = useAICache({ language, intent });

  const generateReply = useCallback(async (query, context = {}) => {
    setLoading(true);
    setSource('');

    // Check cache first
    const cached = aiCache.findCached(query, 0.8);

    if (cached) {
      setReply(cached.response);
      setSource('cache');
      setCacheKey(cached.entry.key);
      setLoading(false);
      return { response: cached.response, source: 'cache', score: cached.score };
    }

    // Cache miss → generate with AI
    try {
      const aiResponse = await generateAI(query, context);

      setReply(aiResponse);
      setSource('ai');

      // Cache the response
      const entry = aiCache.cacheResponse({
        query,
        response: aiResponse,
        language,
        intent,
        tags: Object.keys(context),
      });

      setCacheKey(entry.key);

      return { response: aiResponse, source: 'ai' };
    } catch (err) {
      setSource('error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [generateAI, language, intent, aiCache]);

  const recordFb = useCallback((feedback) => {
    if (cacheKey) {
      aiCache.recordFeedback(cacheKey, feedback);
    }
  }, [cacheKey, aiCache]);

  return useMemo(() => ({
    reply,
    loading,
    source,
    generateReply,
    recordFeedback: recordFb,
  }), [reply, loading, source, generateReply, recordFb]);
}

export default { useCrdt, useAICache, useAIReply };
