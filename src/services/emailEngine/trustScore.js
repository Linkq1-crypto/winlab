/**
 * Trust Score Engine — Anti-phishing verification
 * Calculates email trust level based on domain, SPF/DKIM, verification tokens
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const EMAIL_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-do-not-use-in-prod';

/**
 * Generate a unique verification code (8-char hex)
 * @returns {string} e.g., "A9F3C1D2"
 */
export function generateVerificationCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generate a JWT verification token for email authenticity
 * @param {object} data - { email, ticketId, project }
 * @returns {string} JWT token
 */
export function generateVerifyToken(data) {
  return jwt.sign(
    {
      email: data.email,
      ticketId: data.ticketId,
      project: data.project || 'winlab',
      ts: Date.now(),
      type: 'email-verify',
    },
    EMAIL_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify a JWT token from email verification link
 * @param {string} token - JWT token from URL query param
 * @returns {object|null} Decoded payload or null if invalid
 */
export function verifyEmailToken(token) {
  try {
    return jwt.verify(token, EMAIL_SECRET);
  } catch {
    return null;
  }
}

/**
 * Calculate trust score for an incoming email
 * @param {object} emailData - { from, spf, dkim, tokenValid, domain }
 * @returns {object} { score: number, level: 'high'|'medium'|'low', factors: string[] }
 */
export function calculateTrust(emailData) {
  let score = 0;
  const factors = [];

  // Domain verification
  const fromDomain = extractDomain(emailData.from);
  if (fromDomain && ['winlab.cloud', 'winlab.io'].includes(fromDomain)) {
    score += 25;
    factors.push('verified_domain');
  }

  // SPF check
  if (emailData.spf === 'pass') {
    score += 20;
    factors.push('spf_pass');
  } else if (emailData.spf === 'fail') {
    score -= 30;
    factors.push('spf_fail');
  }

  // DKIM check
  if (emailData.dkim === 'pass') {
    score += 20;
    factors.push('dkim_pass');
  } else if (emailData.dkim === 'fail') {
    score -= 30;
    factors.push('dkim_fail');
  }

  // Known sender patterns
  const knownDomains = [
    'gmail.com', 'outlook.com', 'yahoo.com',
    'protonmail.com', 'icloud.com', 'mail.com',
  ];
  if (fromDomain && knownDomains.includes(fromDomain)) {
    score += 15;
    factors.push('known_provider');
  }

  // Suspicious patterns
  const fromLower = (emailData.from || '').toLowerCase();
  const suspiciousPatterns = [
    'noreply', 'no-reply', 'donotreply',
    'admin', 'root', 'postmaster',
  ];
  if (suspiciousPatterns.some(p => fromLower.includes(p))) {
    score -= 10;
    factors.push('system_address');
  }

  // Empty or very short content (spam indicator)
  if (emailData.contentLength && emailData.contentLength < 10) {
    score -= 15;
    factors.push('very_short_content');
  }

  // Clamp score 0-100
  score = Math.max(0, Math.min(100, score));

  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, level, factors };
}

/**
 * Extract domain from email address
 * @param {string} email - "user@domain.com" or "Name <user@domain.com>"
 * @returns {string|null}
 */
function extractDomain(email) {
  if (!email) return null;
  const match = email.match(/@([^\s>]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Determine action recommendation based on trust level
 * @param {string} trustLevel - 'high', 'medium', 'low'
 * @param {object} aiClassification - AI classification result
 * @returns {string} 'auto' | 'draft' | 'manual' | 'block'
 */
export function recommendAction(trustLevel, aiClassification) {
  // Low trust → always manual or block
  if (trustLevel === 'low') {
    if (aiClassification?.shouldReply === false) return 'block';
    return 'manual';
  }

  // Medium trust → at most draft
  if (trustLevel === 'medium') {
    if (aiClassification?.confidence >= 0.8) return 'draft';
    return 'manual';
  }

  // High trust → follow AI confidence
  if (!aiClassification) return 'draft';

  if (aiClassification.confidence >= 0.85) return 'auto';
  if (aiClassification.confidence >= 0.5) return 'draft';
  return 'manual';
}

export default {
  generateVerificationCode,
  generateVerifyToken,
  verifyEmailToken,
  calculateTrust,
  recommendAction,
};
