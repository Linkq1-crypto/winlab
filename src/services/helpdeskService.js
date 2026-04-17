/**
 * Helpdesk Service — Full enterprise pipeline with security + learning
 * - Ingest emails with trust scoring + security pipeline
 * - Semantic cache for AI responses
 * - Template suggestions + auto-optimization
 * - KB auto-generation + FAQ extraction
 * - Clustering + insights
 * - AI reply with name extraction, team routing, confidence
 * - Manual reply with tracking + verification
 * - SLA + metrics monitoring
 */

import { helpdeskQueue } from './helpdeskQueue.js';
import {
  processIncomingEmail,
  sendReply as sendPipelineReply,
} from './emailEngine/pipeline.js';
import { verifyEmailToken } from './emailEngine/trustScore.js';

// AI Learning Cache
import {
  findBestCachedResponse,
  cacheAIResponse,
  recordFeedback as recordAIFeedback,
  getAICacheStats,
} from './aiLearningCache.js';

// Intelligence engines
import {
  runSecurityPipeline,
  updateReputation as updateRep,
  getReputationInfo,
  getSecurityStats,
  blacklistEmail as blEmail,
  findCachedReply,
  saveToCache,
  recordFeedback,
  getCacheStats,
  getSuggestedTemplates,
  trackTemplateUsage,
  getTopTemplates,
  promoteToTemplate,
  fillTemplate,
  analyzePromptFeedback,
  shouldPromoteToKB,
  generateKBArticle,
  getKBStats,
  generateFAQs,
  clusterTickets,
  generateInsights,
  // Logging
  saveLog,
  getLogs,
  getTimeSeries,
  groupByField,
  calculateKPIs,
  // Bug detection
  recordDeploy,
  getRecentDeploys,
  findDeployAt,
  detectAllSpikes,
  isDeployRelated,
  getDeployImpact,
  getDeployHistory,
  // Churn prediction
  updateUserProfile,
  recordTicketEvent,
  getUserProfile,
  getAtRiskUsers,
  getChurnStats,
  getChurnLevel,
  batchUpdateUsage,
} from './helpdeskEngines/index.js';

// In-memory ticket store with AI metadata
const tickets = new Map();

/**
 * POST /api/helpdesk/ingest
 * Accept emails, run security pipeline, classify, add to queue with trust score
 */
