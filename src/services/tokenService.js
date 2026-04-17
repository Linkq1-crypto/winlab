/**
 * Token Service — Secure token generation and hashing
 * Tokens are NEVER stored in plaintext — only SHA-256 hashes
 */

import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random token
 * @param {number} byteLength - Bytes of entropy (default 32 = 256 bits)
 * @returns {string} Hex-encoded token
 */
export function generateToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Hash a token using SHA-256
 * Used to store tokens in DB without exposing raw values
 * @param {string} rawToken
 * @returns {string} SHA-256 hex hash
 */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Compare a raw token against a stored hash
 * @param {string} rawToken - The token provided by user
 * @param {string} storedHash - The hash in the database
 * @returns {boolean}
 */
export function verifyToken(rawToken, storedHash) {
  return hashToken(rawToken) === storedHash;
}

/**
 * Generate a time-based verification code (6 digits)
 * @returns {string}
 */
export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export default { generateToken, hashToken, verifyToken, generateOtp };
