/**
 * Email Service — Centralized email sender via Resend
 * Graceful fallback when API key is not configured (dev mode)
 */

import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Send an email via Resend
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @param {object} [options] - Optional: text, replyTo, tags
 */
export async function sendEmail(to, subject, html, options = {}) {
  if (!resend) {
    // Dev mode: log instead of send
    if (!env.isProduction) {
      console.log(`\n📧 [DEV MODE] Email would be sent to: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body (preview): ${html.replace(/<[^>]*>/g, '').substring(0, 120)}...\n`);
      return { id: 'dev-mode-' + Date.now(), status: 'logged' };
    }
    throw new Error('RESEND_API_KEY is not configured');
  }

  const result = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject,
    html,
    text: options.text || html.replace(/<[^>]*>/g, ''),
    replyTo: options.replyTo || 'support@winlab.cloud',
    tags: options.tags || [],
  });

  return result;
}

/**
 * Send email with HTML template wrapper
 * @param {string} to
 * @param {string} subject
 * @param {string} body - HTML content (inner)
 * @param {object} [options]
 */
export function sendTemplatedEmail(to, subject, body, options = {}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0b; color: #e2e8f0; margin: 0; padding: 24px; }
        .container { max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; }
        .logo { font-size: 24px; font-weight: 900; margin-bottom: 24px; }
        .logo span:first-child { color: #3b82f6; }
        .logo span:last-child { color: #fff; }
        .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
        .btn:hover { background: #2563eb; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; }
        .warning { background: #7c3aed10; border: 1px solid #7c3aed30; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 13px; color: #a78bfa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo"><span>WIN</span><span>LAB</span></div>
        ${body}
        <div class="footer">
          <p>© ${new Date().getFullYear()} WINLAB. All rights reserved.</p>
          <p>Questions? Reply to this email or contact <a href="mailto:support@winlab.cloud" style="color: #3b82f6;">support@winlab.cloud</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html, options);
}

export default { sendEmail, sendTemplatedEmail };
