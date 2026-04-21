/**
 * User Lifecycle Email Flow — Complete identity email lifecycle
 * Covers: verify → reset → security → deletion
 *
 * Token Security Rules:
 * - Tokens are NEVER stored in plaintext
 * - Only SHA-256 hashes are saved to DB
 * - Short expiry windows (15min for reset, 24h for verify)
 */

import { env } from '../config/env.js';
import { sendTemplatedEmail } from './emailService.js';
import { generateToken, hashToken } from './tokenService.js';
import prisma from '../api/db/prisma.js';

// Token expiry windows
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;    // 24 hours
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;           // 15 minutes

/**
 * Send email verification link
 * @param {object} user - Prisma user object
 */
export async function sendVerifyEmail(user) {
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Store hashed token with expiry
  await prisma.verificationToken.upsert({
    where: { userId: user.id },
    update: { token: tokenHash, expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
    create: { userId: user.id, token: tokenHash, expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
  });

  const link = `${env.appBaseUrl}/verify?token=${token}`;

  await sendTemplatedEmail(
    user.email,
    '🔵 Verify your WinLab account',
    `
      <h2 style="margin-top:0">Welcome to WinLab!</h2>
      <p style="color:#94a3b8">Your account is almost ready. Click the button below to verify your email address.</p>
      <a href="${link}" class="btn">Verify Email →</a>
      <p style="color:#64748b; font-size:13px; margin-top:8px;">
        Or copy this link: <code style="color:#94a3b8">${link}</code>
      </p>
      <div class="warning">
        ⏱️ This link expires in 24 hours.
      </div>
    `
  );

  return { token, link };
}

/**
 * Send password reset email with short expiry
 * @param {object} user - Prisma user object
 */
export async function sendPasswordResetEmail(user) {
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Store hashed token with 15min expiry
  await prisma.passwordReset.create({
    data: { userId: user.id, token: tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const link = `${env.appBaseUrl}/reset-password?token=${token}`;

  await sendTemplatedEmail(
    user.email,
    '🔑 Reset your password — WinLab',
    `
      <h2 style="margin-top:0">Password Reset Request</h2>
      <p style="color:#94a3b8">Someone requested a password reset for your WinLab account.</p>
      <a href="${link}" class="btn">Reset Password →</a>
      <p style="color:#64748b; font-size:13px; margin-top:8px;">
        Or copy this link: <code style="color:#94a3b8">${link}</code>
      </p>
      <div class="warning">
        ⚠️ This link expires in <strong>15 minutes</strong>. If you didn't request this, ignore this email.
      </div>
    `
  );

  return { token, link };
}

/**
 * Send new device / security login alert
 * @param {object} user
 * @param {string} ipAddress
 * @param {string} userAgent
 */
export async function sendNewDeviceLoginEmail(user, ipAddress, userAgent) {
  await sendTemplatedEmail(
    user.email,
    '🛡️ New login detected — WinLab Security',
    `
      <h2 style="margin-top:0">New Login Detected</h2>
      <p style="color:#94a3b8">A new login was detected on your WinLab account from:</p>
      <div style="background:#1e293b; border-radius:8px; padding:16px; margin:16px 0; font-family:monospace;">
        <p style="margin:4px 0; color:#e2e8f0;"><strong>IP:</strong> ${ipAddress}</p>
        <p style="margin:4px 0; color:#e2e8f0;"><strong>Browser:</strong> ${userAgent}</p>
        <p style="margin:4px 0; color:#e2e8f0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <div class="warning">
        🚨 If this wasn't you, <a href="${env.appBaseUrl}/reset-password" style="color:#a78bfa;">reset your password immediately</a>.
      </div>
    `
  );
}

/**
 * Send account deletion confirmation
 * @param {object} user
 */
export async function sendAccountDeletedEmail(user) {
  await sendTemplatedEmail(
    user.email,
    '🗑️ Account deleted — WinLab',
    `
      <h2 style="margin-top:0">Account Deleted</h2>
      <p style="color:#94a3b8">Your WinLab account has been permanently deleted.</p>
      <p style="color:#94a3b8">All your data, lab progress, and certificates have been removed from our systems.</p>
      <div class="warning">
        If this was not expected, contact <a href="mailto:support@winlab.cloud" style="color:#a78bfa;">support@winlab.cloud</a> immediately.
      </div>
    `
  );
}

/**
 * Verify a token from URL and mark user as verified
 * @param {string} rawToken
 * @returns {object|null} User if successful, null otherwise
 */
export async function verifyEmailToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const verification = await prisma.verificationToken.findFirst({
    where: { token: tokenHash, expiresAt: { gt: new Date() } },
  });

  if (!verification) return null;

  // Mark user as verified
  const user = await prisma.user.update({
    where: { id: verification.userId },
    data: { emailVerified: true },
  });

  // Delete used token
  await prisma.verificationToken.delete({ where: { id: verification.id } });

  return user;
}

/**
 * Send welcome email after registration
 * @param {object} user - Prisma user object
 */
export async function sendWelcomeEmail(user) {
  const name = user.name || user.email.split("@")[0];
  const dashboardUrl = `${env.appBaseUrl || "https://winlab.cloud"}`;

  await sendTemplatedEmail(
    user.email,
    "[ ACCESS GRANTED ] Welcome to WinLab",
    `
      <div style="font-family:'Courier New',Courier,monospace;background:#000;border:1px solid #1a1a1a;border-radius:4px;padding:24px;margin-bottom:24px;">
        <div style="color:#666;font-size:11px;margin-bottom:16px;letter-spacing:2px;">WINLAB — SECURE SHELL</div>
        <div style="color:#555;font-size:12px;margin-bottom:4px;">$ whoami</div>
        <div style="color:#e5e7eb;font-size:13px;margin-bottom:16px;">${name}</div>
        <div style="color:#555;font-size:12px;margin-bottom:4px;">$ ./access --grant --plan=starter</div>
        <div style="color:#22c55e;font-size:13px;margin-bottom:4px;">[ OK ] Identity verified</div>
        <div style="color:#22c55e;font-size:13px;margin-bottom:4px;">[ OK ] Lab environment provisioned</div>
        <div style="color:#22c55e;font-size:13px;margin-bottom:16px;">[ OK ] Access granted → 6 free labs unlocked</div>
        <div style="color:#555;font-size:12px;margin-bottom:4px;">$ ls ~/labs/free/</div>
        <div style="color:#93c5fd;font-size:12px;line-height:1.8;">
          linux-terminal/<br>
          raid-simulator/<br>
          os-install/<br>
          vsphere/<br>
          sssd-ldap/<br>
          real-server/
        </div>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 20px;">Your sysadmin training environment is ready. Start with Lab 01 and work your way up to enterprise scenarios.</p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#fff;color:#000;font-family:'Courier New',monospace;font-weight:900;font-size:13px;padding:12px 28px;text-decoration:none;letter-spacing:1px;">[ ENTER WINLAB ]</a>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1a1a1a;">
        <div style="color:#374151;font-size:11px;font-family:'Courier New',monospace;line-height:1.8;">
          free plan · 6 labs · no credit card required<br>
          upgrade anytime → unlock all 24 labs + AI Mentor
        </div>
      </div>
    `
  );
}

/**
 * Verify a reset token and return associated user
 * @param {string} rawToken
 * @returns {object|null} User if valid, null otherwise
 */
export async function verifyResetToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const reset = await prisma.passwordReset.findFirst({
    where: { token: tokenHash, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!reset) return null;

  // Delete used token
  await prisma.passwordReset.delete({ where: { id: reset.id } });

  return reset.user;
}

export default {
  sendVerifyEmail,
  sendPasswordResetEmail,
  sendNewDeviceLoginEmail,
  sendAccountDeletedEmail,
  verifyEmailToken,
  verifyResetToken,
  VERIFY_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
};
