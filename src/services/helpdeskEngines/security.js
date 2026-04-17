/**
 * Security Engine — Anomaly detection, rate limiting, reputation, blacklist
 * Protects the helpdesk from spam, abuse, and automated attacks
 */

// ──── Rate Limiting ────
const rateMap = new Map();

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max emails per window

/**
 * Check if sender is within rate limits
 * @param {string} email - Sender email
 * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(email) {
  const now = Date.now();

  if (!rateMap.has(email)) {
    rateMap.set(email, []);
  }

  const history = rateMap.get(email).filter(t => now - t < RATE_LIMIT_WINDOW);
  history.push(now);
  rateMap.set(email, history);

  const remaining = Math.max(0, RATE_LIMIT_MAX - history.length);
  const resetAt = history[0] + RATE_LIMIT_WINDOW;

  return {
    allowed: history.length <= RATE_LIMIT_MAX,
    remaining,
    resetAt,
    count: history.length,
  };
}

/**
 * Clear old rate limit entries (call periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [email, history] of rateMap.entries()) {
    const filtered = history.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (filtered.length === 0) {
      rateMap.delete(email);
    } else {
      rateMap.set(email, filtered);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

// ──── Anomaly Detection ────

/**
 * Detect anomalous patterns in email history
 * @param {Array} events - [{ email, ip, timestamp }]
 * @returns {string|null} Anomaly type or null
 */
export function detectAnomaly(events) {
  const now = Date.now();
  const recent = events.filter(e => now - e.timestamp < 60_000);

  // Burst detection: too many emails in 1 minute
  if (recent.length > 5) {
    return 'burst';
  }

  // Domain spread: many different domains in short time
  const domains = new Set(events.map(e => {
    const match = e.email.match(/@([^\s>]+)/);
    return match ? match[1] : null;
  }).filter(Boolean));
  if (domains.size > 5) {
    return 'domain_spread';
  }

  // IP diversity: same email from many IPs
  const ips = new Set(recent.map(e => e.ip).filter(Boolean));
  if (ips.size > 3) {
    return 'ip_diversity';
  }

  // Content similarity: many emails with same content
  const contentMap = new Map();
  for (const e of recent) {
    const key = (e.subject || '').toLowerCase().slice(0, 30);
    contentMap.set(key, (contentMap.get(key) || 0) + 1);
  }
  for (const [, count] of contentMap) {
    if (count > 3) return 'content_repetition';
  }

  return null;
}

// ──── Reputation System ────

const reputationStore = new Map();

/**
 * Update user reputation based on events
 * @param {string} email - User email
 * @param {string} event - 'good_reply' | 'spam' | 'rate_limit' | 'phishing' | 'legitimate'
 * @returns {number} New reputation score (0-100)
 */
export function updateReputation(email, event) {
  const current = reputationStore.get(email) || 50;
  let score = current;

  switch (event) {
    case 'good_reply':
      score += 2;
      break;
    case 'legitimate':
      score += 1;
      break;
    case 'rate_limit':
      score -= 5;
      break;
    case 'spam':
      score -= 15;
      break;
    case 'phishing':
      score -= 25;
      break;
    case 'complaint':
      score -= 8;
      break;
    default:
      break;
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));
  reputationStore.set(email, score);
  return score;
}

/**
 * Get reputation level for an email
 * @param {string} email
 * @returns {number} Score 0-100
 */
export function getReputation(email) {
  return reputationStore.get(email) ?? 50;
}

/**
 * Get reputation level label
 * @param {number} score
 * @returns {string} 'trusted' | 'normal' | 'risky'
 */
export function reputationLevel(score) {
  if (score > 70) return 'trusted';
  if (score > 40) return 'normal';
  return 'risky';
}

/**
 * Get reputation info for display
 * @param {string} email
 * @returns {object} { score, level }
 */
export function getReputationInfo(email) {
  const score = getReputation(email);
  return { score, level: reputationLevel(score) };
}

// ──── Blacklist ────

const blacklist = new Set();
const blacklistReasons = new Map();

/**
 * Check if email is blacklisted (auto + manual)
 * @param {string} email
 * @param {number} [repScore] - Optional reputation score for auto-check
 * @returns {boolean}
 */
export function checkBlacklist(email, repScore) {
  // Auto-blacklist: reputation below threshold
  const score = repScore ?? getReputation(email);
  if (score < 20 && !blacklist.has(email)) {
    blacklist.add(email);
    blacklistReasons.set(email, 'auto: reputation below 20');
  }

  return blacklist.has(email);
}

/**
 * Manually blacklist an email
 * @param {string} email
 * @param {string} [reason='manual']
 */
export function blacklistEmail(email, reason = 'manual') {
  blacklist.add(email);
  blacklistReasons.set(email, reason);
}

