// eventSourcing.js – Outbox Pattern for atomic event publishing
// Wraps Prisma operations in a transaction that also creates an Event record.
// A separate worker (not included here) processes pending events.

import prisma from "./db/prisma.js";

/**
 * Execute a DB operation within a transaction that also creates an outbox Event.
 * @param {function} txFn - Function that receives the Prisma transaction client and returns data
 * @param {string} eventType - Event type string (e.g., "USER_REGISTERED")
 * @param {function} payloadFn - Function that takes the txFn result and returns the event payload
 * @returns The result of txFn
 */
export async function executeWithOutbox(txFn, eventType, payloadFn) {
  return prisma.$transaction(async (tx) => {
    const result = await txFn(tx);
    const payload = payloadFn ? payloadFn(result) : {};

    await tx.event.create({
      data: {
        type: eventType,
        payload: JSON.stringify(typeof payload === "object" ? payload : { raw: payload }),
        status: "pending",
        version: 1,
        attempts: 0,
      },
    });

    return result;
  });
}

/**
 * Process pending events (called by worker or cron).
 * Processes up to `batchSize` events at a time.
 */
export async function processPendingEvents(batchSize = 10) {
  const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min – stale lock detection

  // Find pending or stale processing events
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { status: "pending" },
        {
          status: "processing",
          lockedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_MS) },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const results = [];
  for (const event of events) {
    // Lock the event
    await prisma.event.update({
      where: { id: event.id },
      data: { status: "processing", lockedAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      // TODO: Add event handler logic here based on event.type
      // Example:
      //   if (event.type === "USER_REGISTERED") await handleUserRegistered(event);
      //   if (event.type === "LAB_COMPLETED") await handleLabCompleted(event);

      await prisma.event.update({
        where: { id: event.id },
        data: { status: "done", processedAt: new Date() },
      });
      results.push({ id: event.id, status: "done" });
    } catch (error) {
      const maxAttempts = 5;
      if (event.attempts >= maxAttempts) {
        await prisma.event.update({
          where: { id: event.id },
          data: { status: "failed", error: error.message },
        });
        results.push({ id: event.id, status: "failed", error: error.message });
      } else {
        // Reset to pending for retry
        await prisma.event.update({
          where: { id: event.id },
          data: { status: "pending", lockedAt: null },
        });
        results.push({ id: event.id, status: "retry" });
      }
    }
  }

  return results;
}

export default { executeWithOutbox, processPendingEvents };
