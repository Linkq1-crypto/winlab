/**
 * supportChat
 *
 * User-facing product support handler.
 * Entry point for all support interactions that are NOT lab-solving.
 *
 * Pipeline:
 *   1. Route ticket (team + urgency)
 *   2. Evaluate escalation rules
 *   3. Try FAQ match (no LLM needed for common questions)
 *   4. If escalated or no FAQ match → create ticket for human review
 *   5. Return immediate response to user
 *
 * This module is intentionally SEPARATE from AIMentor.
 * AIMentor helps users solve labs.
 * supportChat handles product support (account, billing, bugs, etc.)
 */

import { routeTicket }          from './ticketRouter.js';
import { matchFAQ }             from './faqMatcher.js';
import { evaluateEscalation, getSLATarget } from './escalationRules.js';

/**
 * @typedef {Object} SupportChatRequest
 * @property {string} subject
 * @property {string} body
 * @property {string} fromEmail
 * @property {string} [fromName]
 * @property {string} [plan]           - User's current plan
 * @property {number} [ticketsLast24h]
 * @property {boolean} [hasOpenTicket]
 */

/**
 * @typedef {Object} SupportChatResponse
 * @property {'faq'|'escalated'|'queued'} type
 * @property {string} message            - What to show the user immediately
 * @property {string} [ticketId]
 * @property {string} [sla]              - Expected response time
 * @property {object} [routing]          - Internal routing decision
 */

/**
 * @param {SupportChatRequest} req
 * @param {Function} [createTicket]  - async (data) => ticketId
 * @returns {Promise<SupportChatResponse>}
 */
export async function handleSupportRequest(req, createTicket) {
  const {
    subject = '',
    body = '',
    fromEmail,
    fromName,
    plan = 'starter',
    ticketsLast24h = 0,
    hasOpenTicket = false,
  } = req;

  const fullText = `${subject} ${body}`;
  const name     = fromName?.split(' ')[0] || 'there';

  // Step 1: Route
  const routing = routeTicket({ subject, body, fromEmail });

  // Step 2: Escalation check
  const escalation = evaluateEscalation({
    intent:   routing.intent,
    urgency:  routing.urgency,
    team:     routing.team,
    plan,
    ticketsLast24h,
    hasOpenTicket,
    body,
  });

  // Step 3: FAQ match (only for non-escalated, non-critical)
  if (!escalation.escalate && routing.confidence >= 0.6) {
    const faqMatch = matchFAQ(fullText, 0.3);
    if (faqMatch && faqMatch.score >= 0.3) {
      return {
        type: 'faq',
        message: `Hi ${name},\n\n${faqMatch.entry.answer}\n\nLet us know if you need anything else.`,
        routing,
      };
    }
  }

  // Step 4: Create ticket
  const sla      = getSLATarget(escalation.priority, plan);
  let ticketId   = null;

  if (typeof createTicket === 'function') {
    ticketId = await createTicket({
      subject, body, fromEmail, fromName,
      team:     routing.team,
      urgency:  escalation.priority,
      intent:   routing.intent,
      escalate: escalation.escalate,
    });
  }

  if (escalation.escalate) {
    return {
      type: 'escalated',
      message: `Hi ${name},\n\nThank you for reaching out. Your request has been flagged for priority review by our team.\n\nExpected response time: ${sla}.\n\nTicket ID: ${ticketId ?? 'pending'}.`,
      ticketId,
      sla,
      routing,
    };
  }

  return {
    type: 'queued',
    message: `Hi ${name},\n\nWe've received your message and a member of our ${routing.team} team will get back to you.\n\nExpected response time: ${sla}.\n\nTicket ID: ${ticketId ?? 'pending'}.`,
    ticketId,
    sla,
    routing,
  };
}