/**
 * Remove email from blacklist
 * @param {string} email
 */
export function unblacklistEmail(email) {
  blacklist.delete(email);
  blacklistReasons.delete(email);
}

/**
 * Get blacklist info
 * @param {string} email
 * @returns {object} { blacklisted: boolean, reason?: string }
 */
export function getBlacklistInfo(email) {
  const blacklisted = blacklist.has(email);
  const reason = blacklistReasons.get(email);
  return { blacklisted, reason };
}

/**
 * Get all blacklisted emails
 * @returns {Array} [{ email, reason }]
 */
export function getBlacklistList() {
  return Array.from(blacklist).map(email => ({
    email,
    reason: blacklistReasons.get(email) || 'unknown',
  }));
}

// ──── Security Pipeline ────

/**
 * Run full security pipeline on incoming email
 * @param {object} data - { from, subject, ip, history }
 * @returns {object} { status, details }
 */
export function runSecurityPipeline(data) {
  const email = data.from || '';
  const repScore = getReputation(email);

  // 1. Blacklist check
  if (checkBlacklist(email, repScore)) {
    return {
      status: 'blocked',
      reason: 'blacklisted',
      details: getBlacklistInfo(email),
    };
  }

  // 2. Rate limit check
  const rateResult = checkRateLimit(email);
  if (!rateResult.allowed) {
    updateReputation(email, 'rate_limit');
    return {
      status: 'rate_limited',
      reason: 'too many emails',
      details: rateResult,
    };
  }

  // 3. Anomaly detection
  if (data.history && data.history.length > 0) {
    const anomaly = detectAnomaly(data.history);
    if (anomaly) {
      return {
        status: 'anomaly',
        reason: anomaly,
        details: { anomalyType: anomaly },
      };
    }
  }

  // 4. Spam pattern check
  const spamCheck = isSpamPattern(data.subject, data.body);
  if (spamCheck.isSpam) {
    updateReputation(email, 'spam');
    return {
      status: 'blocked',
      reason: 'spam_detected',
      details: { patterns: spamCheck.patterns },
    };
  }

  // 5. All clear
  if (repScore > 60) {
    updateReputation(email, 'legitimate');
  }

  return {
    status: 'ok',
    reputation: { score: repScore, level: reputationLevel(repScore) },
    rateLimit: rateResult,
  };
}

/**
 * Detect spam patterns in content
 */
function isSpamPattern(subject, body) {
  const text = `${subject} ${body || ''}`.toLowerCase();
  const patterns = [];

  const spamSignals = [
    { pattern: 'buy now', weight: 2 },
    { pattern: 'click here', weight: 1 },
    { pattern: 'free money', weight: 3 },
    { pattern: 'crypto', weight: 1 },
    { pattern: 'bitcoin', weight: 2 },
    { pattern: 'investment opportunity', weight: 3 },
    { pattern: 'act now', weight: 1 },
    { pattern: 'limited time offer', weight: 2 },
    { pattern: 'winner', weight: 1 },
    { pattern: 'congratulations you', weight: 3 },
    { pattern: 'urgent action required', weight: 2 },
    { pattern: 'your account has been', weight: 2 },
    { pattern: 'verify your identity', weight: 2 },
    { pattern: 'password reset required', weight: 1 },
    { pattern: 'lottery', weight: 3 },
    { pattern: 'inheritance', weight: 3 },
    { pattern: 'nigerian prince', weight: 3 },
    { pattern: 'enlargement', weight: 3 },
    { pattern: 'viagra', weight: 3 },
    { pattern: 'casino', weight: 2 },
  ];

  let totalWeight = 0;
  for (const { pattern, weight } of spamSignals) {
    if (text.includes(pattern)) {
      patterns.push(pattern);
      totalWeight += weight;
    }
  }

  // URL density check
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 5) {
    patterns.push('high_url_density');
    totalWeight += 2;
  }

  // All caps check
  const words = text.split(/\s+/);
  const capsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length / words.length > 0.5) {
    patterns.push('excessive_caps');
    totalWeight += 1;
  }

  return {
    isSpam: totalWeight >= 4,
    patterns,
    score: totalWeight,
  };
}

// ──── Security Stats ────

export function getSecurityStats() {
  return {
    blacklistCount: blacklist.size,
    rateLimitEntries: rateMap.size,
    reputationEntries: reputationStore.size,
    blacklisted: getBlacklistList(),
  };
}

export default {
  checkRateLimit,
  detectAnomaly,
  updateReputation,
  getReputation,
  getReputationInfo,
  reputationLevel,
  checkBlacklist,
  blacklistEmail,
  unblacklistEmail,
  getBlacklistInfo,
  getBlacklistList,
  runSecurityPipeline,
  getSecurityStats,
  cleanupRateLimits,
};
