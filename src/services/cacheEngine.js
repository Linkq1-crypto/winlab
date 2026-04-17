/**
 * Strategic Cache Layer — Multi-level intelligent caching
 *
 * Levels:
 * 1. Static cache (HTML/CSS/JS) — Service Worker
 * 2. API cache (short TTL, GET only) — Memory with staleness
 * 3. Semantic cache (AI responses) — Similarity-based
 * 4. Offline cache (IndexedDB) — Persistent across sessions
 */

import { cosineSimilarity } from './helpdeskEngines/cache.js';

// ──── Level 1: Static Asset Cache (managed by Service Worker) ────
// No client-side management needed — SW handles this

// ──── Level 2: API Cache (short TTL, stale-while-revalidate) ────
const apiCache = new Map();
const API_CACHE_TTL = 60000; // 1 minute

/**
 * Fetch with API cache + stale-while-revalidate
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.ttl=60000] - Cache TTL in ms
 * @param {boolean} [opts.forceRefresh=false] - Skip cache
 * @returns {Promise<any>}
 */
export async function cachedApiFetch(url, opts = {}) {
  const { ttl = API_CACHE_TTL, forceRefresh = false } = opts;

  // Check cache
  if (!forceRefresh) {
    const cached = apiCache.get(url);
    if (cached && Date.now() - cached.fetchedAt < ttl) {
      // Fresh cache — return immediately
      return cached.data;
    }
  }

  // Fetch from network
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Update cache
    apiCache.set(url, { data, fetchedAt: Date.now() });

    return data;
  } catch (err) {
    // Network failed — try stale cache
    const cached = apiCache.get(url);
    if (cached) {
      console.warn('[Cache] Serving stale API data:', url);
      return cached.data;
    }

    throw err;
  }
}

/**
 * Invalidate API cache entries
 * @param {string|RegExp} pattern - URL pattern to invalidate
 */
export function invalidateApiCache(pattern) {
  for (const key of apiCache.keys()) {
    if (typeof pattern === 'string') {
      if (key.includes(pattern)) apiCache.delete(key);
    } else if (pattern.test(key)) {
      apiCache.delete(key);
    }
  }
}

/**
 * Get API cache stats
 * @returns {object}
 */
export function getApiCacheStats() {
  const entries = [];
  for (const [key, value] of apiCache.entries()) {
    const age = Date.now() - value.fetchedAt;
    const stale = age > API_CACHE_TTL;
    entries.push({ url: key, age: Math.round(age / 1000), stale });
  }

  return {
    total: apiCache.size,
    entries,
  };
}

// ──── Level 3: Semantic Cache (AI responses) ────
const semanticCache = {
  entries: [],
  maxEntries: 500,
  threshold: 0.85,
};

/**
 * Simple text embedding approximation
 */
function textEmbedding(text) {
  const vector = new Array(64).fill(0);
  if (!text) return vector;

  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const dim = Math.abs(hash) % 64;
    vector[dim] += 1;
  }

  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map(v => v / mag);
}

/**
 * Find semantically similar cached response
 * @param {string} text - Input text
 * @param {string} [category] - Optional category filter
 * @returns {object|null} { response, score } or null
 */
export function findSemanticCache(text, category) {
  const embedding = textEmbedding(text);
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of semanticCache.entries) {
    if (category && entry.category && entry.category !== category) continue;

    const score = cosineSimilarity(embedding, entry.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore > semanticCache.threshold) {
    bestMatch.uses = (bestMatch.uses || 0) + 1;
    return { response: bestMatch.response, score: bestScore };
  }

  return null;
}

/**
 * Save response to semantic cache
 * @param {object} params
 * @param {string} params.text - Original input
 * @param {string} params.response - Response text
 * @param {string} [params.category] - Category
 * @returns {boolean} true if saved
 */
export function saveSemanticCache(params) {
  // Check for duplicates
  const embedding = textEmbedding(params.text);
  for (const entry of semanticCache.entries) {
    const score = cosineSimilarity(embedding, entry.embedding);
    if (score > 0.95) return false; // Too similar to existing
  }

  semanticCache.entries.unshift({
    text: params.text.slice(0, 500),
    embedding,
    response: params.response,
    category: params.category || null,
    createdAt: Date.now(),
    uses: 0,
  });

  // Trim
  if (semanticCache.entries.length > semanticCache.maxEntries) {
    semanticCache.entries.length = semanticCache.maxEntries;
  }

  return true;
}

/**
 * Get semantic cache stats
 * @returns {object}
 */
export function getSemanticCacheStats() {
  const totalUses = semanticCache.entries.reduce((sum, e) => sum + (e.uses || 0), 0);
  return {
    totalEntries: semanticCache.entries.length,
    totalUses,
    threshold: semanticCache.threshold,
  };
}

// ──── Level 4: Persistent Cache (localStorage for small data) ────

const PERSISTENT_PREFIX = 'winlab-cache:';

/**
 * Set persistent cache value
 * @param {string} key
 * @param {any} value
 * @param {number} [ttl=3600000] - TTL in ms (default 1 hour)
 */
export function setPersistentCache(key, value, ttl = 3600000) {
  const entry = {
    value,
    expiresAt: Date.now() + ttl,
  };

  try {
    localStorage.setItem(PERSISTENT_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full — clear old entries
    clearExpiredPersistentCache();
  }
}

/**
 * Get persistent cache value
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {any}
 */
export function getPersistentCache(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PERSISTENT_PREFIX + key);
    if (!raw) return defaultValue;

    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PERSISTENT_PREFIX + key);
      return defaultValue;
    }

    return entry.value;
  } catch {
    return defaultValue;
  }
}

/**
 * Clear expired persistent cache entries
 */
export function clearExpiredPersistentCache() {
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PERSISTENT_PREFIX)) {
      try {
        const entry = JSON.parse(localStorage.getItem(key));
        if (Date.now() > entry.expiresAt) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export default {
  cachedApiFetch,
  invalidateApiCache,
  getApiCacheStats,
  findSemanticCache,
  saveSemanticCache,
  getSemanticCacheStats,
  setPersistentCache,
  getPersistentCache,
  clearExpiredPersistentCache,
};
