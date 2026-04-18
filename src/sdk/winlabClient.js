/**
 * WinLab Edge SDK
 *
 * Reduces the entire distributed system to 2 functions for integrators:
 *
 *   client.emitEvent({ type, payload })
 *   client.onRiskUpdate(score => {})
 *
 * Built-in:
 *   - offline queue + IndexedDB persistence
 *   - adaptive retry (2G → 4G aware)
 *   - idempotency (UUID per event)
 *   - batch sync (size adapts to connection)
 *   - fast path edge hint (local, instant)
 *   - slow path server risk (authoritative, async)
 */

import { saveEvent, startAutoSync, EVENT_TYPES }      from '../services/offlineEngine.js';
import { pushAndHint, onEmergency, startConnectivityWatchdog } from '../services/edgeRiskHint.js';

export { EVENT_TYPES };

// ──── Client Factory ────

/**
 * Create a WinLab SDK client.
 *
 * @param {object} config
 * @param {string} config.tenantId
 * @param {string} config.apiBase       - e.g. 'https://winlab.cloud/api/v1'
 * @param {string} [config.deviceId]    - auto-generated if omitted
 * @param {string} [config.tier='free'] - 'free' | 'pro' | 'enterprise'
 * @returns {WinLabClient}
 */
export function createClient(config = {}) {
  const { tenantId, apiBase, tier = 'free' } = config;

  if (!tenantId) throw new Error('[WinLabSDK] tenantId is required');
  if (!apiBase)  throw new Error('[WinLabSDK] apiBase is required');

  const _riskCallbacks = [];
  let   _lastHint      = null;
  let   _started       = false;

  // ──── Public API ────

  /**
   * Emit an event.
   * Saves locally immediately, syncs in background.
   * Returns a fast-path risk hint (local, instant, non-authoritative).
   *
   * @param {object} event
   * @param {string} event.type    - Must be one of EVENT_TYPES values
   * @param {object} event.payload
   * @param {object} [event.context] - Override auto-detected context
   * @returns {Promise<{ event_id: string, hint: EdgeHint|null }>}
   */
  async function emitEvent(event) {
    const { event: saved, hint } = await saveEvent({
      ...event,
      tenantId,
    });

    _lastHint = hint;

    // Notify risk listeners with fast-path hint
    if (hint && hint.score > 0) {
      _notifyRisk(hint);
    }

    return { event_id: saved.event_id, hint };
  }

  /**
   * Register a callback for risk score updates.
   * Called immediately with fast-path hint, then again when server responds.
   *
   * @param {Function} cb - ({ score, level, color, action, authoritative }) => void
   */
  function onRiskUpdate(cb) {
    _riskCallbacks.push(cb);
    // Replay last hint immediately if available
    if (_lastHint) cb(_lastHint);
  }

  /**
   * Register emergency callback (CRITICAL level, fires locally, zero latency).
   * @param {Function} cb - (hint) => void
   */
  function onEmergencyAlert(cb) {
    onEmergency(cb);
  }

  /**
   * Start background sync + connectivity watchdog.
   * Call once on app init.
   */
  function start() {
    if (_started) return;
    _started = true;

    // Connectivity watchdog
    startConnectivityWatchdog(`${apiBase}/health`);

    // Auto-sync with server risk polling
    startAutoSync({
      endpoint: `${apiBase}/events`,
      interval: _syncInterval(tier),
      onProgress: (synced, total) => {
        // Optional: expose progress to integrator
      },
    });

    // Poll server for authoritative risk scores
    _startRiskPolling(apiBase, tenantId, _riskCallbacks);
  }

  /**
   * Stop sync + polling.
   */
  function stop() {
    _started = false;
    import('../services/offlineEngine.js').then(({ stopAutoSync }) => stopAutoSync());
    import('../services/edgeRiskHint.js').then(({ stopConnectivityWatchdog }) => stopConnectivityWatchdog());
  }

  /**
   * Get current risk hint (last known, may be stale).
   */
  function getCurrentRisk() {
    return _lastHint;
  }

  function _notifyRisk(hint) {
    for (const cb of _riskCallbacks) {
      try { cb(hint); } catch {}
    }
  }

  return { emitEvent, onRiskUpdate, onEmergencyAlert, start, stop, getCurrentRisk, EVENT_TYPES };
}

// ──── Risk Polling (slow path) ────
let _pollTimer = null;

function _startRiskPolling(apiBase, tenantId, callbacks) {
  if (_pollTimer) clearInterval(_pollTimer);

  const deviceId = localStorage.getItem('deviceId') ?? 'unknown';
  const interval = 15_000;

  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${apiBase}/risk/${deviceId}`, {
        headers: { 'x-tenant-id': tenantId },
        signal:  AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();

      const serverHint = {
        score:         data.score,
        level:         data.level,
        color:         data.color,
        action:        data.action,
        haptic:        false,
        authoritative: true,  // ← server response is authoritative
        autonomous:    false,
        windowSize:    data.events,
      };

      for (const cb of callbacks) {
        try { cb(serverHint); } catch {}
      }
    } catch {
      // Network error — fast path still running
    }
  }, interval);
}

function _syncInterval(tier) {
  return { free: 30_000, pro: 10_000, enterprise: 2_000 }[tier] ?? 30_000;
}

/**
 * @typedef {object} WinLabClient
 * @property {Function} emitEvent        - Emit an event (offline-safe)
 * @property {Function} onRiskUpdate     - Subscribe to risk updates
 * @property {Function} onEmergencyAlert - Subscribe to CRITICAL alerts
 * @property {Function} start            - Start background sync
 * @property {Function} stop             - Stop sync
 * @property {Function} getCurrentRisk  - Get last known risk hint
 * @property {object}   EVENT_TYPES      - Enum of valid event types
 */
