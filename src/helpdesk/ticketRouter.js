/**
 * ticketRouter
 *
 * Routes incoming support requests to the correct team and priority.
 * Thin facade over src/services/emailEngine/classifier.js.
 *
 * Handles PRODUCT SUPPORT only:
 *   account issues, billing, login, lab not starting, bug reports.
 *
 * Does NOT handle lab-solving questions — those go to AIMentor.
 */

/**
 * @typedef {Object} SupportRequest
 * @property {string} subject
 * @property {string} body
 * @property {string} fromEmail
 * @property {string} [fromName]
 * @property {'account'|'billing'|'technical'|'bug'|'other'} [category]
 */

/**
 * @typedef {Object} RoutingDecision
 * @property {'support'|'billing'|'security'|'sales'|'legal'} team
 * @property {'low'|'normal'|'high'|'critical'} urgency
 * @property {string} intent
 * @property {number} confidence
 * @property {'auto'|'draft'|'manual'|'block'} action
 */

const BILLING_KEYWORDS  = ['payment', 'charge', 'invoice', 'refund', 'subscription', 'plan', 'billing', 'double', 'fattura', 'pagamento'];
const SECURITY_KEYWORDS = ['hack', 'breach', 'exploit', 'stolen', 'unauthorized', 'compromised'];
const LEGAL_KEYWORDS    = ['gdpr', 'privacy', 'data deletion', 'legal', 'compliance', 'dpa'];
const SALES_KEYWORDS    = ['pricing', 'enterprise', 'team plan', 'discount', 'trial', 'upgrade'];
const BUG_KEYWORDS      = ['bug', 'broken', 'crash', 'error', 'not working', 'not loading', 'stuck'];
const ACCOUNT_KEYWORDS  = ['login', 'password', 'account', 'reset', 'locked', 'signup', 'verify email'];

function matchesAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function detectUrgency(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();
  if (SECURITY_KEYWORDS.some(k => text.includes(k))) return 'critical';
  if (BUG_KEYWORDS.some(k => text.includes(k)) || text.includes('urgent')) return 'high';
  if (BILLING_KEYWORDS.some(k => text.includes(k))) return 'normal';
  return 'low';
}

/**
 * @param {SupportRequest} request
 * @returns {RoutingDecision}
 */
export function routeTicket(request) {
  const { subject = '', body = '', fromEmail = '' } = request;
  const text = `${subject} ${body}`;

  // Security first
  if (matchesAny(text, SECURITY_KEYWORDS)) {
    return { team: 'security', urgency: 'critical', intent: 'security_incident', confidence: 0.9, action: 'manual' };
  }

  // Legal
  if (matchesAny(text, LEGAL_KEYWORDS)) {
    return { team: 'legal', urgency: 'normal', intent: 'legal_compliance', confidence: 0.85, action: 'manual' };
  }

  // Billing
  if (matchesAny(text, BILLING_KEYWORDS)) {
    return { team: 'billing', urgency: detectUrgency(subject, body), intent: 'billing', confidence: 0.85, action: 'draft' };
  }

  // Sales
  if (matchesAny(text, SALES_KEYWORDS)) {
    return { team: 'sales', urgency: 'low', intent: 'sales_inquiry', confidence: 0.8, action: 'draft' };
  }

  // Bug / technical
  if (matchesAny(text, BUG_KEYWORDS)) {
    return { team: 'support', urgency: 'high', intent: 'bug', confidence: 0.8, action: 'draft' };
  }

  // Account
  if (matchesAny(text, ACCOUNT_KEYWORDS)) {
    return { team: 'support', urgency: 'normal', intent: 'account', confidence: 0.75, action: 'draft' };
  }

  // Default
  return { team: 'support', urgency: detectUrgency(subject, body), intent: 'general', confidence: 0.5, action: 'draft' };
}
