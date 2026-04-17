/**
 * Early Access Email Templates
 * Sends confirmation emails with locked $5 price and access date
 */

import { sendEmail } from './emailService.js';

/**
 * Send early access confirmation email
 * Includes locked price ($5) and access date
 */
export async function sendEarlyAccessConfirmation({
  email,
  name,
  signupDate,
  accessDate,
  lockedPrice = 5.0,
}) {
  const formattedAccessDate = new Date(accessDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WinLab Early Access Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0b; color: #ffffff;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0b;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a1e; border-radius: 12px; overflow: hidden;">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px 20px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                    WIN<span style="color: #60a5fa;">LAB</span>
                  </h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9);">
                    Early Access Confirmed 🎉
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 30px;">
                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #e5e7eb;">
                    Hi ${name || 'there'},
                  </p>
                  
                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #e5e7eb;">
                    You're officially on the <strong style="color: #60a5fa;">WinLab Early Access List</strong>! 
                    We're building the future of hands-on infrastructure learning, and you've secured your spot.
                  </p>

                  <!-- Price Lock Box -->
                  <table role="presentation" style="width: 100%; background-color: rgba(37, 99, 235, 0.1); border: 2px solid #2563eb; border-radius: 8px; margin: 30px 0;">
                    <tr>
                      <td style="padding: 24px;">
                        <p style="margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #60a5fa; font-weight: 700;">
                          🔒 Your Price is Locked
                        </p>
                        <p style="margin: 0 0 8px; font-size: 48px; font-weight: 900; color: #ffffff; line-height: 1;">
                          $${lockedPrice}
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                          Early access price — regular price will be $19/month
                        </p>
                        <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280; font-style: italic;">
                          This price is guaranteed for you, no matter when we launch.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Access Date -->
                  <table role="presentation" style="width: 100%; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #10b981; font-weight: 700;">
                          📅 Your Access Date
                        </p>
                        <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                          ${formattedAccessDate}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- What's Included -->
                  <h3 style="margin: 30px 0 16px; font-size: 18px; font-weight: 700; color: #ffffff;">
                    What's Included:
                  </h3>
                  <ul style="margin: 0; padding-left: 20px; color: #e5e7eb; line-height: 1.8;">
                    <li>All 10 production-ready infrastructure labs</li>
                    <li>Unlimited AI Mentor assistance</li>
                    <li>Real server incident simulations</li>
                    <li>Certificate of Excellence upon completion</li>
                    <li>Cloud progress sync across devices</li>
                    <li>Early access to new labs and features</li>
                  </ul>

                  <!-- CTA -->
                  <table role="presentation" style="margin: 40px auto 0;">
                    <tr>
                      <td align="center" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px;">
                        <a href="https://winlab.cloud" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
                          Visit WinLab.cloud →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 40px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                    Questions? Just reply to this email or reach out at 
                    <a href="mailto:support@winlab.cloud" style="color: #60a5fa; text-decoration: none;">support@winlab.cloud</a>
                  </p>

                  <p style="margin: 20px 0 0; font-size: 14px; color: #9ca3af;">
                    See you soon,<br>
                    <strong style="color: #ffffff;">The WinLab Team</strong>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px 30px; background-color: #151518; text-align: center; border-top: 1px solid #2a2a2e;">
                  <p style="margin: 0; font-size: 12px; color: #6b7280;">
                    © ${new Date().getFullYear()} WinLab. All rights reserved.
                  </p>
                  <p style="margin: 8px 0 0; font-size: 11px; color: #4b5563;">
                    You received this email because you signed up for early access at winlab.cloud
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
WinLab Early Access Confirmed! 🎉

Hi ${name || 'there'},

You're officially on the WinLab Early Access List!

🔒 YOUR LOCKED PRICE: $${lockedPrice}
   (Regular price will be $19/month — you save 74%!)

📅 YOUR ACCESS DATE: ${formattedAccessDate}

What's Included:
- All 10 production-ready infrastructure labs
- Unlimited AI Mentor assistance
- Real server incident simulations
- Certificate of Excellence upon completion
- Cloud progress sync across devices
- Early access to new labs and features

This price is guaranteed for you, no matter when we launch.

Questions? Contact us at support@winlab.cloud

See you soon,
The WinLab Team

Visit: https://winlab.cloud
  `;

  return await sendEmail(email, `🎉 You're in! WinLab Early Access Confirmed (Locked: $${lockedPrice})`, html, {
    text,
    tags: [
      { name: 'type', value: 'early_access_confirmation' },
      { name: 'locked_price', value: lockedPrice.toString() },
    ],
  });
}

/**
 * Send early access spots full notification
 */
export async function sendEarlyAccessSoldOut(email) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>WinLab Early Access - Sold Out</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0b; color: #ffffff;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #0a0a0b;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #1a1a1e; border-radius: 12px;">
              <tr>
                <td style="padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0 0 20px; font-size: 28px; color: #ef4444;">
                    Early Access Sold Out 😢
                  </h1>
                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #e5e7eb;">
                    All 500 early access spots have been claimed. 
                    The $5 locked price is no longer available.
                  </p>
                  <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #e5e7eb;">
                    Join our waitlist to be notified if spots open up or when we launch at regular pricing.
                  </p>
                  <a href="https://winlab.cloud" style="display: inline-block; padding: 14px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;">
                    Join Waitlist
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail(email, 'WinLab Early Access - All Spots Claimed', html, {
    tags: [{ name: 'type', value: 'early_access_sold_out' }],
  });
}

export default {
  sendEarlyAccessConfirmation,
  sendEarlyAccessSoldOut,
};
