/**
 * Observability Layer — Replay as Film
 *
 * Turns an event log into debuggable structures:
 *   - Event timeline (chronological with state diffs)
 *   - Risk trace (per-event score contribution)
 *   - Decision trace (event → score → decision → action)
 *
 * Pure functions — no side effects, no DB writes.
 * Input: ordered event array. Output: visual data structures.
 */

import { reducer, INITIAL_STATE, rebuildState } from './stateRebuildEngine.js';
import { calculateRiskScore, classifyScore, decideAction } from './riskEngine.js';

// ──── 1. Event Timeline ────

/**
 * Build a timeline: each step shows the event + resulting state diff.
 *
 * @param {object[]} events - Ordered event log
 * @returns {TimelineStep[]}
 */
export function buildTimeline(events) {
  const timeline = [];
  let state = INITIAL_STATE;

  for (let i = 0; i < events.length; i++) {
    const event    = events[i];
    const prevState = state;
    const nextState = reducer(state, event);

    timeline.push({
      index:     i,
      event_id:  event.id ?? event.event_id,
      type:      event.type,
      timestamp: event.createdAt ?? event.timestamp,
      tenant_id: parsePayload(event.payload).tenant_id,
      device_id: parsePayload(event.payload).device_id ?? event.device_id,
      sequence:  event.sequence,
      diff:      stateDiff(prevState, nextState),
    });

    state = nextState;
  }

  return timeline;
}

// ──── 2. Risk Trace ────

/**
 * Build a risk trace: for each event, show its contribution to the score.
 * Allows "why is the score X?" to be answered event-by-event.
 *
 * @param {object[]} events
 * @param {number}   [nowMs]
 * @returns {RiskTrace}
 */
export function buildRiskTrace(events, nowMs = Date.now()) {
  const result = calculateRiskScore(events, {}, nowMs);

  // Build cumulative score curve
  const curve = [];
  for (let i = 1; i <= events.length; i++) {
    const partial = calculateRiskScore(events.slice(0, i), {}, nowMs);
    curve.push({
      index:    i - 1,
      event_id: events[i - 1]?.id ?? events[i - 1]?.event_id,
      type:     events[i - 1]?.type,
      score:    partial.score,
      level:    partial.level.label,
      color:    partial.level.color,
      delta:    i === 1 ? partial.score : partial.score - curve[i - 2].score,
    });
  }

  return {
    finalScore:    result.score,
    finalLevel:    result.level,
    breakdown:     result.breakdown,
    curve,
    topContributors: result.breakdown
      .slice()
      .sort((a, b) => b.term - a.term)
      .slice(0, 5),
  };
}

// ──── 3. Decision Trace ────

/**
 * Full decision trace: event → state → risk → decision → action.
 * The complete audit trail for a single decision point.
 *
 * @param {object[]} events
 * @param {object}   [ctx]
 * @param {number}   [nowMs]
 * @returns {DecisionTrace}
 */
export function buildDecisionTrace(events, ctx = {}, nowMs = Date.now()) {
  const { state, eventsApplied, lastEventId } = rebuildState(events);
  const risk     = calculateRiskScore(events, ctx, nowMs);
  const decision = decideAction(risk.level);
  const timeline = buildTimeline(events);
  const riskTrace= buildRiskTrace(events, nowMs);

  return {
    summary: {
      eventsApplied,
      lastEventId,
      finalScore:  risk.score,
      finalLevel:  risk.level.label,
      finalColor:  risk.level.color,
      decision,
      model:       risk.model,
      computedAt:  new Date(nowMs).toISOString(),
    },
    timeline,
    riskTrace,
    stateSnapshot: state,
  };
}

// ──── 4. Heatmap Data ────

/**
 * Aggregate risk scores into a time-bucketed heatmap (hourly).
 * Used by the risk heatmap UI component.
 *
 * @param {object[]} events
 * @param {number}   [nowMs]
 * @returns {HeatmapBucket[]}
 */
export function buildRiskHeatmap(events, nowMs = Date.now()) {
  // Group events by hour bucket
  const buckets = new Map();

  for (const event of events) {
    const ts = new Date(event.createdAt ?? event.timestamp ?? nowMs);
    const key = `${ts.getUTCFullYear()}-${pad(ts.getUTCMonth()+1)}-${pad(ts.getUTCDate())}T${pad(ts.getUTCHours())}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  }

  const heatmap = [];
  for (const [bucket, bucketEvents] of buckets) {
    const { score, level } = calculateRiskScore(bucketEvents, {}, nowMs);
    heatmap.push({ bucket, score, level: level.label, color: level.color, eventCount: bucketEvents.length });
  }

  return heatmap.sort((a, b) => a.bucket.localeCompare(b.bucket));
}

// ──── Helpers ────

function stateDiff(prev, next) {
  const diff = {};
  for (const key of Object.keys(next)) {
    const a = JSON.stringify(prev[key] ?? null);
    const b = JSON.stringify(next[key] ?? null);
    if (a !== b) diff[key] = { before: prev[key] ?? null, after: next[key] };
  }
  return diff;
}

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function pad(n) { return String(n).padStart(2, '0'); }

/**
 * @typedef {object} TimelineStep
 * @property {number} index
 * @property {string} event_id
 * @property {string} type
 * @property {string} timestamp
 * @property {object} diff        - State keys that changed
 *
 * @typedef {object} RiskTrace
 * @property {number}   finalScore
 * @property {object}   finalLevel
 * @property {object[]} breakdown
 * @property {object[]} curve         - Cumulative score per event
 * @property {object[]} topContributors
 *
 * @typedef {object} DecisionTrace
 * @property {object}   summary
 * @property {object[]} timeline
 * @property {object}   riskTrace
 * @property {object}   stateSnapshot
 *
 * @typedef {object} HeatmapBucket
 * @property {string} bucket      - ISO hour string
 * @property {number} score
 * @property {string} level
 * @property {string} color
 * @property {number} eventCount
 */
