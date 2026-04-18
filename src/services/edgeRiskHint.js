/**
 * Edge Risk Hint — Fast Path
 *
 * Runs synchronously on device immediately when an event is saved.
 * No network, no state rebuild, no server round-trip.
 * Output is a LOCAL HINT only — not authoritative.
 *
 * Authoritative risk = server intelligence layer (slow path).
 *
 * Fast path:   saveEvent() → edgeRiskHint() → immediate UI feedback
 * Slow path:   syncEvents() → server → intelligenceLayer() → authoritative decision
 */

import { EVENT_TYPES } from './offlineEngine.js';

// Lightweight weights — mirrors server riskEngine but no recency decay (no clock needed)
const EDGE_WEIGHTS = Object.freeze({
  [EVENT_TYPES.RISK_SIGNAL]:  1.0,
  [EVENT_TYPES.BIOMETRIC]:    0.8,
  [EVENT_TYPES.MOTION]:       0.6,
  [EVENT_TYPES.SYSTEM]:       0.4,
  [EVENT_TYPES.CONTEXT]:      0.3,
  [EVENT_TYPES.USER_ACTION]:  0.2,
});

// Rolling window kept in memory — resets on page reload (intentional: edge is ephemeral)
const _window = [];
const WINDOW_MAX = 20; // last N events only

/**
 * Push event into local window and return an immediate risk hint.
 * Call this synchronously after saveEvent().
 *
 * @param {object} event - The event just saved (full schema)
 * @returns {EdgeHint}
 */
export function pushAndHint(event) {
  // Maintain bounded rolling window
  _window.push(event);
  if (_window.length > WINDOW_MAX) _window.shift();

  return scoreWindow(_window);
}

/**
 * Score the current rolling window without adding a new event.
 * Useful for reading hint state without triggering a new event.
 *
 * @returns {EdgeHint}
 */
export function currentHint() {
  return scoreWindow(_window);
}

/**
 * Clear the local window (e.g. on session end or logout).
 */
export function resetWindow() {
  _window.length = 0;
}

// ──── Scoring ────

function scoreWindow(events) {
  if (events.length === 0) {
    return hint(0);
  }

  let raw = 0;
  for (const e of events) {
    const type = e.event_type ?? e.type ?? '';
    const W    = EDGE_WEIGHTS[type] ?? 0.1;
    const S    = clamp(e.payload?.data?.severity  ?? e.payload?.severity  ?? 0.5);
    const C    = clamp(e.payload?.data?.confidence ?? e.payload?.confidence ?? 0.7);
    raw += W * S * C * 100;
  }

  // Normalise to 0–100 (same squeeze as server engine)
  const score = Math.round(raw <= 80 ? Math.min(80, raw) : Math.min(100, 80 + 20 * (1 - Math.exp(-(raw - 80) / 20))));
  return hint(score);
}

function hint(score) {
  let level, color, action, haptic;

  if (score <= 20)      { level = 'SAFE';      color = 'green';  action = 'none';                    haptic = false; }
  else if (score <= 50) { level = 'LOW RISK';  color = 'yellow'; action = 'haptic_check';             haptic = true;  }
  else if (score <= 75) { level = 'HIGH RISK'; color = 'orange'; action = 'continuous_monitoring';    haptic = true;  }
  else                  { level = 'CRITICAL';  color = 'red';    action = 'emergency_escalation';     haptic = true;  }

  // Haptic feedback — immediate, no network
  if (haptic && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(level === 'CRITICAL' ? [200, 100, 200] : [100]);
  }

  const result = {
    score,
    level,
    color,
    action,
    haptic,
    authoritative: false,
    autonomous: !_serverReachable, // true when operating without server
    windowSize: _window.length,
  };

  // Emergency trigger: fire locally when CRITICAL, especially if server unreachable
  if (level === 'CRITICAL') {
    triggerEmergency(result);
  }

  return result;
}

function clamp(val, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(val) || 0));
}

// ──── Emergency Precheck Trigger ────

const _emergencyCallbacks = [];

/**
 * Register a callback to invoke when edge score crosses CRITICAL threshold.
 * Fires immediately on the device — no network needed.
 *
 * @param {Function} cb - (hint: EdgeHint) => void
 */
export function onEmergency(cb) {
  _emergencyCallbacks.push(cb);
}

/**
 * Emergency trigger logic — called internally when score > 75.
 * Fires ALL registered callbacks + logs locally.
 */
function triggerEmergency(hint) {
  console.warn(`[EdgeFallback] EMERGENCY triggered — score=${hint.score} level=${hint.level}`);
  for (const cb of _emergencyCallbacks) {
    try { cb(hint); } catch (err) { console.error('[EdgeFallback] Emergency callback error:', err); }
  }
}

// ──── Connectivity Watchdog ────
// When server is unreachable, edge fallback operates autonomously.
let _serverReachable = true;
let _watchdogTimer   = null;

export function setServerReachable(reachable) {
  _serverReachable = reachable;
  if (!reachable) {
    console.warn('[EdgeFallback] Server unreachable — operating in autonomous mode');
  }
}

/**
 * Start periodic connectivity check.
 * If server doesn't respond, edge operates fully autonomously.
 *
 * @param {string} [probeUrl='/api/health']
 * @param {number} [intervalMs=15000]
 */
export function startConnectivityWatchdog(probeUrl = '/api/health', intervalMs = 15_000) {
  if (_watchdogTimer) clearInterval(_watchdogTimer);
  _watchdogTimer = setInterval(async () => {
    try {
      const res = await fetch(probeUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      setServerReachable(res.ok);
    } catch {
      setServerReachable(false);
    }
  }, intervalMs);
}

export function stopConnectivityWatchdog() {
  if (_watchdogTimer) { clearInterval(_watchdogTimer); _watchdogTimer = null; }
}

export function isServerReachable() {
  return _serverReachable;
}

/**
 * @typedef {object} EdgeHint
 * @property {number}  score         - 0–100
 * @property {string}  level         - SAFE | LOW RISK | HIGH RISK | CRITICAL
 * @property {string}  color         - green | yellow | orange | red
 * @property {string}  action        - none | haptic_check | continuous_monitoring | emergency_escalation
 * @property {boolean} haptic        - Whether haptic was triggered
 * @property {false}   authoritative - Always false. Server intelligence layer is authoritative.
 * @property {number}  windowSize    - How many events in local window
 */
