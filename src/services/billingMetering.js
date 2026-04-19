/**
 * Billing Metering Layer
 *
 * Rule: billing NEVER blocks or influences the event flow.
 * Metering is fire-and-forget, written to a separate stream.
 *
 * Metrics tracked per tenant per day:
 *   - events_ingested
 *   - devices_active
 *   - risk_calculations
 *   - alerts_generated (haptic | critical)
 *   - intelligence_runs
 *   - storage_bytes (estimated)
 */

// ──── In-memory meter store (flush to DB on interval) ────
// Structure: Map<tenantId, Map<date, Counters>>
const _meters = new Map();
let _flushTimer = null;

const FLUSH_INTERVAL_MS = 60_000; // flush to DB every minute

// ──── Pricing model ────
export const PRICING = Object.freeze({
  // Per unit costs (USD cents)
  event_ingested:        0.001,  // $0.001 per 1K events = $1 per 1M
  device_active:         5.0,    // $5 per active device per month
  risk_calculation:      0.005,  // $0.005 per 1K calculations
  alert_haptic:          0.01,
  alert_critical:        0.05,
  intelligence_run:      0.002,
  storage_gb_month:      0.023,  // AWS S3-like pricing

  // Plan limits (free tier)
  free: { events_month: 10_000, devices: 2 },
  pro:  { events_month: 500_000, devices: 25 },
  enterprise: { events_month: Infinity, devices: Infinity },
});

// ──── Meter API ────

/**
 * Record a metering event for a tenant.
 * Fire-and-forget — never throws, never blocks event flow.
 *
 * @param {string} tenantId
 * @param {string} metric - one of: events_ingested | devices_active | risk_calculations | ...
 * @param {number} [delta=1]
 */
export function meter(tenantId, metric, delta = 1) {
  if (!tenantId || !metric) return;

  try {
    const today = new Date().toISOString().slice(0, 10);

    if (!_meters.has(tenantId)) _meters.set(tenantId, new Map());
    const tenantMeters = _meters.get(tenantId);

    if (!tenantMeters.has(today)) {
      tenantMeters.set(today, {
        events_ingested:    0,
        devices_active:     0,
        risk_calculations:  0,
        alerts_haptic:      0,
        alerts_critical:    0,
        intelligence_runs:  0,
        storage_bytes:      0,
      });
    }

    const day = tenantMeters.get(today);
    if (day[metric] !== undefined) day[metric] += delta;
  } catch {
    // billing never throws — event flow is never affected
  }
}

/**
 * Meter a batch of events (called after sync ingest).
 * Counts unique device_ids as active devices.
 */
export function meterBatch(tenantId, events) {
  if (!tenantId || !Array.isArray(events)) return;

  meter(tenantId, 'events_ingested', events.length);
  meter(tenantId, 'storage_bytes', estimateBytes(events));

  const deviceIds = new Set(events.map(e => e.device_id).filter(Boolean));
  for (const _ of deviceIds) meter(tenantId, 'devices_active', 1);
}

// ──── Usage Summary ────

/**
 * Get daily usage for a tenant (from in-memory buffer + DB).
 * @param {string} tenantId
 * @param {string} [date] - ISO date string, defaults to today
 */
export function getDailyUsage(tenantId, date = new Date().toISOString().slice(0, 10)) {
  const tenantMeters = _meters.get(tenantId);
  return tenantMeters?.get(date) ?? null;
}

/**
 * Get monthly usage summary for billing.
 * @param {string} tenantId
 * @param {string} [month] - 'YYYY-MM', defaults to current month
 */
export function getMonthlyUsage(tenantId, month = new Date().toISOString().slice(0, 7)) {
  const tenantMeters = _meters.get(tenantId);
  if (!tenantMeters) return null;

  const totals = {
    events_ingested: 0, devices_active: 0, risk_calculations: 0,
    alerts_haptic: 0, alerts_critical: 0, intelligence_runs: 0, storage_bytes: 0,
  };

  for (const [date, counters] of tenantMeters) {
    if (date.startsWith(month)) {
      for (const [k, v] of Object.entries(counters)) totals[k] += v;
    }
  }

  return { tenantId, month, ...totals };
}

/**
 * Calculate invoice for a tenant for a given month.
 * @param {string} tenantId
 * @param {string} plan - 'free' | 'pro' | 'enterprise'
 * @param {string} [month]
 * @returns {{ lineItems: object[], totalCents: number }}
 */
export function calculateInvoice(tenantId, plan = 'pro', month = new Date().toISOString().slice(0, 7)) {
  const usage  = getMonthlyUsage(tenantId, month);
  const limits = PRICING[plan] ?? PRICING.pro;
  if (!usage) return { lineItems: [], totalCents: 0, usage: null };

  const lineItems = [];

  // Events overage
  const eventOverage = Math.max(0, usage.events_ingested - limits.events_month);
  if (eventOverage > 0) {
    const cents = Math.ceil(eventOverage / 1000) * PRICING.event_ingested;
    lineItems.push({ item: 'Event overage', units: eventOverage, unitLabel: 'events', cents });
  }

  // Device overage
  const deviceOverage = Math.max(0, usage.devices_active - limits.devices);
  if (deviceOverage > 0) {
    const cents = deviceOverage * PRICING.device_active;
    lineItems.push({ item: 'Device overage', units: deviceOverage, unitLabel: 'devices', cents });
  }

  // Risk calculations
  if (usage.risk_calculations > 0) {
    const cents = Math.ceil(usage.risk_calculations / 1000) * PRICING.risk_calculation;
    lineItems.push({ item: 'Risk calculations', units: usage.risk_calculations, unitLabel: 'calculations', cents });
  }

  // Critical alerts
  if (usage.alerts_critical > 0) {
    const cents = usage.alerts_critical * PRICING.alert_critical;
    lineItems.push({ item: 'Critical alerts', units: usage.alerts_critical, unitLabel: 'alerts', cents });
  }

  // Storage
  const storageGb = usage.storage_bytes / (1024 ** 3);
  if (storageGb > 0.1) {
    const cents = storageGb * PRICING.storage_gb_month;
    lineItems.push({ item: 'Storage', units: +storageGb.toFixed(3), unitLabel: 'GB', cents: +cents.toFixed(2) });
  }

  const totalCents = lineItems.reduce((s, i) => s + i.cents, 0);
  return { tenantId, plan, month, lineItems, totalCents, totalUsd: +(totalCents / 100).toFixed(2), usage };
}

// ──── DB Flush ────

export function startMeteringFlush(prismaClient) {
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(() => flushToDB(prismaClient), FLUSH_INTERVAL_MS);
}

export function stopMeteringFlush() {
  if (_flushTimer) { clearInterval(_flushTimer); _flushTimer = null; }
}

async function flushToDB(prisma) {
  for (const [tenantId, days] of _meters) {
    for (const [date, counters] of days) {
      try {
        await prisma.tenantUsage.upsert({
          where: { tenantId_date: { tenantId, date } },
          update: { data: JSON.stringify(counters) },
          create: { tenantId, date, data: JSON.stringify(counters) },
        });
      } catch {
        // Fail silently — next flush will retry
      }
    }
  }
}

// ──── Helpers ────
function estimateBytes(events) {
  return events.reduce((n, e) => n + JSON.stringify(e).length, 0);
}

export default { meter, meterBatch, getDailyUsage, getMonthlyUsage, calculateInvoice, startMeteringFlush, stopMeteringFlush, PRICING };