export async function ingestEmails(req, res) {
  try {
    const { emails } = req.body || { emails: [] };

    if (!emails || emails.length === 0) {
      return res.json({
        queued: 0,
        message: 'No emails to ingest. Pass { emails: [...] } in body.',
      });
    }

    const queued = [];

    for (const email of emails) {
      const { from, subject, snippet, body, priority } = email;
      const emailBody = body || snippet || '';

      // ──── Security Pipeline ────
      const securityResult = runSecurityPipeline({
        from,
        subject,
        body: emailBody,
        history: [], // Would come from DB in production
      });

      // If blocked by security, skip
      if (securityResult.status === 'blocked') {
        queued.push({
          ticketId: null,
          action: 'blocked',
          securityStatus: securityResult.status,
          reason: securityResult.reason,
        });
        continue;
      }

      // Create ticket
      const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const ticket = {
        id: ticketId,
        from,
        subject: subject || '(No Subject)',
        snippet: snippet || '',
        body: emailBody,
        priority: priority || 0,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        replies: [],
        security: securityResult,
        ai: null,
        trust: null,
        action: 'manual',
      };

      // Run AI pipeline (classify, trust, generate reply)
      try {
        const result = await processIncomingEmail({
          from,
          subject: ticket.subject,
          body: emailBody,
          snippet,
        });

        ticket.ai = {
          team: result.classification.team,
          intent: result.classification.intent,
          confidence: result.classification.confidence,
          language: result.classification.language,
          urgency: result.classification.urgency,
          summary: result.classification.summary,
        };

        ticket.trust = {
          score: result.trust.score,
          level: result.trust.level,
          factors: result.trust.factors,
        };

        ticket.action = result.action;
        ticket.suggestedReply = result.suggestedReply;
        ticket.senderName = result.senderName;

        // ──── Semantic Cache: try cache first ────
        const cached = findCachedReply(emailBody, result.classification.team);
        if (cached) {
          ticket.cachedReply = cached.reply;
          ticket.cacheScore = cached.score;
        }

        // ──── Template Suggestions ────
        const suggestions = getSuggestedTemplates(
          result.classification.intent,
          result.classification.language
        );
        ticket.templateSuggestions = suggestions.map(t => ({
          id: t.id,
          preview: t.template.slice(0, 100),
          uses: t.uses,
        }));

      } catch (aiError) {
        console.error(`AI pipeline failed for ticket ${ticketId}:`, aiError.message);
        ticket.action = 'manual';
      }

      // Set priority from AI urgency
      if (ticket.ai?.urgency === 'critical') ticket.priority = 5;
      else if (ticket.ai?.urgency === 'high') ticket.priority = 4;
      else if (ticket.ai?.urgency === 'low') ticket.priority = Math.min(ticket.priority, 2);

      tickets.set(ticketId, ticket);

      // ──── LOGGING ────
      saveLog({
        emailId: ticketId,
        from,
        subject: ticket.subject,
        input: emailBody.slice(0, 1000),
        aiReply: ticket.suggestedReply?.slice(0, 500),
        confidence: ticket.ai?.confidence,
        decision: ticket.action,
        trust: ticket.trust?.level,
        trustScore: ticket.trust?.score,
        intent: ticket.ai?.intent,
        team: ticket.ai?.team,
        language: ticket.ai?.language,
        anomaly: securityResult.reason,
        securityStatus: securityResult.status,
        reputation: securityResult.reputation?.score,
      });

      // ──── Churn: update user profile ────
      if (ticket.ai) {
        recordTicketEvent(from, {
          intent: ticket.ai.intent,
          sentiment: null, // Would come from sentiment analysis
          resolved: false,
        });
      }

      // Add to queue
      await helpdeskQueue.add('process-email', {
        ticketId,
        from,
        subject: ticket.subject,
        priority: ticket.priority,
      }, { priority: ticket.priority });

      queued.push({
        ticketId,
        action: ticket.action,
        team: ticket.ai?.team,
        trustLevel: ticket.trust?.level,
        securityStatus: securityResult.status,
      });
    }

    res.json({ queued: queued.length, results: queued });
  } catch (error) {
    console.error('❌ Helpdesk ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest emails', details: error.message });
  }
}

/**
 * GET /api/helpdesk/inbox
 * List all tickets with AI metadata
 */
export async function getInbox(req, res) {
  try {
    const allTickets = Array.from(tickets.values());

    // Sort by priority (desc) then createdAt (desc)
    allTickets.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.createdAt - a.createdAt;
    });

    const queueStats = await helpdeskQueue.getStats();

    res.json({
      tickets: allTickets.map(t => ({
        id: t.id,
        from: t.from,
        subject: t.subject,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        replyCount: t.replies.length,
        senderName: t.senderName || null,
        ai: t.ai
          ? {
              team: t.ai.team,
              intent: t.ai.intent,
              confidence: t.ai.confidence,
              language: t.ai.language,
              urgency: t.ai.urgency,
            }
          : null,
        trust: t.trust
          ? {
              score: t.trust.score,
              level: t.trust.level,
            }
          : null,
        action: t.action,
      })),
      queue: queueStats,
    });
  } catch (error) {
    console.error('❌ Helpdesk inbox error:', error);
    res.status(500).json({ error: 'Failed to get inbox', details: error.message });
  }
}

/**
 * POST /api/helpdesk/ai-reply
 * Generate AI reply with learning cache → semantic cache → full AI pipeline
 */
