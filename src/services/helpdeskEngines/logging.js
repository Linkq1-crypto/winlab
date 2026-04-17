/**
 * Logging Engine — Foundation for all analytics
 * Every interaction is logged for insights, bug detection, churn prediction
 */

const logs = [];
const MAX_LOGS = 50000; // Keep last 50K in memory (upgrade to DB later)

/**
 * Save a log entry
 * @param {object} entry
 * @param {string} entry.emailId - Email/ticket ID
 * @param {string} entry.from - Sender email
 * @param {string} entry.subject - Email subject
 * @param {string} entry.input - Original email text
 * @param {string} [entry.aiReply] - AI suggested reply
 * @param {string} [entry.finalReply] - Final sent reply
 * @param {boolean} [entry.edited] - Was AI reply edited?
 * @param {number} [entry.confidence] - AI confidence 0-1
 * @param {string} [entry.decision] - auto/draft/manual/block
 * @param {string} [entry.trust] - trust level
 * @param {number} [entry.trustScore] - trust score 0-100
 * @param {string} [entry.intent] - Detected intent
 * @param {string} [entry.team] - Team name
 * @param {string} [entry.language] - Language code
 * @param {string} [entry.anomaly] - Anomaly type if detected
 * @param {string} [entry.securityStatus] - Security pipeline result
 * @param {number} [entry.reputation] - Sender reputation score
 * @param {string} [entry.plan] - User plan (free/pro/business)
 * @param {string} [entry.deployVersion] - Current deploy version
 */
export function saveLog(entry) {
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    ...entry,
  };

  logs.unshift(log);

  // Trim old logs
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }

  return log;
}

/**
 * Get logs with filters
 * @param {object} [filters]
 * @param {number} [filters.hours] - Last N hours
 * @param {number} [filters.days] - Last N days
 * @param {string} [filters.intent] - Intent filter
 * @param {string} [filters.decision] - Decision filter
 * @param {string} [filters.trust] - Trust level filter
 * @param {string} [filters.anomaly] - Anomaly filter
 * @returns {Array}
 */
export function getLogs(filters = {}) {
  let result = logs;

  if (filters.hours) {
    const cutoff = Date.now() - filters.hours * 60 * 60 * 1000;
    result = result.filter(l => l.timestamp >= cutoff);
  }

  if (filters.days) {
    const cutoff = Date.now() - filters.days * 24 * 60 * 60 * 1000;
    result = result.filter(l => l.timestamp >= cutoff);
  }

  if (filters.intent) {
    result = result.filter(l => l.intent === filters.intent);
  }

  if (filters.decision) {
    result = result.filter(l => l.decision === filters.decision);
  }

  if (filters.trust) {
    result = result.filter(l => l.trust === filters.trust);
  }

  if (filters.anomaly) {
    result = result.filter(l => l.anomaly === filters.anomaly);
  }

  return result;
}

/**
 * Get logs for a specific email/user
 * @param {string} email
 * @param {number} [limit=50]
 * @returns {Array}
 */
export function getUserLogs(email, limit = 50) {
  return logs
    .filter(l => l.from?.toLowerCase().includes(email.toLowerCase()))
    .slice(0, limit);
}

/**
 * Aggregate logs by time series
 * @param {string} granularity - 'hour' | 'day'
 * @param {number} [days=7]
 * @returns {Array} [{ date, count, autoCount, draftCount, blockCount, avgConfidence }]
 */
export function getTimeSeries(granularity = 'day', days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = logs.filter(l => l.timestamp >= cutoff);

  // Group by time bucket
  const buckets = {};
  for (const log of recent) {
    const date = new Date(log.timestamp);
    const key = granularity === 'hour'
      ? `${date.toISOString().slice(0, 13)}`
      : date.toISOString().slice(0, 10);

    if (!buckets[key]) {
      buckets[key] = { count: 0, autoCount: 0, draftCount: 0, blockCount: 0, confidenceSum: 0, confidenceCount: 0 };
    }

    buckets[key].count += 1;
    if (log.decision === 'auto') buckets[key].autoCount += 1;
    if (log.decision === 'draft') buckets[key].draftCount += 1;
    if (log.decision === 'block' || log.decision === 'blocked') buckets[key].blockCount += 1;
    if (log.confidence != null) {
      buckets[key].confidenceSum += log.confidence;
      buckets[key].confidenceCount += 1;
    }
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      count: data.count,
      autoCount: data.autoCount,
      draftCount: data.draftCount,
      blockCount: data.blockCount,
      avgConfidence: data.confidenceCount > 0
        ? Math.round((data.confidenceSum / data.confidenceCount) * 100) / 100
        : 0,
    }));
}

/**
 * Aggregate logs by field
 * @param {string} field - Field to group by (intent, team, trust, language, decision)
 * @param {object} [filters]
 * @returns {Array} [{ label, count, percentage }]
 */
export function groupByField(field, filters = {}) {
  const filtered = getLogs(filters);
  const groups = {};

  for (const log of filtered) {
    const key = log[field] || 'unknown';
    groups[key] = (groups[key] || 0) + 1;
  }

  const total = filtered.length || 1;
  return Object.entries(groups)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

/**
 * Calculate KPIs from logs
 * @param {object} [filters]
 * @returns {object}
 */
export function calculateKPIs(filters = { days: 7 }) {
  const filtered = getLogs(filters);

  const total = filtered.length;
  const autoCount = filtered.filter(l => l.decision === 'auto').length;
  const draftCount = filtered.filter(l => l.decision === 'draft').length;
  const blockCount = filtered.filter(l => l.decision === 'block' || l.decision === 'blocked').length;
  const manualCount = filtered.filter(l => l.decision === 'manual').length;

  const editedCount = filtered.filter(l => l.edited).length;
  const aiCount = filtered.filter(l => l.aiReply).length;

  const avgConfidence = filtered.filter(l => l.confidence != null).length > 0
    ? filtered.filter(l => l.confidence != null).reduce((s, l) => s + l.confidence, 0) /
      filtered.filter(l => l.confidence != null).length
    : 0;

  const editRate = aiCount > 0 ? editedCount / aiCount : 0;
  const autoRate = total > 0 ? autoCount / total : 0;

  const avgTrustScore = filtered.filter(l => l.trustScore != null).length > 0
    ? filtered.filter(l => l.trustScore != null).reduce((s, l) => s + l.trustScore, 0) /
      filtered.filter(l => l.trustScore != null).length
    : 0;

  const anomalyCount = filtered.filter(l => l.anomaly).length;

  return {
    total,
    autoCount,
    draftCount,
    blockCount,
    manualCount,
    autoRate: Math.round(autoRate * 100),
    editRate: Math.round(editRate * 100),
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    avgTrustScore: Math.round(avgTrustScore),
    anomalyCount,
  };
}

/**
 * Get log count
 * @returns {number}
 */
export function getLogCount() {
  return logs.length;
}

/**
 * Clear old logs (for maintenance)
 * @param {number} maxAge - Max age in ms
 */
export function pruneLogs(maxAge = 30 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAge;
  const before = logs.length;
  const filtered = logs.filter(l => l.timestamp >= cutoff);
  logs.length = 0;
  logs.push(...filtered);
  return { before, after: logs.length };
}

export default { saveLog, getLogs, getUserLogs, getTimeSeries, groupByField, calculateKPIs, getLogCount, pruneLogs };
