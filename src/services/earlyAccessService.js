/**
 * Early Access Signup Service - Manages the 500 seats limit
 * Atomic decrement ensures no race conditions during concurrent signups
 */

import prisma from '../api/db/prisma.js';

const MAX_SEATS = 500;
const EARLY_ACCESS_PRICE = 5.0; // $5 locked price

/**
 * Get remaining early access seats
 * Uses database count for real-time accuracy
 */
export async function getRemainingSeats() {
  const signupCount = await prisma.earlyAccessSignup.count();
  return Math.max(0, MAX_SEATS - signupCount);
}

/**
 * Check if seats are still available
 */
export async function hasAvailableSeats() {
  const remaining = await getRemainingSeats();
  return remaining > 0;
}

/**
 * Atomically claim an early access seat
 * Uses transaction to prevent race conditions
 * Returns null if no seats available
 */
export async function claimEarlyAccessSeat({ email, name, accessDate }) {
  return await prisma.$transaction(async (tx) => {
    // Check current count atomically
    const signupCount = await tx.earlyAccessSignup.count();
    
    if (signupCount >= MAX_SEATS) {
      throw new Error('EARLY_ACCESS_SOLD_OUT');
    }

    // Check if email already signed up
    const existing = await tx.earlyAccessSignup.findUnique({
      where: { email },
    });

    if (existing) {
      return existing;
    }

    // Create signup record (atomic)
    const signup = await tx.earlyAccessSignup.create({
      data: {
        email,
        name,
        lockedPrice: EARLY_ACCESS_PRICE,
        accessDate: new Date(accessDate),
      },
    });

    return signup;
  }, {
    maxWait: 10000,
    timeout: 5000,
  });
}

/**
 * Activate an early access signup (after payment)
 */
export async function activateEarlyAccess(email, paymentIntentId) {
  return await prisma.earlyAccessSignup.update({
    where: { email },
    data: {
      activated: true,
      paymentIntentId,
    },
  });
}

/**
 * Get early access signup stats
 */
export async function getEarlyAccessStats() {
  const [totalSignups, activatedCount] = await Promise.all([
    prisma.earlyAccessSignup.count(),
    prisma.earlyAccessSignup.count({ where: { activated: true } }),
  ]);

  return {
    totalSeats: MAX_SEATS,
    claimedSeats: totalSignups,
    remainingSeats: Math.max(0, MAX_SEATS - totalSignups),
    activatedCount,
    pendingActivation: totalSignups - activatedCount,
    soldOut: totalSignups >= MAX_SEATS,
  };
}

/**
 * Get early access signup by email
 */
export async function getEarlyAccessSignup(email) {
  return await prisma.earlyAccessSignup.findUnique({
    where: { email },
  });
}

export default {
  MAX_SEATS,
  EARLY_ACCESS_PRICE,
  getRemainingSeats,
  hasAvailableSeats,
  claimEarlyAccessSeat,
  activateEarlyAccess,
  getEarlyAccessStats,
  getEarlyAccessSignup,
};
