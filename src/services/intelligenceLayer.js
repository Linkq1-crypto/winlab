/**
 * Intelligence Layer — Unified pipeline, stateless.
 *
 * This is the ONLY layer allowed to:
 *   - read the central event log for analytics/decisions
 *   - call the state rebuild engine
 *   - call the risk engine
 *   - dispatch alerts
 *
 * INPUT:  event log (ordered array from central store)
 * OUTPUT: { state, risk, decision, alerts, meta }
 *
 * No other layer may duplicate this logic.
 * No mutable state inside this module.
 *
 * Data flow:
 *   Central Event Store
 *        ↓
 *   [intelligenceLayer]
 *        ↓  rebuildState()
 *   Rebuilt State
 *        ↓  calculateRiskScore()
 *   Risk Score + Level
 *        ↓  decide()
 *   Decision + Alerts
 */

import { rebuildState, rebuildUserState } from './stateRebuildEngine.js';
import { calculateRiskScore, classifyScore, decideAction, RISK_MODEL_VERSION } from './riskEngine.js';

// ──── Alert severity mapping (bridge to existing alertDispatcher) ────
const LEVEL_TO_SEVERITY = {
  SAFE:       'INFO',
  'LOW RISK': 'WARN',
  'HIGH RISK':'WARN',
  CRITICAL:   'CRITICAL',
};

// ──── Core Pipeline ────

/**
 * Run the full intelligence pipeline on an ordered event array.
 * Pure function — same input always produces same output.
 *
 * @param {object[]} events - Ordered event log (central store)
 * @param {object}   [ctx]  - Environmental context
 * @param {number}   [ctx.networkPenalty=0]
 * @param {number}   [ctx.batteryPenalty=0]
 * @param {number}   [nowMs] - Reference time (default: Date.now())
 * @returns {IntelligenceResult}
 */
export function runIntelligence(events, ctx = {}, nowMs = Date.now()) {
  // 1. Rebuild state from event log — deterministic
  const { state, eventsApplied, lastEventId } = rebuildState(events);

  // 2. Score risk — pure function over events
  const risk = calculateRiskScore(events, ctx, nowMs);

  // 3. Decide action
  const action = decideAction(risk.level);

  // 4. Build alerts list (one per user at CRITICAL/HIGH)
  const alerts = buildAlerts(state, risk, action, nowMs);

  return {
    state,
    risk,
    decision: {
      action,
      level:      risk.level.label,
      color:      risk.level.color,
      score:      risk.score,
      model:      RISK_MODEL_VERSION,
      decidedAt:  nowMs,
    },
    alerts,
    meta: {
      eventsApplied,
      lastEventId,
      computedAt: nowMs,
    },
  };
}

/**
 * Run intelligence for a single user — cheaper than full rebuild.
 *
 * @param {object[]} events - All events for this userId (pre-filtered)
 * @param {string}   userId
 * @param {object}   [ctx]
 * @param {number}   [nowMs]
 * @returns {IntelligenceResult}
 */
export function runUserIntelligence(events, userId, ctx = {}, nowMs = Date.now()) {
  const userState = rebuildUserState(events, userId);

  const risk    = calculateRiskScore(events, ctx, nowMs);
  const action  = decideAction(risk.level);
  const alerts  = buildUserAlerts(userId, userState, risk, action, nowMs);

  return {
    userId,
    userState,
    risk,
    decision: {
      action,
      level:     risk.level.label,
      color:     risk.level.color,
      score:     risk.score,
      model:     RISK_MODEL_VERSION,
      decidedAt: nowMs,
    },
    alerts,
    meta: { eventsApplied: events.length, computedAt: nowMs },
  };
}

// ──── Server-side Trigger ────

/**
 * Load events from DB and run the intelligence pipeline for a device.
 * Called asynchronously after the sync endpoint ingests new events.
 * Fire-and-forget — errors are logged, not thrown.
 *
 * @param {string}   deviceId  - Edge device identifier
 * @param {object}   [ctx]     - Environmental context from last sync
 * @param {Function} [onAlert] - Optional callback to handle generated alerts
 */
export async function processDeviceEvents(deviceId, ctx = {}, onAlert) {
  try {
    const { default: prisma } = await import('../api/db/prisma.js');

    // Load ordered event log for this device from central store
    const events = await prisma.event.findMany({
      where: {
        payload: { contains: `"device_id":"${deviceId}"` },
        status:  { not: 'failed' },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (events.length === 0) return null;

    const result = runIntelligence(events, ctx);

    // Dispatch alerts for non-SAFE levels
    if (result.decision.action !== 'log_only' && onAlert) {
      for (const alert of result.alerts) {
        await onAlert(alert).catch(err =>
          console.error('[Intelligence] Alert dispatch failed:', err.message)
        );
      }
    }

    return result;
  } catch (err) {
    console.error(`[Intelligence] processDeviceEvents failed for ${deviceId}:`, err.message);
    return null;
  }
}

/**
 * Load events from DB and run intelligence for a specific user.
 *
 * @param {string}   userId
 * @param {object}   [ctx]
 * @param {Function} [onAlert]
 */
export async function processUserEvents(userId, ctx = {}, onAlert) {
  try {
    const { default: prisma } = await import('../api/db/prisma.js');

    const events = await prisma.event.findMany({
      where: {
        OR: [
          { payload: { contains: `"userId":"${userId}"` } },
          { payload: { contains: `"userId": "${userId}"` } },
        ],
        status: { not: 'failed' },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (events.length === 0) return null;

    const result = runUserIntelligence(events, userId, ctx);

    if (result.decision.action !== 'log_only' && onAlert) {
      for (const alert of result.alerts) {
        await onAlert(alert).catch(err =>
          console.error('[Intelligence] Alert dispatch failed:', err.message)
        );
      }
    }

    return result;
  } catch (err) {
    console.error(`[Intelligence] processUserEvents failed for ${userId}:`, err.message);
    return null;
  }
}

// ──── Alert Builders ────

function buildAlerts(state, risk, action, nowMs) {
  if (action === 'log_only') return [];

  const severity = LEVEL_TO_SEVERITY[risk.level.label] ?? 'INFO';
  const alerts   = [];

  for (const userId of Object.keys(state.users)) {
    alerts.push(buildUserAlerts(userId, null, risk, action, nowMs, severity));
  }

  return alerts.flat();
}

function buildUserAlerts(userId, userState, risk, action, nowMs, severity) {
  if (action === 'log_only') return [];

  return [{
    type:     `RISK_${risk.level.label.replace(' ', '_').toUpperCase()}`,
    severity: severity ?? LEVEL_TO_SEVERITY[risk.level.label] ?? 'INFO',
    message:  `Risk level ${risk.level.label} (score: ${risk.score}) — action: ${action}`,
    metadata: {
      userId,
      score:    risk.score,
      level:    risk.level.label,
      color:    risk.level.color,
      action,
      model:    risk.model,
      triggeredAt: new Date(nowMs).toISOString(),
    },
  }];
}

/**
 * @typedef {object} IntelligenceResult
 * @property {object}   state      - Rebuilt state from event log
 * @property {object}   risk       - { score, level, breakdown, model }
 * @property {object}   decision   - { action, level, color, score, model, decidedAt }
 * @property {object[]} alerts     - Alerts to dispatch
 * @property {object}   meta       - { eventsApplied, lastEventId, computedAt }
 */