export async function aiReply(req, res) {
  try {
    const { subject, text, ticketId, from } = req.body;

    // If ticketId, use ticket data
    let ticketData = null;
    if (ticketId) {
      ticketData = tickets.get(ticketId);
      if (!ticketData) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
    }

    const emailSubject = subject || ticketData?.subject;
    const emailBody = text || ticketData?.body || ticketData?.snippet || '';
    const emailFrom = from || ticketData?.from;

    if (!emailSubject || !emailBody) {
      return res.status(400).json({ error: 'subject and text (or ticketId) are required' });
    }

    // ──── Check AI Learning Cache first ────
    const cached = findBestCachedResponse(emailBody, {
      language: ticketData?.ai?.language,
      intent: ticketData?.ai?.intent,
      threshold: 0.8,
    });

    if (cached) {
      return res.json({
        reply: cached.response,
        senderName: ticketData?.senderName,
        team: ticketData?.ai?.team,
        confidence: 1,
        source: 'learning-cache',
        cacheScore: cached.score,
        cacheKey: cached.entry.key,
      });
    }

    // ──── Check semantic cache (exact similarity) ────
    const team = ticketData?.ai?.team;
    const semanticCached = findCachedReply(emailBody, team);

    if (semanticCached) {
      return res.json({
        reply: semanticCached.reply,
        senderName: ticketData?.senderName,
        team: team,
        confidence: 1,
        source: 'semantic-cache',
        cacheScore: semanticCached.score,
        cacheUses: semanticCached.uses,
      });
    }

    // ──── Cache miss — run full AI pipeline ────
    const result = await processIncomingEmail({
      from: emailFrom || 'unknown',
      subject: emailSubject,
      body: emailBody,
    });

    // Save to both caches
    cacheAIResponse({
      query: emailBody,
      response: result.suggestedReply,
      language: result.classification.language,
      intent: result.classification.intent,
      tags: [result.classification.team],
    });

    saveToCache({
      text: emailBody,
      response: result.suggestedReply,
      team: result.classification.team,
      intent: result.classification.intent,
    });

    // If ticket exists, update it
    if (ticketData) {
      ticketData.ai = {
        team: result.classification.team,
        intent: result.classification.intent,
        confidence: result.classification.confidence,
        language: result.classification.language,
        urgency: result.classification.urgency,
        summary: result.classification.summary,
      };
      ticketData.trust = {
        score: result.trust.score,
        level: result.trust.level,
        factors: result.trust.factors,
      };
      ticketData.action = result.action;
      ticketData.suggestedReply = result.suggestedReply;
      ticketData.senderName = result.senderName;

      // Template suggestions
      const suggestions = getSuggestedTemplates(
        result.classification.intent,
        result.classification.language
      );
      ticketData.templateSuggestions = suggestions.map(t => ({
        id: t.id,
        preview: t.template.slice(0, 100),
        uses: t.uses,
      }));
    }

    res.json({
      reply: result.suggestedReply,
      senderName: result.senderName,
      greeting: result.greeting,
      team: result.classification.team,
      confidence: result.classification.confidence,
      language: result.classification.language,
      action: result.action,
      source: result.classification.source,
      templates: (ticketData?.templateSuggestions || []).slice(0, 3),
    });
  } catch (error) {
    console.error('❌ Helpdesk AI reply error:', error);
    res.status(500).json({ error: 'Failed to generate AI reply', details: error.message });
  }
}

/**
 * POST /api/helpdesk/reply
 * Send manual reply with tracking, verification, feedback recording, KB promotion
 */
