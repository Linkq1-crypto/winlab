/**
 * Public API — REST endpoints for external integrations
 *
 * POST /api/v1/events/ingest         — ingest single event
 * POST /api/v1/events/batch          — ingest batch
 * GET  /api/v1/risk/:deviceId        — current risk score for device
 * GET  /api/v1/events/replay         — replay event log (scoped)
 * GET  /api/v1/billing/usage         — tenant usage summary
 * GET  /api/v1/sla/report            — SLA metrics
 */

import express from 'express';
import { recordIngestionLatency, recordSyncOutcome } from '../../services/qosLayer.js';
import { meterBatch, meter }                      from '../../services/billingMetering.js';
import { loadTenantEvents }                       from '../../services/tenantManager.js';
import { loadPartitionRange }                     from '../../services/eventPartition.js';
import { runIntelligence }                        from '../../services/intelligenceLayer.js';
import { getSlaReport }                           from '../../services/qosLayer.js';
import { getDailyUsage, getMonthlyUsage }         from '../../services/billingMetering.js';
import { isEventProcessed, markEventProcessed }   from '../../services/webhookIdempotency.js';
import prisma from '../db/prisma.js';

const router = express.Router();

// Note: tenantMiddleware + qosMiddleware are applied in server.js before this router.

// ──── POST /events/ingest ────
router.post('/events/ingest', async (req, res) => {
  const t0 = Date.now();
  const tenantId = req.tenantId;
  const event    = req.body;

  const eid = event.event_id ?? event.id;
  if (!eid) return res.status(400).json({ error: 'event_id required' });

  try {
    if (await isEventProcessed(eid)) {
      return res.json({ status: 'duplicate', event_id: eid });
    }

    await prisma.event.create({
      data: {
        id:      eid,
        type:    event.event_type ?? event.type ?? 'UNKNOWN',
        version: event.schema_version ?? 1,
        payload: JSON.stringify({ ...parsePayload(event.payload), tenant_id: tenantId }),
        status:  'pending',
      },
    });

    await markEventProcessed(eid, event.event_type ?? event.type, { tenant_id: tenantId, device_id: event.device_id });
    meter(tenantId, 'events_ingested');
    recordIngestionLatency(tenantId, Date.now() - t0);
    recordSyncOutcome(tenantId, true);

    res.status(201).json({ status: 'accepted', event_id: eid, latencyMs: Date.now() - t0 });
  } catch (err) {
    recordSyncOutcome(tenantId, false);
    if (err.code === 'P2002') return res.json({ status: 'duplicate', event_id: eid });
    res.status(500).json({ error: err.message });
  }
});

// ──── POST /events/batch ────
router.post('/events/batch', async (req, res) => {
  const t0       = Date.now();
  const tenantId = req.tenantId;
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }
  if (events.length > req.qosConfig.batchSize) {
    return res.status(400).json({ error: `batch too large for tier (max ${req.qosConfig.batchSize})` });
  }

  const accepted  = [];
  const rejected  = [];

  for (const event of events) {
    const eid = event.event_id ?? event.id;
    if (!eid) { rejected.push({ event_id: null, reason: 'missing event_id' }); continue; }

    try {
      if (await isEventProcessed(eid)) { accepted.push(eid); continue; } // idempotent

      await prisma.event.create({
        data: {
          id:      eid,
          type:    event.event_type ?? event.type ?? 'UNKNOWN',
          version: event.schema_version ?? 1,
          payload: JSON.stringify({ ...parsePayload(event.payload), tenant_id: tenantId }),
          status:  'pending',
        },
      });

      await markEventProcessed(eid, event.event_type ?? event.type, { tenant_id: tenantId, device_id: event.device_id });
      accepted.push(eid);
    } catch (err) {
      if (err.code === 'P2002') { accepted.push(eid); continue; }
      rejected.push({ event_id: eid, reason: err.message });
    }
  }

  meterBatch(tenantId, events.filter(e => accepted.includes(e.event_id ?? e.id)));
  recordIngestionLatency(tenantId, Date.now() - t0);
  recordSyncOutcome(tenantId, rejected.length === 0);

  res.json({ accepted, rejected, latencyMs: Date.now() - t0 });
});

// ──── GET /risk/:deviceId ────
router.get('/risk/:deviceId', async (req, res) => {
  const t0       = Date.now();
  const tenantId = req.tenantId;
  const { deviceId } = req.params;

  try {
    const events = await loadTenantEvents(tenantId, deviceId, { limit: 500 });
    if (events.length === 0) return res.json({ score: 0, level: 'SAFE', color: 'green', events: 0 });

    const result = runIntelligence(events);
    meter(tenantId, 'risk_calculations');

    res.json({
      device_id:  deviceId,
      tenant_id:  tenantId,
      score:      result.risk.score,
      level:      result.risk.level.label,
      color:      result.risk.level.color,
      action:     result.decision.action,
      model:      result.decision.model,
      events:     events.length,
      latencyMs:  Date.now() - t0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── GET /events/replay ────
router.get('/events/replay', async (req, res) => {
  const tenantId = req.tenantId;
  const { device_id, from, to } = req.query;

  if (!device_id || !from || !to) {
    return res.status(400).json({ error: 'device_id, from, to required' });
  }

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const diffDays = (toDate - fromDate) / 86_400_000;

  // Enforce max replay window per tier
  const maxDays = { free: 7, pro: 30, enterprise: 365 }[req.qosTier] ?? 7;
  if (diffDays > maxDays) {
    return res.status(400).json({ error: `replay window exceeds tier limit (${maxDays} days)` });
  }

  try {
    const events = await loadPartitionRange(tenantId, device_id, fromDate, toDate, { limit: 10_000 });
    res.json({ tenant_id: tenantId, device_id, from, to, count: events.length, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── GET /billing/usage ────
router.get('/billing/usage', (req, res) => {
  const tenantId = req.tenantId;
  const { month } = req.query;
  const usage = month ? getMonthlyUsage(tenantId, month) : getDailyUsage(tenantId);
  res.json(usage ?? { tenantId, message: 'no usage data yet' });
});

// ──── GET /sla/report ────
router.get('/sla/report', (req, res) => {
  const report = getSlaReport(req.tenantId);
  res.json(report ?? { tenantId: req.tenantId, message: 'no SLA data yet' });
});

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

export default router;
