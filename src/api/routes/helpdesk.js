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

const router = express.Router();

// ──── Email Processing ────
router.post('/ingest', ingestEmails);
router.post('/ai-reply', aiReply);
router.post('/reply', replyEmail);

// ──── Core ────
router.get('/inbox', getInbox);
router.get('/verify', verifyEmail);
router.get('/sla', getSLA);
router.get('/metrics', getMetrics);

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

export default router;