export async function replyEmail(req, res) {
  try {
    const { ticketId, message, team = 'support', originalAiReply } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({ error: 'ticketId and message are required' });
    }

    const ticket = tickets.get(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Send reply with tracking + verification
    const sendResult = await sendPipelineReply({
      to: ticket.from,
      subject: ticket.subject.startsWith('Re:') ? ticket.subject : `Re: ${ticket.subject}`,
      body: message,
      team,
      ticketId,
    });

    if (!sendResult.success) {
      return res.status(500).json({ error: 'Failed to send email', details: sendResult.error });
    }

    // Record reply
    const reply = {
      id: `reply_${Date.now()}`,
      team,
      message,
      sentAt: Date.now(),
      emailId: sendResult.emailId,
      trackingId: sendResult.trackingId,
      verificationCode: sendResult.verificationCode,
    };

    ticket.replies.push(reply);
    ticket.status = 'pending';
    ticket.updatedAt = Date.now();

    // ──── Record feedback for AI improvement ────
    if (originalAiReply && originalAiReply !== message) {
      // User edited the AI response — record feedback
      recordFeedback(ticket.body || ticket.snippet, message, team);
      recordAIFeedback(originalAiReply, 'edited');
    } else if (originalAiReply === message) {
      // User accepted AI response as-is
      recordAIFeedback(originalAiReply, 'accepted');
    }

    // Update reputation
    updateRep(ticket.from, 'good_reply');

    // ──── Check if response qualifies for KB article ────
    if (ticket.replies.length >= 3) {
      const replyPattern = {
        uses: ticket.replies.length,
        successRate: 0.9, // Assumed successful since we sent it
      };
      if (shouldPromoteToKB(replyPattern)) {
        generateKBArticle({
          subject: ticket.subject,
          body: ticket.body,
          reply: message,
          intent: ticket.ai?.intent || 'other',
          lang: ticket.ai?.language || 'en',
          team,
        }).catch(err => console.error('KB generation failed:', err.message));
      }
    }

    // ──── LOGGING ────
    saveLog({
      emailId: ticketId,
      from: ticket.from,
      subject: ticket.subject,
      input: (ticket.body || ticket.snippet || '').slice(0, 1000),
      aiReply: originalAiReply?.slice(0, 500),
      finalReply: message.slice(0, 1000),
      edited: originalAiReply && originalAiReply !== message,
      confidence: ticket.ai?.confidence,
      decision: 'sent',
      trust: ticket.trust?.level,
      trustScore: ticket.trust?.score,
      intent: ticket.ai?.intent,
      team,
      language: ticket.ai?.language,
    });

    // ──── Churn: update user profile (resolved) ────
    if (ticket.ai) {
      recordTicketEvent(ticket.from, {
        intent: ticket.ai.intent,
        sentiment: null,
        resolved: true,
        plan: ticket.plan,
      });
      ticket.openTickets = Math.max(0, (ticket.openTickets || 0) - 1);
    }

    res.json({
      sent: true,
      reply,
      ticket: {
        id: ticket.id,
        status: ticket.status,
        replyCount: ticket.replies.length,
      },
    });
  } catch (error) {
    console.error('❌ Helpdesk reply error:', error);
    res.status(500).json({ error: 'Failed to send reply', details: error.message });
  }
}

/**
 * GET /api/helpdesk/verify?token=JWT
 * Verify email authenticity
 */
