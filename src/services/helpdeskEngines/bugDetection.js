/**
 * Bug Detection Engine — Spike analysis + deploy correlation
 * Detects product issues from support ticket patterns
 */

// ──── Deploy Tracking ────
const deploys = [];

/**
 * Record a deploy event
 * @param {object} params
 * @param {string} params.version - Version string (e.g. "v1.2.3")
 * @param {string} [params.environment] - prod/staging
 * @param {string} [params.deployedBy] - Who deployed
 * @param {Array} [params.changes] - List of changes
 */
export function recordDeploy(params) {
  const deploy = {
    version: params.version,
    environment: params.environment || 'prod',
    deployedBy: params.deployedBy || 'unknown',
    changes: params.changes || [],
    timestamp: Date.now(),
  };

  deploys.push(deploy);

  // Keep last 100 deploys
  if (deploys.length > 100) deploys.splice(0, deploys.length - 100);

  return deploy;
}

/**
 * Get recent deploys
 * @param {number} [hours=48]
 * @returns {Array}
 */
export function getRecentDeploys(hours = 48) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return deploys.filter(d => d.timestamp >= cutoff);
}

/**
 * Find the deploy that was active at a given timestamp
 * @param {number} timestamp
 * @returns {object|null}
 */
export function findDeployAt(timestamp) {
  let activeDeploy = null;
  for (const d of deploys) {
    if (d.timestamp <= timestamp) {
      if (!activeDeploy || d.timestamp > activeDeploy.timestamp) {
        activeDeploy = d;
      }
    }
  }
  return activeDeploy;
}

// ──── Baseline Calculation ────

/**
 * Calculate baseline for an intent over N days
 * @param {Array} logs - All logs
 * @param {string} intent
 * @param {number} [days=7]
 * @returns {object} { avg: number, stddev: number, daily: Array }
 */
