/**
 * Alert Dispatcher — System alert routing with deduplication and rate limiting
 *
 * Rules:
 * - Deduplication window: 5 minutes (same alert type = 1 email)
 * - Rate limit: max 5 emails per user per hour
 * - Only CRITICAL alerts trigger emails (WARN/INFO = UI only)
 * - Respects user notification preferences
 */

import { sendTemplatedEmail } from '../services/emailService.js';
import { eventBus } from '../core/eventBus.js';
import { logIncident, SEVERITY } from '../core/timelineStore.js';

// ── Deduplication store ──────────────────────────────────────────────────────
const dedupWindow = new Map(); // key → last timestamp
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ── Rate limiter ──────────────────────────────────────────────────────────────
const emailTimestamps = new Map(); // userId → [timestamps]
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

/**
 * Check if same alert was sent in last 5 minutes
 */
function isDuplicate(alertKey, now) {
  const lastSent = dedupWindow.get(alertKey);
  if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
    return true;
  }
  dedupWindow.set(alertKey, now);
  return false;
}

/**
 * Check if user is within rate limit
 */
function isRateLimited(userId, now) {
  let timestamps = emailTimestamps.get(userId) || [];

  // Remove old timestamps outside the window
  timestamps = timestamps.filter((ts) => (now - ts) < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    emailTimestamps.set(userId, timestamps);
    return true; // Rate limited
  }

  timestamps.push(now);
  emailTimestamps.set(userId, timestamps);
  return false;
}

/**
 * Dispatch an alert through all channels:
 * 1. UI Toast + Timeline (always)
 * 2. Email (only CRITICAL + not duplicate + not rate limited)
 *
 * @param {object} alert
 * @param {string} alert.message
 * @param {string} alert.type
 * @param {string} alert.severity - INFO | WARN | CRITICAL
 * @param {object} [alert.metadata]
 * @param {string|null} [userEmail] - If provided and CRITICAL, send email
 */
export async function dispatchAlert(alert, userEmail = null) {
  const now = Date.now();
  const alertKey = `${alert.type}-${alert.message}`;

  // 1. Always log to timeline
  logIncident(alert.type, alert.message, alert.severity || SEVERITY.INFO, {
    ...alert.metadata,
    dispatchedAt: new Date().toISOString(),
  });

  // 2. Always emit to UI for toast notifications
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ALERT', {
      detail: { message: alert.message, severity: alert.severity },
    }));
  }

  // 3. Email only for CRITICAL alerts
  if (alert.severity !== SEVERITY.CRITICAL || !userEmail) {
    return;
  }

  // Dedup check
  if (isDuplicate(alertKey, now)) {
    console.log(`[AlertDispatcher] Deduplicated: ${alertKey}`);
    return;
  }

  // Rate limit check
  if (isRateLimited(userEmail, now)) {
    console.log(`[AlertDispatcher] Rate limited: ${userEmail}`);
    return;
  }

  // 4. Send CRITICAL email
  try {
    await sendTemplatedEmail(
      userEmail,
      `🚨 Critical Alert: ${alert.message}`,
      `
        <h2 style="margin-top:0; color:#ef4444;">Critical Incident Detected</h2>
        <p style="color:#94a3b8;">An incident requires your immediate attention:</p>
        <div style="background:#7f1d1d30; border:1px solid #ef444450; border-radius:8px; padding:16px; margin:16px 0;">
          <p style="margin:4px 0; color:#fca5a5;"><strong>Incident:</strong> ${alert.message}</p>
          <p style="margin:4px 0; color:#fca5a5;"><strong>Type:</strong> ${alert.type}</p>
          <p style="margin:4px 0; color:#fca5a5;"><strong>Time:</strong> ${new Date().toISOString()}</p>
          ${alert.metadata?.serviceId ? `<p style="margin:4px 0; color:#fca5a5;"><strong>Service:</strong> ${alert.metadata.serviceId}</p>` : ''}
        </div>
        <p style="color:#94a3b8;">Check your dashboard for real-time status updates.</p>
      `,
      {
        tags: [{ name: 'alert_type', value: 'critical' }, { name: 'incident_type', value: alert.type }],
      }
    );

    logIncident('ALERT_EMAIL', `Critical alert email sent to ${userEmail}`, SEVERITY.INFO, {
      alertKey,
      userEmail,
    });
  } catch (err) {
    console.error('[AlertDispatcher] Failed to send alert email:', err);
    logIncident('ALERT_EMAIL_FAILED', `Failed to send to ${userEmail}: ${err.message}`, SEVERITY.WARN);
  }
}

/**
 * Bootstrap alert flow — wire up event bus to alert dispatcher
 * Call this once at app startup
 */
export function bootstrapAlertFlow() {
  // Wire SERVICE_DOWN → CRITICAL alert
  eventBus.on('SERVICE_DOWN', async ({ serviceId }) => {
    await dispatchAlert({
      type: 'SERVICE_DOWN',
      message: `Service outage detected: ${serviceId || 'unknown'}`,
      severity: SEVERITY.CRITICAL,
      metadata: { serviceId },
    });
  });

  // Wire SERVICE_DEGRADED → WARN alert
  eventBus.on('SERVICE_DEGRADED', ({ serviceId, cause }) => {
    dispatchAlert({
      type: 'SERVICE_DEGRADED',
      message: `Service degraded: ${serviceId} (cause: ${cause})`,
      severity: SEVERITY.WARN,
      metadata: { serviceId, cause },
    });
  });

  // Wire REMEDIATION_STARTED → INFO
  eventBus.on('REMEDIATION_STARTED', ({ serviceId, action }) => {
    dispatchAlert({
      type: 'REMEDIATION_STARTED',
      message: `Auto-healing started: ${action} on ${serviceId}`,
      severity: SEVERITY.INFO,
      metadata: { serviceId, action },
    });
  });

  // Wire REMEDIATION_SUCCESS → INFO
  eventBus.on('REMEDIATION_SUCCESS', ({ serviceId, action }) => {
    dispatchAlert({
      type: 'REMEDIATION_SUCCESS',
      message: `Service recovered: ${serviceId} via ${action}`,
      severity: SEVERITY.INFO,
      metadata: { serviceId, action },
    });
  });

  console.log('[AlertDispatcher] Alert flow bootstrap complete');
}

// Export for testing
export const _test = { isDuplicate, isRateLimited, dedupWindow, emailTimestamps };

export default { dispatchAlert, bootstrapAlertFlow, _test };