export async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const decoded = verifyEmailToken(token);

    if (!decoded) {
      return res.json({
        valid: false,
        message: 'Invalid or expired verification token',
      });
    }

    const ticket = tickets.get(decoded.ticketId);

    return res.json({
      valid: true,
      message: '✅ This email is authentically from Winlab',
      details: {
        email: decoded.email,
        ticketId: decoded.ticketId,
        project: decoded.project,
        sentAt: new Date(decoded.ts).toISOString(),
        status: ticket ? ticket.status : 'unknown',
      },
    });
  } catch (error) {
    console.error('❌ Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

/**
 * GET /api/helpdesk/sla
 * System status and SLA metrics
 */
export async function getSLA(req, res) {
  try {
    const queueStats = await helpdeskQueue.getStats();
    const allTickets = Array.from(tickets.values());

    const openTickets = allTickets.filter(t => t.status === 'open');
    const pendingTickets = allTickets.filter(t => t.status === 'pending');
    const resolvedTickets = allTickets.filter(t => t.status === 'resolved');

    // AI metrics
    const aiClassified = allTickets.filter(t => t.ai);
    const avgConfidence = aiClassified.length
      ? aiClassified.reduce((sum, t) => sum + (t.ai?.confidence || 0), 0) / aiClassified.length
      : 0;

    // Trust metrics
    const trustBreakdown = {
      high: allTickets.filter(t => t.trust?.level === 'high').length,
      medium: allTickets.filter(t => t.trust?.level === 'medium').length,
      low: allTickets.filter(t => t.trust?.level === 'low').length,
    };

    // Average response time
    const ticketsWithReplies = allTickets.filter(t => t.replies.length > 0);
    let avgResponseTime = null;
    if (ticketsWithReplies.length > 0) {
      const totalResponseTime = ticketsWithReplies.reduce((sum, t) => {
        const firstReply = t.replies[0]?.sentAt || 0;
        return sum + (firstReply - t.createdAt);
      }, 0);
      avgResponseTime = totalResponseTime / ticketsWithReplies.length;
    }

    // Team distribution
    const teamDist = {};
    allTickets.forEach(t => {
      const team = t.ai?.team || 'unknown';
      teamDist[team] = (teamDist[team] || 0) + 1;
    });

    res.json({
      queue: queueStats,
      tickets: {
        total: allTickets.length,
        open: openTickets.length,
        pending: pendingTickets.length,
        resolved: resolvedTickets.length,
      },
      ai: {
        classified: aiClassified.length,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
      },
      trust: trustBreakdown,
      sla: {
        avgResponseTimeMs: avgResponseTime,
        avgResponseTimeMin: avgResponseTime ? Math.round(avgResponseTime / 60000) : null,
        queueHealth: queueStats.waiting < 50 ? 'healthy' : 'warning',
      },
      teams: teamDist,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('❌ Helpdesk SLA error:', error);
    res.status(500).json({ error: 'Failed to get SLA status', details: error.message });
  }
}

/**
 * GET /api/helpdesk/metrics
 * Queue metrics for dashboard
 */
export async function getMetrics(req, res) {
  try {
    const queueStats = await helpdeskQueue.getStats();
    const allTickets = Array.from(tickets.values());

    const today = Date.now() - 24 * 60 * 60 * 1000;
    const todayReplies = allTickets.reduce(
      (sum, t) => sum + t.replies.filter(r => r.sentAt > today).length,
      0
    );

    res.json({
      queue: queueStats,
      tickets: allTickets.length,
      repliesToday: todayReplies,
      openTickets: allTickets.filter(t => t.status === 'open').length,
    });
  } catch (error) {
    console.error('❌ Helpdesk metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
}

/**
 * GET /api/helpdesk/insights
 * Business insights from ticket data
 */
export async function getInsights(req, res) {
  try {
    const allTickets = Array.from(tickets.values());
    const { insights, clusters } = generateInsights(allTickets);

    res.json({ insights, clusters: clusters || [] });
  } catch (error) {
    console.error('❌ Helpdesk insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
}

/**
 * GET /api/helpdesk/kb
 * Knowledge base articles
 */
export async function getKB(req, res) {
  try {
    const { query, intent, lang, team } = req.query;
    const articles = searchKB({ query, intent, lang, team });
    const stats = getKBStats();

    res.json({ articles, stats });
  } catch (error) {
    console.error('❌ Helpdesk KB error:', error);
    res.status(500).json({ error: 'Failed to get KB articles' });
  }
}

/**
 * GET /api/helpdesk/templates
 * Template suggestions and management
 */
export async function getTemplates(req, res) {
  try {
    const { intent, lang } = req.query;
    const suggestions = intent ? getSuggestedTemplates(intent, lang || 'en') : getTopTemplates();
    const feedback = analyzePromptFeedback([]); // Would get from logs

    res.json({ templates: suggestions, feedbackSuggestions: feedback });
  } catch (error) {
    console.error('❌ Helpdesk templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
}

/**
 * GET /api/helpdesk/faqs
 * Auto-generated FAQ suggestions
 */
export async function getFAQs(req, res) {
  try {
    const allTickets = Array.from(tickets.values());
    const faqs = generateFAQs(allTickets);

    res.json({ faqs });
  } catch (error) {
    console.error('❌ Helpdesk FAQs error:', error);
    res.status(500).json({ error: 'Failed to generate FAQs' });
  }
}

/**
 * GET /api/helpdesk/security
 * Security stats and management
 */
export async function getSecurity(req, res) {
  try {
    const stats = getSecurityStats();
    const cacheStats = getCacheStats();

    res.json({ security: stats, cache: cacheStats });
  } catch (error) {
    console.error('❌ Helpdesk security error:', error);
    res.status(500).json({ error: 'Failed to get security info' });
  }
}

/**
 * POST /api/helpdesk/security/blacklist
 * Manually blacklist an email
 */
export async function blacklistEmail(req, res) {
  try {
    const { email, reason } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    blEmail(email, reason);
    res.json({ blacklisted: true, email, reason });
  } catch (error) {
    console.error('❌ Blacklist error:', error);
    res.status(500).json({ error: 'Failed to blacklist email' });
  }
}

/**
 * GET /api/helpdesk/analytics — Full analytics: KPIs, time series, groupings
 */
export async function getAnalytics(req, res) {
  try {
    const { days = 7 } = req.query;
    const kpis = calculateKPIs({ days: parseInt(days) });
    const timeSeries = getTimeSeries('day', parseInt(days));
    const byIntent = groupByField('intent', { days: parseInt(days) });
    const byTeam = groupByField('team', { days: parseInt(days) });
    const byDecision = groupByField('decision', { days: parseInt(days) });
    const byLanguage = groupByField('language', { days: parseInt(days) });

    res.json({ kpis, timeSeries, byIntent, byTeam, byDecision, byLanguage });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
}

/**
 * GET /api/helpdesk/bugs — Spike analysis + deploy correlation
 */
export async function getBugs(req, res) {
  try {
    const { hours = 2, baselineDays = 7 } = req.query;
    const allLogs = getLogs({ days: parseInt(baselineDays) + 1 });
    const spikes = detectAllSpikes(allLogs, { hours: parseInt(hours), baselineDays: parseInt(baselineDays) });
    const deploys = getRecentDeploys(48);

    res.json({ spikes, deploys, alerts: spikes.filter(s => isDeployRelated(s)) });
  } catch (error) {
    console.error('❌ Bug detection error:', error);
    res.status(500).json({ error: 'Failed to detect bugs' });
  }
}

/**
 * POST /api/helpdesk/deploy — Record a deploy event
 */
export async function recordDeployEvent(req, res) {
  try {
    const { version, environment, deployedBy, changes } = req.body;
    if (!version) return res.status(400).json({ error: 'version is required' });

    const deploy = recordDeploy({ version, environment: environment || 'prod', deployedBy: deployedBy || 'api', changes: changes || [] });
    res.json({ recorded: true, deploy });
  } catch (error) {
    console.error('❌ Deploy recording error:', error);
    res.status(500).json({ error: 'Failed to record deploy' });
  }
}

/**
 * GET /api/helpdesk/churn — Churn prediction + at-risk users
 */
export async function getChurn(req, res) {
  try {
    const { level } = req.query;
    const stats = getChurnStats();
    const atRisk = getAtRiskUsers(level);
    res.json({ stats, atRisk });
  } catch (error) {
    console.error('❌ Churn error:', error);
    res.status(500).json({ error: 'Failed to get churn data' });
  }
}

/**
 * POST /api/helpdesk/churn/update — Batch update user usage
 */
export async function updateChurn(req, res) {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'users array required' });
    batchUpdateUsage(users);
    res.json({ updated: users.length });
  } catch (error) {
    console.error('❌ Churn update error:', error);
    res.status(500).json({ error: 'Failed to update churn data' });
  }
}

/**
 * GET /api/helpdesk/ai-summary — AI-generated state summary
 */
export async function getAISummary(req, res) {
  try {
    const allLogs = getLogs({ days: 7 });
    const kpis = calculateKPIs({ days: 7 });
    const spikes = detectAllSpikes(allLogs, { hours: 4, baselineDays: 7 });
    const churnStats = getChurnStats();
    const deploys = getRecentDeploys(48);

    res.json({
      summary: {
        kpis,
        topIntents: groupByField('intent', { days: 7 }).slice(0, 5),
        spikes: spikes.map(s => ({ intent: s.intent, increasePercent: s.increasePercent, severity: s.severity, deployVersion: s.deployCorrelation?.version })),
        churnHighRisk: churnStats.high,
        recentDeploys: deploys.map(d => d.version),
      },
      generatedAt: Date.now(),
      dataPoints: allLogs.length,
    });
  } catch (error) {
    console.error('❌ AI summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
}

export default {
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
};
