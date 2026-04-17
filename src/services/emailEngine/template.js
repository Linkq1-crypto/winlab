/**
 * Email Template Builder — Stripe-level design
 * Dark mode ready, CTA button, tracking pixel
 */

/**
 * Build a production-grade email template
 * @param {object} opts
 * @param {string} opts.title - Email title/heading
 * @param {string} opts.content - HTML body content
 * @param {string} [opts.ctaText] - CTA button text (optional)
 * @param {string} [opts.ctaLink] - CTA button URL (optional)
 * @param {string} [opts.trackingId] - Tracking ID for open/click tracking
 * @param {string} [opts.domain] - Base domain for tracking links
 * @param {string} [opts.verificationCode] - Anti-phishing verification code
 * @param {string} [opts.verifyToken] - JWT verification token
 * @returns {string} Complete HTML email
 */
export function buildEmail(opts) {
  const {
    title,
    content,
    ctaText,
    ctaLink,
    trackingId,
    domain = 'https://winlab.cloud',
    verificationCode,
    verifyToken,
    signature,
  } = opts;

  const clickLink = ctaLink
    ? `${domain}/track/click?id=${trackingId}&url=${encodeURIComponent(ctaLink)}`
    : '#';

  const openPixel = trackingId
    ? `<img src="${domain}/track/open?id=${trackingId}" width="1" height="1" alt="" />`
    : '';

  const verificationBlock = verificationCode || verifyToken
    ? `
    <tr>
      <td style="padding-top:24px; border-top:1px solid #e2e8f0;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size:12px; color:#64748b;">
              🔐 This email is verified by Winlab<br/>
              ${verificationCode ? `Verification code: <strong style="font-family:monospace; font-size:14px; color:#0f172a;">${verificationCode}</strong><br/>` : ''}
              <a href="${domain}/verify?token=${verifyToken}" style="color:#3b82f6; text-decoration:underline;">
                Verify this email
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `
    : '';

  const ctaBlock = ctaText && ctaLink
    ? `
    <tr>
      <td align="center" style="padding-top:24px;">
        <a href="${clickLink}"
           style="background:#0f172a; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:500; display:inline-block;">
          ${ctaText}
        </a>
      </td>
    </tr>
    `
    : '';

  const signatureBlock = signature
    ? `
    <tr>
      <td style="padding-top:24px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b;">
        —<br/>
        <strong>${signature.name}</strong><br/>
        ${signature.team}<br/>
        <a href="mailto:${signature.email}" style="color:#3b82f6; text-decoration:none;">${signature.email}</a>
      </td>
    </tr>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      body, .email-wrapper { background: #0f172a !important; }
      .email-card { background: #1e293b !important; }
      .email-title, .email-content, .email-sig-name { color: #f1f5f9 !important; }
      .email-content, .email-footer { color: #cbd5e1 !important; }
      .email-verify { color: #94a3b8 !important; border-color: #334155 !important; }
      .email-verify-code { color: #e2e8f0 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-card" style="background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e2e8f0; max-width:600px; width:100%;">

          <!-- HEADER / LOGO -->
          <tr>
            <td style="font-size:18px; font-weight:700; color:#0f172a;" class="email-title">
              WIN<span style="color:#3b82f6;">LAB</span>
            </td>
          </tr>

          <!-- TITLE -->
          <tr>
            <td style="padding-top:20px; font-size:20px; font-weight:600; color:#0f172a;" class="email-title">
              ${title}
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding-top:12px; font-size:14px; color:#334155; line-height:1.7;" class="email-content">
              ${content}
            </td>
          </tr>

          <!-- CTA BUTTON -->
          ${ctaBlock}

          <!-- SIGNATURE -->
          ${signatureBlock}

          <!-- VERIFICATION BLOCK -->
          ${verificationBlock}

          <!-- FOOTER -->
          <tr>
            <td style="padding-top:30px; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0;" class="email-footer">
              © ${new Date().getFullYear()} Winlab — All rights reserved<br/>
              This is an automated message. Please do not reply if sent from noreply@winlab.cloud
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${openPixel}
</body>
</html>
  `.trim();
}

export default buildEmail;
