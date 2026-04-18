/**
 * SLA + QoS Layer — Priority queues + weighted scheduling
 *
 * Tiers:
 *   free       → priority 1, best-effort, basic retry
 *   pro        → priority 5, fast sync, enhanced retry
 *   enterprise → priority 10, near-realtime, guaranteed delivery
 *
 * Rule: higher priority tenants are never starved by lower priority burst.
 */

// ──── Tier config ────
export const QOS_TIERS = Object.freeze({
  free: {
    priority:       1,
    label:          'Free',
    syncIntervalMs: 30_000,   // sync every 30s
    maxRetries:     3,
    batchSize:      5,
    rateLimitRpm:   30,       // requests per minute
    latencySla:     'best_effort',
    guaranteedDelivery: false,
  },
  pro: {
    priority:       5,
    label:          'Pro',
    syncIntervalMs: 10_000,
    maxRetries:     5,
    batchSize:      25,
    rateLimitRpm:   120,
    latencySla:     'fast',
    guaranteedDelivery: false,
  },
  enterprise: {
    priority:       10,
    label:          'Enterprise',
    syncIntervalMs: 2_000,
    maxRetries:     10,
    batchSize:      100,
    rateLimitRpm:   600,
    latencySla:     'near_realtime',
    guaranteedDelivery: true,
  },
});

// ──── Priority Queue (server-side) ────
// Min-heap by priority (higher = processed first)
class PriorityQueue {
  constructor() { this._heap = []; }

  enqueue(item, priority) {
    this._heap.push({ item, priority });
    this._heap.sort((a, b) => b.priority - a.priority); // highest first
  }

  dequeue() {
    return this._heap.shift()?.item ?? null;
  }

  peek() { return this._heap[0]?.item ?? null; }
  size() { return this._heap.length; }
  isEmpty() { return this._heap.length === 0; }
}

// Global sync queue (one per tier)
const _queues = {
  enterprise: new PriorityQueue(),
  pro:        new PriorityQueue(),
  free:       new PriorityQueue(),
};

// ──── Weighted Scheduler ────
// Processes enterprise:pro:free in 5:2:1 ratio to prevent starvation.
const WEIGHTS = { enterprise: 5, pro: 2, free: 1 };
let _scheduleCounter = 0;

/**
 * Enqueue a batch for processing.
 * @param {string} tenantId
 * @param {string} tier - 'free' | 'pro' | 'enterprise'
 * @param {object} batch - { events, tenantId }
 */
export function enqueueBatch(tenantId, tier, batch) {
  const config = QOS_TIERS[tier] ?? QOS_TIERS.free;
  _queues[tier]?.enqueue({ ...batch, tenantId, tier, enqueuedAt: Date.now() }, config.priority);
}

/**
 * Dequeue next batch according to weighted schedule.
 * Called by the worker loop.
 * @returns {object|null}
 */
export function dequeueNext() {
  _scheduleCounter++;

  // Weighted round-robin
  if (_scheduleCounter % 8 < 5 && !_queues.enterprise.isEmpty()) return _queues.enterprise.dequeue();
  if (_scheduleCounter % 8 < 7 && !_queues.pro.isEmpty())        return _queues.pro.dequeue();
  if (!_queues.free.isEmpty())                                     return _queues.free.dequeue();

  // Fallback: any non-empty queue
  for (const q of [_queues.enterprise, _queues.pro, _queues.free]) {
    if (!q.isEmpty()) return q.dequeue();
  }

  return null;
}

export function getQueueDepths() {
  return { enterprise: _queues.enterprise.size(), pro: _queues.pro.size(), free: _queues.free.size() };
}

// ──── Rate Limiter (per tenant) ────
const _rateBuckets = new Map(); // tenantId → { count, windowStart }

/**
 * Check if a tenant is within their rate limit.
 * Returns true if allowed, false if rate limited.
 *
 * @param {string} tenantId
 * @param {string} tier
 */
export function checkRateLimit(tenantId, tier) {
  const config = QOS_TIERS[tier] ?? QOS_TIERS.free;
  const now    = Date.now();
  const window = 60_000; // 1 minute

  let bucket = _rateBuckets.get(tenantId);
  if (!bucket || now - bucket.windowStart > window) {
    bucket = { count: 0, windowStart: now };
  }

  if (bucket.count >= config.rateLimitRpm) {
    _rateBuckets.set(tenantId, bucket);
    return false; // rate limited
  }

  bucket.count++;
  _rateBuckets.set(tenantId, bucket);
  return true;
}

// ──── SLA Tracker ────
const _slaStats = new Map(); // tenantId → { ingestion_ms[], sync_success, sync_total }

/**
 * Record an ingestion latency sample for SLA tracking.
 */
export function recordIngestionLatency(tenantId, latencyMs) {
  if (!_slaStats.has(tenantId)) {
    _slaStats.set(tenantId, { ingestion_ms: [], sync_success: 0, sync_total: 0, risk_ms: [] });
  }
  const stats = _slaStats.get(tenantId);
  stats.ingestion_ms.push(latencyMs);
  if (stats.ingestion_ms.length > 1000) stats.ingestion_ms.shift(); // rolling window
}

export function recordSyncOutcome(tenantId, success) {
  if (!_slaStats.has(tenantId)) {
    _slaStats.set(tenantId, { ingestion_ms: [], sync_success: 0, sync_total: 0, risk_ms: [] });
  }
  const stats = _slaStats.get(tenantId);
  stats.sync_total++;
  if (success) stats.sync_success++;
}

export function recordRiskLatency(tenantId, latencyMs) {
  const stats = _slaStats.get(tenantId);
  if (!stats) return;
  stats.risk_ms.push(latencyMs);
  if (stats.risk_ms.length > 1000) stats.risk_ms.shift();
}

/**
 * Get SLA report for a tenant.
 */
export function getSlaReport(tenantId) {
  const stats = _slaStats.get(tenantId);
  if (!stats) return null;

  const p = (arr, pct) => {
    if (arr.length === 0) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * pct)] ?? sorted[sorted.length - 1];
  };

  return {
    tenantId,
    ingestion: {
      p50: p(stats.ingestion_ms, 0.5),
      p95: p(stats.ingestion_ms, 0.95),
      p99: p(stats.ingestion_ms, 0.99),
    },
    sync: {
      successRate: stats.sync_total > 0 ? +(stats.sync_success / stats.sync_total).toFixed(4) : null,
      total: stats.sync_total,
    },
    risk: {
      p50: p(stats.risk_ms, 0.5),
      p95: p(stats.risk_ms, 0.95),
    },
  };
}

// ──── Express Middleware ────

/**
 * Middleware: attach tier + enforce rate limit.
 * Reads tier from req.user.subscriptionPlan or header.
 */
export function qosMiddleware(req, res, next) {
  const plan = req.user?.subscriptionPlan ?? req.headers['x-tenant-tier'] ?? 'free';
  const tier = ['free', 'pro', 'enterprise'].includes(plan) ? plan : 'free';

  req.qosTier   = tier;
  req.qosConfig = QOS_TIERS[tier];

  const tenantId = req.tenantId ?? 'default';
  if (!checkRateLimit(tenantId, tier)) {
    return res.status(429).json({
      error:   'rate_limit_exceeded',
      tier,
      limitRpm: QOS_TIERS[tier].rateLimitRpm,
      retryAfter: 60,
    });
  }

  next();
}

export default { QOS_TIERS, enqueueBatch, dequeueNext, getQueueDepths, checkRateLimit, recordIngestionLatency, recordSyncOutcome, recordRiskLatency, getSlaReport, qosMiddleware };
