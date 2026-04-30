/**
 * Helpdesk Routes — Full AI Secure Helpdesk Platform
 *
 * Email Processing:
 * POST /api/helpdesk/ingest       → Ingest + security + AI classify
 * POST /api/helpdesk/ai-reply     → Generate AI reply (cache + name + team)
 * POST /api/helpdesk/reply        → Send reply with tracking + feedback
 *
 * Core:
 * GET  /api/helpdesk/inbox        → List tickets with AI metadata
 * GET  /api/helpdesk/verify       → Verify email authenticity (JWT)
 * GET  /api/helpdesk/sla          → SLA status + AI metrics
 * GET  /api/helpdesk/metrics      → Queue metrics
 *
 * Intelligence:
 * GET  /api/helpdesk/insights     → Business insights + clustering
 * GET  /api/helpdesk/analytics    → Full analytics (KPIs, time series, groupings)
 * GET  /api/helpdesk/bugs         → Spike detection + deploy correlation
 * POST /api/helpdesk/deploy       → Record deploy event
 * GET  /api/helpdesk/churn        → Churn prediction + at-risk users
 * POST /api/helpdesk/churn/update → Batch update user usage
 * GET  /api/helpdesk/ai-summary   → AI-generated state summary
 *
 * Knowledge:
 * GET  /api/helpdesk/kb           → Knowledge base articles
 * GET  /api/helpdesk/templates    → Template suggestions
 * GET  /api/helpdesk/faqs         → Auto-generated FAQ suggestions
 *
 * Security:
 * GET  /api/helpdesk/security     → Security stats + cache stats
 * POST /api/helpdesk/blacklist    → Manually blacklist email
 */

import express from 'express';
import {
  ingestEmails,
  getInbox,
  aiReply,
  replyEmail,
  verifyEmail,
  getSLA,
  getMetrics,
  getInsights,
  getKB,
  getTemplates,
  getFAQs,
  getSecurity,
  blacklistEmail,
  getAnalytics,
  getBugs,
  recordDeployEvent,
  getChurn,
  updateChurn,
  getAISummary,
} from '../../services/helpdeskService.js';
import { helpdeskQueue } from '../../services/helpdeskQueue.js';

const router = express.Router();

function validateSyncEvent(event) {
  const eid = event?.event_id ?? event?.id;
  if (!eid) return { ok: false, status: 400, error: 'event_id required' };
  if (!event?.type && !event?.event_type) return { ok: false, status: 400, error: 'type required' };
  if (event.payload == null || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    return {
      ok: false,
      status: 422,
      error: 'dead letter: invalid payload',
      code: 'DEAD_LETTER',
    };
  }
  return { ok: true, eid };
}

// ──── Email Processing ────
router.post('/ingest', ingestEmails);
router.post('/ai-reply', aiReply);
router.post('/reply', replyEmail);

// ──── Core ────
router.get('/inbox', getInbox);
router.get('/verify', verifyEmail);
router.get('/sla', getSLA);
router.get('/metrics', getMetrics);
router.get('/dlq', async (req, res) => {
  const messages = await helpdeskQueue.getFailed(50);
  res.json({ count: messages.length, messages });
});

// ──── Intelligence ────
router.get('/insights', getInsights);
router.get('/analytics', getAnalytics);
router.get('/bugs', getBugs);
router.post('/deploy', recordDeployEvent);
router.get('/churn', getChurn);
router.post('/churn/update', updateChurn);
router.get('/ai-summary', getAISummary);

// ──── Knowledge ────
router.get('/kb', getKB);
router.get('/templates', getTemplates);
router.get('/faqs', getFAQs);

// ──── Security ────
router.get('/security', getSecurity);
router.post('/blacklist', blacklistEmail);

