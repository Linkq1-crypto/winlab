/**
 * Email Sender — Resend integration with tracking
 * Sends emails with verification, tracking, and team signatures
 */

import { Resend } from 'resend';
import { sendEmail as sendExisting } from '../emailService.js';
import { buildEmail } from './template.js';
import { generateVerificationCode, generateVerifyToken } from './trustScore.js';
import { getTeamTone } from './config.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send a helpdesk reply email with full tracking and verification
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body (AI or manual)
 * @param {string} params.team - Team name (support, billing, sales, etc.)
 * @param {string} [params.ticketId] - Ticket reference ID
 * @param {string} [params.fromName] - Sender's name (for tracking context)
 * @returns {Promise<object>} Send result
 */
export async function sendHelpdeskReply(params) {
  const { to, subject, body, team = 'support', ticketId, fromName } = params;

  // Generate tracking/verification
  const verificationCode = generateVerificationCode();
  const verifyToken = ticketId
    ? generateVerifyToken({ email: to, ticketId, project: 'winlab' })
    : null;
  const trackingId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Build HTML email with tracking
  const html = buildEmail({
    title: subject,
    content: body.replace(/\n/g, '<br/>'),
    trackingId,
    verificationCode,
    verifyToken,
    signature: getSignature(team),
    domain: process.env.APP_URL || 'https://winlab.cloud',
  });

  // Send via Resend (or fallback to existing email service)
  try {
    if (resend) {
      const result = await resend.emails.send({
        from: getFromAddress(team),
        to,
        subject,
        html,
        replyTo: 'support@winlab.cloud',
        headers: {
          'X-Team': team,
          'X-Ticket-Id': ticketId || '',
          'X-Tracking-Id': trackingId,
          'X-Verify-Code': verificationCode,
        },
      });

      return {
        success: true,
        emailId: result.data?.id || trackingId,
        trackingId,
        verificationCode,
        verifyToken,
      };
    }

    // Fallback to existing email service
    const result = await sendExisting(to, subject, html);
    return {
      success: true,
      emailId: result.id || trackingId,
      trackingId,
      verificationCode,
      verifyToken,
    };
  } catch (error) {
    console.error('Failed to send helpdesk email:', error);
    return {
      success: false,
      error: error.message,
      trackingId,
      verificationCode,
    };
  }
}

/**
 * Get the correct from address per team
 */
function getFromAddress(team) {
  const addresses = {
    support: 'Winlab Support <support@winlab.cloud>',
    billing: 'Winlab Billing <billing@winlab.cloud>',
    sales: 'Winlab Sales <sales@winlab.cloud>',
    legal: 'Winlab Legal <privacy@winlab.cloud>',
    security: 'Winlab Security <security@winlab.cloud>',
  };
  return addresses[team] || addresses.support;
}

/**
 * Get team email routing address
 */
export function getTeamEmail(team) {
  const emails = {
    support: 'support@winlab.cloud',
    billing: 'billing@winlab.cloud',
    sales: 'sales@winlab.cloud',
    legal: 'privacy@winlab.cloud',
    security: 'security@winlab.cloud',
    abuse: 'abuse@winlab.cloud',
  };
  return emails[team] || emails.support;
}

export default { sendHelpdeskReply, getTeamEmail };
