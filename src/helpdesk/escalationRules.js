/**
 * escalationRules
 *
 * Defines when a support ticket must be escalated beyond
 * automated handling. These rules are evaluated BEFORE auto-reply.
 *
 * Escalation triggers:
 *   - Security incidents
 *   - Legal / GDPR requests
 *   - Repeat contacts (user already sent >N tickets in 24h)
 *   - Churn signals (pro/business user threatening to cancel)
 *   - High-value user (business plan)
 */

/**
 * @typedef {Object} EscalationContext
 * @property {string}   intent
 * @property {string}   urgency
 * @property {string}   team
 * @property {string}   plan          - 'starter'|'pro'|'business'
 * @property {number}   ticketsLast24h
 * @property {boolean}  hasOpenTicket
 * @property {string}   body
 */

/**
 * @typedef {Object} EscalationDecision
 * @property {boolean}  escalate
 * @property {string}   reason
 * @property {'support'|'billing'|'security'|'management'} escalateTo
 * @property {'low'|'normal'|'high'|'critical'} priority
 */

const CHURN_SIGNALS = ['cancel', 'leaving', 'refund', 'switching', 'waste of money', 'disappointed', 'terrible', 'useless'];

/**
 * @param {EscalationContext} ctx
 * @returns {EscalationDecision}
 */
export function evaluateEscalation(ctx) {
  const { intent, urgency, team, plan, ticketsLast24h, hasOpenTicket, body = '' } = ctx;
  const bodyLower = body.toLowerCase();

  // Security incidents always escalate
  if (team === 'security' || urgency === 'critical') {
    return { escalate: true, reason: 'security incident or critical urgency', escalateTo: 'security', priority: 'critical' };
  }

  // Legal always manual
  if (team === 'legal' || intent === 'legal_compliance') {
    return { escalate: true, reason: 'legal/compliance request requires human review', escalateTo: 'support', priority: 'high' };
  }

  // Churn signal from paying user
  if ((plan === 'pro' || plan === 'business') && CHURN_SIGNALS.some(s => bodyLower.includes(s))) {
    return { escalate: true, reason: 'churn signal from paying user', escalateTo: 'management', priority: 'high' };
  }

  // Business plan always gets human attention
  if (plan === 'business') {
    return { escalate: true, reason: 'business plan user — SLA requires human review', escalateTo: 'support', priority: 'high' };
  }

  // Repeat contact: user sent >3 tickets in 24h
  if (ticketsLast24h >= 3) {
    return { escalate: true, reason: `repeat contact: ${ticketsLast24h} tickets in 24h`, escalateTo: 'support', priority: 'high' };
  }

  // Has an unresolved open ticket on same topic
  if (hasOpenTicket && (intent === 'bug' || intent === 'account')) {
    return { escalate: true, reason: 'open ticket exists for same topic', escalateTo: 'support', priority: 'normal' };
  }

  return { escalate: false, reason: 'no escalation triggers matched', escalateTo: 'support', priority: 'normal' };
}

/**
 * Returns a human-readable SLA target based on priority and plan.
 *
 * @param {'low'|'normal'|'high'|'critical'} priority
 * @param {string} plan
 * @returns {string}
 */
export function getSLATarget(priority, plan) {
  if (priority === 'critical')               return '1 hour';
  if (priority === 'high' && plan === 'business') return '2 hours';
  if (priority === 'high')                   return '4 hours';
  if (plan === 'business')                   return '8 hours';
  return '24 hours';
}
