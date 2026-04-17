/**
 * Webhook Idempotency Service - Prevents duplicate event processing
 * Tracks processed event IDs to ensure each webhook event is handled only once
 */

import prisma from '../api/db/prisma.js';

/**
 * Check if a webhook event has already been processed
 * Returns true if event was already handled (idempotent)
 */
export async function isEventProcessed(eventId) {
  const existing = await prisma.processedWebhookEvent.findUnique({
    where: { eventId },
  });
  return existing !== null;
}

/**
 * Mark a webhook event as processed
 * Should be called AFTER successful event handling
 */
export async function markEventProcessed(eventId, eventType, metadata = {}) {
  return await prisma.processedWebhookEvent.create({
    data: {
      eventId,
      eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Safely process a webhook event with idempotency check
 * Wraps the handler to prevent duplicate processing
 * 
 * @param {string} eventId - Unique event ID from payment provider
 * @param {string} eventType - Type of event (checkout.session.completed, etc.)
 * @param {Function} handler - Async function to execute if not already processed
 * @param {Object} metadata - Optional metadata to store
 * @returns {Object} { processed: boolean, result?: any }
 */
export async function processWebhookEvent(eventId, eventType, handler, metadata = {}) {
  // Check if already processed
  const alreadyProcessed = await isEventProcessed(eventId);
  
  if (alreadyProcessed) {
    console.log(`[WebhookIdempotency] Event already processed: ${eventId}`);
    return { processed: false, reason: 'already_processed' };
  }

  try {
    // Execute the handler
    const result = await handler();
    
    // Mark as processed ONLY after successful handling
    await markEventProcessed(eventId, eventType, metadata);
    
    return { processed: true, result };
  } catch (error) {
    // Don't mark as processed if handler failed
    // This allows retry on next delivery
    console.error(`[WebhookIdempotency] Handler failed for ${eventId}:`, error.message);
    throw error;
  }
}

/**
 * Clean up old processed events (older than 30 days)
 * Should be called periodically to prevent table bloat
 */
export async function cleanupOldProcessedEvents(olderThanDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const deleted = await prisma.processedWebhookEvent.deleteMany({
    where: {
      processedAt: {
        lt: cutoffDate,
      },
    },
  });

  return deleted.count;
}

/**
 * Get stats on processed events
 */
export async function getProcessedEventsStats() {
  const [total, todayCount, last7Days] = await Promise.all([
    prisma.processedWebhookEvent.count(),
    prisma.processedWebhookEvent.count({
      where: {
        processedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.processedWebhookEvent.count({
      where: {
        processedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    total,
    todayCount,
    last7Days,
  };
}

export default {
  isEventProcessed,
  markEventProcessed,
  processWebhookEvent,
  cleanupOldProcessedEvents,
  getProcessedEventsStats,
};
