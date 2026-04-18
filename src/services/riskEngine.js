/**
 * Risk Engine — Pure function, no mutable state.
 * score = f(events, context)  →  same input = same output, always.
 *
 * Formula: RiskScore = Σ (Wi × Si × Ci × Ti)
 *   Wi = event weight (type-specific)
 *   Si = severity (from event payload, 0–1)
 *   Ci = confidence (from event payload, 0–1)
 *   Ti = recency decay: e^(-λ × Δt_minutes)
 */

export const RISK_MODEL_VERSION = 'risk_model_v1';

// ──── Model weights (resolved at call time from registry if available) ────
async function resolveWeights(modelVersion) {
  try {
    const { getModel } = await import('./riskModelRegistry.js');
    return getModel(modelVersion).weights;
  } catch {
    return EVENT_WEIGHTS; // fallback to hardcoded
  }
}

// ──── Thresholds ────
export const RISK_LEVELS = Object.freeze({
  SAFE:     { min: 0,  max: 20,  label: 'SAFE',     color: 'green'  },
  LOW:      { min: 21, max: 50,  label: 'LOW RISK',  color: 'yellow' },
  HIGH:     { min: 51, max: 75,  label: 'HIGH RISK', color: 'orange' },
  CRITICAL: { min: 76, max: 100, label: 'CRITICAL',  color: 'red'    },
});

// ──── Event Weights (Wi) ────
// Higher = more impact on risk score
const EVENT_WEIGHTS = Object.freeze({
  risk_signal:      1.0,
  biometric_event:  0.8,
  motion_event:     0.6,
  system_event:     0.4,
  context_event:    0.3,
  user_action_event:0.2,
});

// ──── Recency Decay ────
// λ = decay rate per minute. Higher = older events matter less.
const DECAY_LAMBDA = 0.05;

function recencyDecay(eventTimestampMs, nowMs = Date.now()) {
  const deltaMinutes = Math.max(0, (nowMs - eventTimestampMs) / 60_000);
  return Math.exp(-DECAY_LAMBDA * deltaMinutes);
}

// ──── Score Normalisation ────
// Raw sum is unbounded; cap at 100 with a logistic squeeze above 80.
function normalise(rawScore) {
  if (rawScore <= 0) return 0;
  // Linear up to 80, then sigmoid squeeze to 100
  if (rawScore <= 80) return Math.min(80, rawScore);
  const excess = rawScore - 80;
  return Math.min(100, 80 + 20 * (1 - Math.exp(-excess / 20)));
}

// ──── Level Classifier ────
export function classifyScore(score) {
  for (const level of Object.values(RISK_LEVELS)) {
    if (score >= level.min && score <= level.max) return level;
  }
  return RISK_LEVELS.SAFE;
}

// ──── Core: Pure Risk Scorer ────
/**
 * Calculate risk score from an ordered event array.
 * @param {object[]} events - Ordered event log (ascending sequence)
 * @param {object}   [ctx]  - Environmental context overrides
 * @param {number}   [ctx.networkPenalty=0] - Extra score for degraded network (0–10)
 * @param {number}   [ctx.batteryPenalty=0] - Extra score for low battery (0–10)
 * @param {number}   [nowMs]               - Reference time (default: Date.now())
 * @returns {{ score: number, level: object, breakdown: object[], model: string }}
 */
export function calculateRiskScore(events, ctx = {}, nowMs = Date.now(), modelVersion = RISK_MODEL_VERSION) {
  const { networkPenalty = 0, batteryPenalty = 0 } = ctx;

  const breakdown = [];
  let rawSum = 0;

  for (const event of events) {
    const type  = event.event_type ?? event.type ?? '';
    const Wi    = EVENT_WEIGHTS[type] ?? 0.1; // registry weights loaded async in calculateRiskScoreAsync
    const Si    = clamp(event.payload?.severity  ?? event.payload?.data?.severity  ?? 0.5);
    const Ci    = clamp(event.payload?.confidence ?? event.payload?.data?.confidence ?? 0.7);
    const Ti    = recencyDecay(event.timestamp, nowMs);
    const term  = Wi * Si * Ci * Ti * 100;

    rawSum += term;
    breakdown.push({ event_id: event.event_id ?? event.id, type, Wi, Si, Ci, Ti: +Ti.toFixed(4), term: +term.toFixed(2) });
  }

  // Environmental context modifiers
  rawSum += clamp(networkPenalty, 0, 10);
  rawSum += clamp(batteryPenalty, 0, 10);

  const score = Math.round(normalise(rawSum));
  const level = classifyScore(score);

  return {
    score,
    level,
    breakdown,
    model: modelVersion,
    computed_at: nowMs,
  };
}

/**
 * Async variant — loads weights from model registry (supports v2, v3, ...).
 * Use this in the server intelligence layer.
 */
export async function calculateRiskScoreAsync(events, ctx = {}, nowMs = Date.now(), modelVersion = RISK_MODEL_VERSION) {
  const weights = await resolveWeights(modelVersion);
  const { networkPenalty = 0, batteryPenalty = 0 } = ctx;
  const breakdown = [];
  let rawSum = 0;

  for (const event of events) {
    const type = event.event_type ?? event.type ?? '';
    const Wi   = weights[type] ?? 0.1;
    const Si   = clamp(event.payload?.severity ?? event.payload?.data?.severity ?? 0.5);
    const Ci   = clamp(event.payload?.confidence ?? event.payload?.data?.confidence ?? 0.7);
    const Ti   = recencyDecay(event.timestamp, nowMs);
    const term = Wi * Si * Ci * Ti * 100;

    rawSum += term;
    breakdown.push({ event_id: event.event_id ?? event.id, type, Wi, Si, Ci, Ti: +Ti.toFixed(4), term: +term.toFixed(2) });
  }

  rawSum += clamp(networkPenalty, 0, 10);
  rawSum += clamp(batteryPenalty, 0, 10);

  const score = Math.round(normalise(rawSum));
  const level = classifyScore(score);

  return { score, level, breakdown, model: modelVersion, computed_at: nowMs };
}

// ──── Decision System ────
/**
 * Map a risk level to the required action.
 * @param {object} level - Output of classifyScore()
 * @returns {string}
 */
export function decideAction(level) {
  const actions = {
    SAFE:     'log_only',
    'LOW RISK':  'haptic_check',
    'HIGH RISK': 'continuous_monitoring',
    CRITICAL: 'emergency_escalation',
  };
  return actions[level.label] ?? 'log_only';
}

// ──── Helpers ────
function clamp(val, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(val) || 0));
}
