/**
 * AI Learning Cache — Feedback loop with decay
 *
 * AI generates response → user accepts/edits → system learns
 * Responses with high feedback scores prioritized
 * Old responses decay over time
 */

import { cosineSimilarity } from './helpdeskEngines/cache.js';

// In-memory cache (upgrade to Redis later)
const aiCache = new Map();
const DECAY_RATE = 0.98; // 2% decay per cycle
const DECAY_INTERVAL = 5 * 60 * 1000; // Every 5 minutes

// ──── Cache Entry ────

function createEntry(key, response, metadata = {}) {
  return {
    key,
    query: metadata.query || key,
    response,
    language: metadata.language || 'en',
    intent: metadata.intent || 'other',
    embedding: metadata.embedding || textEmbedding(metadata.query || key),
    score: metadata.initialScore || 0.5, // Start neutral
    usageCount: 0,
    feedbackCount: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: metadata.tags || [],
  };
}

// ──── Simple Text Embedding ────

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

// ──── Cache Operations ────

/**
 * Find best matching cached response
 * @param {string} query - User query
 * @param {object} [opts]
 * @param {string} [opts.language] - Language filter
 * @param {string} [opts.intent] - Intent filter
 * @param {number} [opts.threshold=0.8] - Minimum similarity
 * @returns {object|null} { response, score, entry } or null
 */
export function findBestCachedResponse(query, opts = {}) {
  const { language, intent, threshold = 0.8 } = opts;
  const queryEmbedding = textEmbedding(query);

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of aiCache.values()) {
    // Filter by language/intent
    if (language && entry.language && entry.language !== language) continue;
    if (intent && entry.intent && entry.intent !== intent) continue;

    // Skip low-quality entries
    if (entry.score < 0.3) continue;

    // Semantic similarity
    const sim = cosineSimilarity(queryEmbedding, entry.embedding);

    // Combined score: 70% semantic + 30% feedback score
    const combinedScore = sim * 0.7 + entry.score * 0.3;

    if (combinedScore > bestScore && combinedScore > threshold) {
      bestScore = combinedScore;
      bestEntry = entry;
    }
  }

  if (bestEntry) {
    return {
      response: bestEntry.response,
      score: Math.round(bestScore * 100) / 100,
      entry: bestEntry,
    };
  }

  return null;
}

/**
 * Cache a new AI response
 * @param {object} params
 * @param {string} params.query - Original query
 * @param {string} params.response - AI response
 * @param {string} [params.language]
 * @param {string} [params.intent]
 * @param {string[]} [params.tags]
 * @returns {object} Cached entry
 */
export function cacheAIResponse(params) {
  const { query, response, language = 'en', intent = 'other', tags = [] } = params;

  // Check for duplicate
  for (const entry of aiCache.values()) {
    const sim = cosineSimilarity(textEmbedding(query), entry.embedding);
    if (sim > 0.95) {
      // Update existing instead of creating duplicate
      entry.response = response;
      entry.updatedAt = Date.now();
      entry.tags = [...new Set([...entry.tags, ...tags])];
      return entry;
    }
  }

  const key = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const entry = createEntry(key, response, {
    query,
    language,
    intent,
    tags,
    initialScore: 0.5,
  });

  aiCache.set(key, entry);
  return entry;
}

/**
 * Record feedback on a cached response
 * @param {string} key - Cache entry key
 * @param {'accepted'|'edited'|'rejected'} feedback - User feedback type
 */
export function recordFeedback(key, feedback) {
  const entry = aiCache.get(key);
  if (!entry) return;

  entry.feedbackCount += 1;
  entry.updatedAt = Date.now();

  switch (feedback) {
    case 'accepted':
      entry.positiveFeedback += 1;
      entry.score = Math.min(1, entry.score + 0.05);
      break;

    case 'edited':
      // Partial credit — user kept some but modified
      entry.score = Math.min(1, entry.score + 0.02);
      entry.negativeFeedback += 0.5;
      break;

    case 'rejected':
      entry.negativeFeedback += 1;
      entry.score = Math.max(0, entry.score - 0.1);
      break;
  }

  entry.usageCount += 1;
}

/**
 * Apply decay to all cache entries
 * Prevents old/wrong responses from persisting
 */
export function applyDecay() {
  for (const [key, entry] of aiCache.entries()) {
    // Only decay entries that haven't been used recently
    const age = Date.now() - entry.updatedAt;
    if (age > DECAY_INTERVAL) {
      entry.score *= DECAY_RATE;

      // Remove very low score entries
      if (entry.score < 0.1 && entry.usageCount === 0) {
        aiCache.delete(key);
      }
    }
  }

  // Schedule next decay
  setTimeout(applyDecay, DECAY_INTERVAL);
}

// Start decay cycle
applyDecay();

/**
 * Get cache stats
 * @returns {object}
 */
export function getAICacheStats() {
  const entries = Array.from(aiCache.values());
  const total = entries.length;
  const highQuality = entries.filter(e => e.score > 0.7).length;
  const lowQuality = entries.filter(e => e.score < 0.3).length;

  const avgScore = total > 0
    ? entries.reduce((s, e) => s + e.score, 0) / total
    : 0;

  const totalUsage = entries.reduce((s, e) => s + e.usageCount, 0);
  const totalFeedback = entries.reduce((s, e) => s + e.feedbackCount, 0);

  const byIntent = {};
  const byLanguage = {};
  for (const e of entries) {
    byIntent[e.intent] = (byIntent[e.intent] || 0) + 1;
    byLanguage[e.language] = (byLanguage[e.language] || 0) + 1;
  }

  const topEntries = entries
    .filter(e => e.usageCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(e => ({
      key: e.key,
      query: e.query.slice(0, 50),
      score: Math.round(e.score * 100),
      usageCount: e.usageCount,
      intent: e.intent,
    }));

  return {
    total,
    highQuality,
    lowQuality,
    avgScore: Math.round(avgScore * 100) / 100,
    totalUsage,
    totalFeedback,
    byIntent,
    byLanguage,
    topEntries,
  };
}

/**
 * Clear low-quality cache entries
 * @param {number} [threshold=0.2] - Remove entries below this score
 */
export function pruneCache(threshold = 0.2) {
  const before = aiCache.size;
  for (const [key, entry] of aiCache.entries()) {
    if (entry.score < threshold && entry.usageCount === 0) {
      aiCache.delete(key);
    }
  }
  return { before, after: aiCache.size, pruned: before - aiCache.size };
}

/**
 * Get all entries (for admin/debug)
 * @param {number} [limit=50]
 * @returns {Array}
 */
export function getAllEntries(limit = 50) {
  return Array.from(aiCache.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(e => ({
      key: e.key,
      query: e.query,
      score: Math.round(e.score * 100),
      usageCount: e.usageCount,
      feedbackCount: e.feedbackCount,
      language: e.language,
      intent: e.intent,
      createdAt: new Date(e.createdAt).toISOString(),
    }));
}

export default {
  findBestCachedResponse,
  cacheAIResponse,
  recordFeedback,
  applyDecay,
  getAICacheStats,
  pruneCache,
  getAllEntries,
};
