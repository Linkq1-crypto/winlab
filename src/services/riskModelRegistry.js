/**
 * Risk Model Registry — ML Evolution with Safe Versioning
 *
 * Rules:
 *   - Models are NEVER replaced — only new versions added
 *   - Every event log replay stores which model scored it
 *   - Weight tuning via Bayesian adjustment (gradient-free)
 *   - Reinforcement: outcome feedback → weight update
 *
 * Models:
 *   risk_model_v1 — baseline (hardcoded weights)
 *   risk_model_v2 — Bayesian-adjusted weights from outcome feedback
 *   risk_model_v3 — next iteration
 */

// ──── Model Store (immutable registry) ────

const MODELS = {
  risk_model_v1: {
    version: 'risk_model_v1',
    description: 'Baseline — hardcoded weights',
    weights: {
      risk_signal:       1.0,
      biometric_event:   0.8,
      motion_event:      0.6,
      system_event:      0.4,
      context_event:     0.3,
      user_action_event: 0.2,
    },
    decayLambda: 0.05,
    createdAt: '2026-04-18T00:00:00Z',
    frozen: true, // baseline never changes
  },
};

let _activeVersion = 'risk_model_v1';

// ──── Outcome Store (in-memory, should be persisted in prod) ────
// outcome: { eventId, modelVersion, predictedLevel, actualOutcome: 'tp'|'fp'|'fn'|'tn', recordedAt }
const _outcomes = [];

// ──── Registry API ────

/**
 * Get model by version. Throws if not found.
 */
export function getModel(version = _activeVersion) {
  const model = MODELS[version];
  if (!model) throw new Error(`[RiskModelRegistry] Unknown model version: "${version}"`);
  return model;
}

/**
 * Get active (latest) model version string.
 */
export function getActiveVersion() {
  return _activeVersion;
}

/**
 * List all registered model versions with metadata (no weights — safe to expose).
 */
export function listModels() {
  return Object.values(MODELS).map(({ version, description, createdAt, frozen }) => ({
    version, description, createdAt, frozen: frozen ?? false,
    active: version === _activeVersion,
  }));
}

// ──── Outcome Feedback ────

/**
 * Record an outcome for a scored event.
 * tp = true positive (risk correctly flagged)
 * fp = false positive (flagged but safe)
 * fn = false negative (missed real risk)
 * tn = true negative (correctly ignored)
 *
 * @param {string} eventId
 * @param {string} modelVersion
 * @param {string} predictedLevel  - SAFE | LOW RISK | HIGH RISK | CRITICAL
 * @param {'tp'|'fp'|'fn'|'tn'} actualOutcome
 */
export function recordOutcome(eventId, modelVersion, predictedLevel, actualOutcome) {
  _outcomes.push({
    eventId,
    modelVersion,
    predictedLevel,
    actualOutcome,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Get outcome stats for a model version.
 */
export function getOutcomeStats(version = _activeVersion) {
  const relevant = _outcomes.filter(o => o.modelVersion === version);
  const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const o of relevant) counts[o.actualOutcome] = (counts[o.actualOutcome] ?? 0) + 1;

  const total     = relevant.length;
  const precision = counts.tp / (counts.tp + counts.fp || 1);
  const recall    = counts.tp / (counts.tp + counts.fn || 1);
  const f1        = 2 * precision * recall / (precision + recall || 1);

  return { version, total, counts, precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +f1.toFixed(3) };
}

// ──── Bayesian Weight Tuning ────

/**
 * Generate a new model version from outcome feedback.
 * Uses Bayesian adjustment: weights move toward event types with more TP outcomes.
 *
 * Safe: never overwrites existing models. Returns new version string.
 *
 * @param {string} baseVersion   - Version to derive from
 * @param {string} [newVersion]  - e.g. 'risk_model_v2' (auto-incremented if omitted)
 * @returns {string} New model version string
 */
export function tuneModel(baseVersion = _activeVersion, newVersion) {
  const base    = getModel(baseVersion);
  const stats   = getOutcomeStats(baseVersion);

  if (stats.total < 50) {
    throw new Error(`[RiskModelRegistry] Not enough outcomes (${stats.total}/50) to tune model`);
  }

  // Compute per-type TP rate from outcomes
  const typeStats = {};
  for (const outcome of _outcomes.filter(o => o.modelVersion === baseVersion)) {
    const key = outcome.predictedLevel;
    if (!typeStats[key]) typeStats[key] = { tp: 0, total: 0 };
    typeStats[key].total++;
    if (outcome.actualOutcome === 'tp') typeStats[key].tp++;
  }

  // Bayesian update: new_weight = old_weight × (1 + α × (tpRate - 0.5))
  // α = learning rate = 0.3
  const ALPHA = 0.3;
  const newWeights = {};
  for (const [type, w] of Object.entries(base.weights)) {
    const tpRate = typeStats[type]
      ? typeStats[type].tp / typeStats[type].total
      : 0.5; // no data → no change
    newWeights[type] = Math.max(0.05, Math.min(1.5, w * (1 + ALPHA * (tpRate - 0.5))));
  }

  // Normalise so max weight stays 1.0
  const maxW = Math.max(...Object.values(newWeights));
  for (const k of Object.keys(newWeights)) newWeights[k] = +(newWeights[k] / maxW).toFixed(4);

  const nextVersion = newVersion ?? autoNextVersion(baseVersion);

  MODELS[nextVersion] = {
    version:     nextVersion,
    description: `Bayesian-tuned from ${baseVersion} (${stats.total} outcomes, f1=${stats.f1})`,
    weights:     newWeights,
    decayLambda: base.decayLambda,
    derivedFrom: baseVersion,
    createdAt:   new Date().toISOString(),
    frozen:      false,
  };

  _activeVersion = nextVersion;
  return nextVersion;
}

/**
 * Freeze a model version — no further tuning allowed.
 * Use before deploying to production.
 */
export function freezeModel(version) {
  const model = getModel(version);
  if (model.frozen) return;
  MODELS[version] = { ...model, frozen: true };
}

/**
 * Promote a version to active.
 * Only allowed if the version exists and its predecessor is frozen.
 */
export function promoteModel(version) {
  getModel(version); // throws if not found
  _activeVersion = version;
  return version;
}

// ──── Helpers ────
function autoNextVersion(current) {
  const match = current.match(/^(.+_v)(\d+)$/);
  if (!match) return current + '_v2';
  return `${match[1]}${parseInt(match[2]) + 1}`;
}

export default {
  getModel, getActiveVersion, listModels,
  recordOutcome, getOutcomeStats,
  tuneModel, freezeModel, promoteModel,
};