// ──── Inbound Email Webhook (Resend) ────
// Resend sends: { type: "email.received", data: { from, to, subject, text, html } }
router.post('/webhook/resend', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type !== 'email.received' || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const { from, subject, text, html } = data;
    const body = text || html || '';

    // Reuse ingestEmails logic by building a synthetic req/res
    const fakeReq = {
      body: {
        emails: [{ from, subject, body, snippet: body.slice(0, 200), priority: 5 }],
      },
    };
    const fakeRes = {
      status: () => fakeRes,
      json: () => {},
    };

    await ingestEmails(fakeReq, fakeRes);
    res.json({ received: true });
  } catch (err) {
    console.error('[Helpdesk webhook]', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ──── AI Learning Cache ────
router.post('/ai-cache/feedback', async (req, res) => {
  try {
    const { key, feedback } = req.body;
    if (!key || !feedback) return res.status(400).json({ error: 'key and feedback required' });

    const { recordFeedback } = await import('../../services/aiLearningCache.js');
    recordFeedback(key, feedback);
    res.json({ recorded: true });
  } catch (error) {
    res.status(500).json({ error: 'Feedback failed', details: error.message });
  }
});

router.get('/ai-cache/stats', async (req, res) => {
  try {
    const { getAICacheStats } = await import('../../services/aiLearningCache.js');
    res.json(getAICacheStats());
  } catch (error) {
    res.status(500).json({ error: 'Stats failed', details: error.message });
  }
});

// ──── Edge Sync Routes ────

// POST /api/helpdesk/sync/batch  — receive a batch of edge events
// Returns { acknowledged: string[], conflicts: { id, serverData }[] }
router.post('/sync/batch', async (req, res) => {
  const tenantId = req.tenantId ?? 'default';
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }
  if (events.length > 100) {
    return res.status(400).json({ error: 'batch too large (max 100)' });
  }

  const acknowledged = [];
  const conflicts    = [];

  for (const event of events) {
    const { event_id, id } = event;
    const eid = event_id ?? id;
    if (!eid) continue;

    try {
      const { createEventIfAbsent, isEventProcessed, markEventProcessed } = await import('../../services/webhookIdempotency.js');

      if (await isEventProcessed(eid)) {
        // Already processed — acknowledge so client marks it synced
        acknowledged.push(eid);
        continue;
      }

      // Persist to central event log — enveloped with tenant_id
      const { default: prisma } = await import('../db/prisma.js');
      const { envelopeEvent } = await import('../../services/tenantManager.js');
      const enveloped = envelopeEvent(event, tenantId);
      const eventWrite = await createEventIfAbsent({
        data: {
          id:      eid,
          type:    event.event_type ?? event.type ?? 'UNKNOWN',
          version: event.schema_version ?? 1,
          payload: enveloped.payload,
          status:  'pending',
        },
      }.data);
      if (eventWrite.duplicate) {
        acknowledged.push(eid);
        continue;
      }

      await markEventProcessed(eid, event.event_type ?? event.type, {
        device_id: event.device_id,
        sequence:  event.sequence,
      });

      acknowledged.push(eid);
    } catch (err) {
      if (err.code === 'P2002') {
        acknowledged.push(eid);
      } else {
        conflicts.push({ id: eid, serverData: { error: err.message } });
      }
    }
  }

  res.json({ acknowledged, conflicts });

  // Billing metering — fire-and-forget, never blocks response
  import('../../services/billingMetering.js').then(({ meterBatch, meter }) => {
    meterBatch(tenantId, events);
    meter(tenantId, 'risk_calculations', acknowledged.length);
  }).catch(() => {});

  // Trigger intelligence layer asynchronously — fire-and-forget, does not block response
  const deviceIds = [...new Set(events.map(e => e.device_id).filter(Boolean))];
  for (const deviceId of deviceIds) {
    import('../../services/intelligenceLayer.js').then(({ processDeviceEvents }) => {
      processDeviceEvents(deviceId, {}, async alert => {
        if (alert.severity === 'CRITICAL') {
          const { dispatchAlert } = await import('../../core/alertDispatcher.js');
          await dispatchAlert(alert);
        }
      });
    }).catch(err => console.error('[Intelligence] Trigger failed:', err.message));
  }
});

// POST /api/helpdesk/sync  — single-event fallback (used when batch endpoint rejects)
router.post('/sync', async (req, res) => {
  const event = req.body;
  const validation = validateSyncEvent(event);
  if (!validation.ok) {
    return res.status(validation.status).json({
      error: validation.error,
      code: validation.code,
    });
  }
  const eid = validation.eid;

  try {
    const { createEventIfAbsent, isEventProcessed, markEventProcessed } = await import('../../services/webhookIdempotency.js');

    if (await isEventProcessed(eid)) return res.json({ acknowledged: [eid] });

    const { default: prisma } = await import('../db/prisma.js');
    const eventWrite = await createEventIfAbsent({
      data: {
        id:      eid,
        type:    event.event_type ?? event.type ?? 'UNKNOWN',
        version: event.schema_version ?? 1,
        payload: JSON.stringify(event.payload ?? {}),
        status:  'pending',
      },
    }.data);
    if (eventWrite.duplicate) return res.json({ acknowledged: [eid] });

    await markEventProcessed(eid, event.event_type ?? event.type, {
      device_id: event.device_id,
      sequence:  event.sequence,
    });

    res.json({ acknowledged: [eid] });
  } catch (err) {
    if (err.code === 'P2002') return res.json({ acknowledged: [eid] });
    res.status(500).json({ error: err.message });
  }
});

export default router;
