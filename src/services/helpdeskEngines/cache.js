/**
 * Semantic Cache — AI response caching with embedding similarity
 * Reduces AI costs by reusing similar responses
 */

// In-memory cache (upgrade to Redis later)
const cache = new Map();
const CACHE_MAX_PER_LANG = 500;
const SIMILARITY_THRESHOLD = 0.85;
const DECAY_HALF_LIFE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Simple text-to-embedding approximation (hash-based vector)
 * In production, replace with actual embedding API
 * @param {string} text
 * @returns {number[]} Embedding vector (128-dim)
 */
function simpleEmbedding(text) {
  const vector = new Array(128).fill(0);
  if (!text) return vector;

  // Hash-based embedding: distribute text features across dimensions
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const dim = Math.abs(hash) % 128;
    vector[dim] += 1;
  }

  // Normalize
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map(v => v / mag);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Apply decay based on age
 * @param {object} item - Cache item with createdAt
 * @returns {number} Decay multiplier (0-1)
 */
export function applyDecay(item) {
  const age = Date.now() - item.createdAt;
  return Math.exp(-age / DECAY_HALF_LIFE);
}

/**
 * Get cache key for a language
 */
function getCacheKey(lang) {
  return `email:cache:${lang}`;
}

/**
 * Detect language from text (same as classifier)
 */
function detectLanguage(text) {
  if (!text) return 'en';
  const lower = text.toLowerCase();
  const italianWords = ['ciao', 'buongiorno', 'grazie', 'problema', 'aiuto', 'vorrei', 'non riesco', 'come fare', 'per favore'];
  if (italianWords.some(w => lower.includes(w))) return 'it';
  const spanishWords = ['hola', 'gracias', 'problema', 'ayuda', 'por favor', 'necesito'];
  if (spanishWords.some(w => lower.includes(w))) return 'es';
  return 'en';
}

/**
 * Find best matching cached response
 * @param {string} text - Input text
 * @param {string} [team] - Team filter
 * @returns {object|null} { reply, score, source: 'cache' } or null
 */
export function findCachedReply(text, team) {
  const lang = detectLanguage(text);
  const key = getCacheKey(lang);
  const embedding = simpleEmbedding(text);

  const items = cache.get(key) || [];
  let bestMatch = null;
  let bestScore = 0;

  for (const item of items) {
    // Team filter
    if (team && item.team && item.team !== team) continue;

    const rawScore = cosineSimilarity(embedding, item.embedding);
    const decay = applyDecay(item);
    const score = rawScore * decay;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && bestScore > SIMILARITY_THRESHOLD) {
    bestMatch.uses += 1;
    bestMatch.score = Math.min(1, bestMatch.score + 0.02);

    return {
      reply: bestMatch.response,
      score: Math.round(bestScore * 100) / 100,
      source: 'cache',
      cachedAt: bestMatch.createdAt,
      uses: bestMatch.uses,
    };
  }

  return null;
}

/**
 * Save response to cache
 * @param {object} params
 * @param {string} params.text - Original input text
 * @param {string} params.response - AI response
 * @param {string} params.team - Team name
 * @param {string} params.intent - Detected intent
 * @returns {object} Saved item
 */
export function saveToCache(params) {
  const { text, response, team = 'support', intent = 'other' } = params;
  const lang = detectLanguage(text);
  const key = getCacheKey(lang);
  const embedding = simpleEmbedding(text);

  if (!cache.has(key)) {
    cache.set(key, []);
  }

  const items = cache.get(key);

  // Check for duplicate (very similar existing entry)
  const existingScore = cosineSimilarity(embedding, items.map(i => i.embedding).reduce((best, e) => {
    const s = cosineSimilarity(embedding, e);
    return s > (best?.score || 0) ? { embedding: e, score: s } : best;
  }, null)?.embedding || new Array(128).fill(0));

  if (existingScore > 0.95) {
    // Update existing instead of adding duplicate
    return { source: 'existing' };
  }

  const item = {
    text: text.slice(0, 500), // Truncate for storage
    embedding,
    response,
    team,
    intent,
    lang,
    createdAt: Date.now(),
    score: 1,
    uses: 0,
  };

  items.unshift(item);

  // Trim cache
  if (items.length > CACHE_MAX_PER_LANG) {
    items.length = CACHE_MAX_PER_LANG;
  }

  return { source: 'saved', item };
}

/**
 * Record feedback: when user edits AI response
 * @param {string} originalText - Original email text
 * @param {string} correctedResponse - User's corrected response
 * @param {string} team - Team name
 */
export function recordFeedback(originalText, correctedResponse, team) {
  const lang = detectLanguage(originalText);
  const key = getCacheKey(lang);
  const embedding = simpleEmbedding(originalText);

  if (!cache.has(key)) {
    cache.set(key, []);
  }

  // Add feedback-boosted entry
  const items = cache.get(key);
  items.unshift({
    text: originalText.slice(0, 500),
    embedding,
    response: correctedResponse,
    team,
    intent: 'feedback',
    lang,
    createdAt: Date.now(),
    score: 1.5, // Boost!
    uses: 0,
    isFeedback: true,
  });

  if (items.length > CACHE_MAX_PER_LANG) {
    items.length = CACHE_MAX_PER_LANG;
  }
}

/**
 * Get cache statistics
 * @returns {object}
 */
export function getCacheStats() {
  let totalItems = 0;
  let totalUses = 0;
  const byLang = {};
  const byTeam = {};
  const byIntent = {};

  for (const [key, items] of cache.entries()) {
    const lang = key.split(':').pop();
    totalItems += items.length;
    byLang[lang] = items.length;

    for (const item of items) {
      totalUses += item.uses;
      byTeam[item.team] = (byTeam[item.team] || 0) + 1;
      byIntent[item.intent] = (byIntent[item.intent] || 0) + 1;
    }
  }

  const hitRate = totalItems > 0 ? totalUses / (totalItems + totalUses) : 0;

  return {
    totalItems,
    totalUses,
    hitRate: Math.round(hitRate * 100) / 100,
    byLang,
    byTeam,
    byIntent,
  };
}

/**
 * Clear cache (for maintenance)
 * @param {string} [lang] - Specific language or all
 */
export function clearCache(lang) {
  if (lang) {
    cache.delete(getCacheKey(lang));
  } else {
    cache.clear();
  }
}

export default {
  findCachedReply,
  saveToCache,
  recordFeedback,
  getCacheStats,
  clearCache,
  cosineSimilarity,
  applyDecay,
};