function calculateBaseline(logs, intent, days = 7) {
  const dayBuckets = {};
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  for (const log of logs) {
    if (log.timestamp < cutoff) continue;
    if (intent && log.intent !== intent) continue;

    const day = new Date(log.timestamp).toISOString().slice(0, 10);
    dayBuckets[day] = (dayBuckets[day] || 0) + 1;
  }

  const daily = Object.entries(dayBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const counts = daily.map(d => d.count);
  const avg = counts.length > 0 ? counts.reduce((s, c) => s + c, 0) / counts.length : 0;
  const variance = counts.length > 1
    ? counts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / (counts.length - 1)
    : 0;
  const stddev = Math.sqrt(variance);

  return { avg, stddev, daily };
}

/**
 * Detect spike in ticket volume
 * @param {Array} logs - All logs
 * @param {string} [intent] - Specific intent or all
 * @param {number} [hours=2] - Current window in hours
 * @param {number} [baselineDays=7] - Baseline days
 * @param {number} [threshold] - Spike multiplier (default: 2x stddev)
 * @returns {object|null} Spike info or null
 */
export function detectSpike(logs, intent, hours = 2, baselineDays = 7, threshold) {
  const now = Date.now();
  const currentWindow = now - hours * 60 * 60 * 1000;
  const baselineCutoff = now - baselineDays * 24 * 60 * 60 * 1000;

  // Current count
  const currentLogs = logs.filter(l =>
    l.timestamp >= currentWindow &&
    (!intent || l.intent === intent)
  );
  const currentCount = currentLogs.length;

  // Baseline
  const baseline = calculateBaseline(logs, intent, baselineDays);
  const spikeThreshold = threshold ?? baseline.avg + 2 * baseline.stddev;

  if (currentCount >= Math.max(spikeThreshold, baseline.avg * 2)) {
    // Find related deploy
    const activeDeploy = findDeployAt(currentWindow);

    const increase = baseline.avg > 0
      ? Math.round(((currentCount / (hours / 24)) - baseline.avg) / baseline.avg * 100)
      : 0;

    return {
      detected: true,
      intent: intent || 'all',
      currentCount,
      baselineAvg: Math.round(baseline.avg * 10) / 10,
      baselineStddev: Math.round(baseline.stddev * 10) / 10,
      increasePercent: increase,
      windowHours: hours,
      deployCorrelation: activeDeploy ? {
        version: activeDeploy.version,
        deployedAt: new Date(activeDeploy.timestamp).toISOString(),
        timeSinceDeploy: `${Math.round((now - activeDeploy.timestamp) / 60000)} min`,
      } : null,
      severity: increase > 200 ? 'critical' : increase > 100 ? 'high' : 'medium',
      sampleEmails: currentLogs.slice(0, 5).map(l => ({
        from: l.from,
        subject: l.subject,
        timestamp: l.timestamp,
      })),
    };
  }

  return null;
}

/**
 * Detect spikes across all intents
 * @param {Array} logs
 * @param {object} [opts]
 * @returns {Array} Detected spikes
 */
export function detectAllSpikes(logs, opts = {}) {
  const intents = [...new Set(logs.map(l => l.intent).filter(Boolean))];
  const spikes = [];

  for (const intent of intents) {
    const spike = detectSpike(logs, intent, opts.hours, opts.baselineDays, opts.threshold);
    if (spike) spikes.push(spike);
  }

  // Also check overall volume
  const overall = detectSpike(logs, null, opts.hours, opts.baselineDays, opts.threshold);
  if (overall) spikes.push(overall);

  spikes.sort((a, b) => b.increasePercent - a.increasePercent);
  return spikes;
}

/**
 * Check if recent spike correlates with a deploy
 * @param {object} spike
 * @returns {boolean}
 */
export function isDeployRelated(spike) {
  if (!spike.deployCorrelation) return false;
  const deployTime = new Date(spike.deployCorrelation.deployedAt).getTime();
  return (Date.now() - deployTime) < 4 * 60 * 60 * 1000; // Within 4 hours
}

/**
 * Get deploy impact report
 * @param {string} version
 * @param {Array} logs
 * @returns {object}
 */
export function getDeployImpact(version, logs) {
  const deploy = deploys.find(d => d.version === version);
  if (!deploy) return { error: 'Deploy not found' };

  const deployTime = deploy.timestamp;
  const window = 24 * 60 * 60 * 1000; // 24h

  // Before deploy (same window)
  const beforeLogs = logs.filter(l =>
    l.timestamp >= deployTime - window && l.timestamp < deployTime
  );

  // After deploy
  const afterLogs = logs.filter(l =>
    l.timestamp >= deployTime && l.timestamp < deployTime + window
  );

  // Compare
  const beforeCount = beforeLogs.length;
  const afterCount = afterLogs.length;
  const change = beforeCount > 0
    ? Math.round((afterCount - beforeCount) / beforeCount * 100)
    : 0;

  // Intent breakdown
  const intentBefore = {};
  const intentAfter = {};
  for (const l of beforeLogs) intentBefore[l.intent] = (intentBefore[l.intent] || 0) + 1;
  for (const l of afterLogs) intentAfter[l.intent] = (intentAfter[l.intent] || 0) + 1;

  return {
    version,
    deployedAt: new Date(deployTime).toISOString(),
    deployedBy: deploy.deployedBy,
    beforeCount,
    afterCount,
    changePercent: change,
    intents: {
      before: intentBefore,
      after: intentAfter,
    },
  };
}

/**
 * Get deploy history
 * @returns {Array}
 */
export function getDeployHistory() {
  return deploys
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(d => ({
      version: d.version,
      environment: d.environment,
      deployedBy: d.deployedBy,
      deployedAt: new Date(d.timestamp).toISOString(),
    }));
}

export default {
  recordDeploy,
  getRecentDeploys,
  findDeployAt,
  detectSpike,
  detectAllSpikes,
  isDeployRelated,
  getDeployImpact,
  getDeployHistory,
};
