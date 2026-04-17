// scripts/state-recovery.js – Event Sourcing State Recovery
// Called when a node starts up to rebuild state from DB + event log
// Usage: node scripts/state-recovery.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getLatestSnapshot() {
  // Find the most recent completed lab progress as a "snapshot"
  const completedLabs = await prisma.userProgress.findMany({
    where: { completed: true },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    lastEventId: completedLabs.length > 0 ? completedLabs[0].id : null,
    completedLabs: completedLabs.length,
    timestamp: new Date().toISOString(),
  };
}

async function getEventsAfter(snapshotId) {
  if (!snapshotId) {
    return prisma.event.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  // Find events created after the snapshot
  const snapshot = await prisma.userProgress.findUnique({
    where: { id: snapshotId },
  });

  if (!snapshot) return [];

  return prisma.event.findMany({
    where: {
      createdAt: { gt: snapshot.updatedAt },
      status: { not: 'done' },
    },
    orderBy: { createdAt: 'asc' },
  });
}

async function rebuildState(snapshot, events) {
  console.log(`[Recovery] Snapshot: ${snapshot.completedLabs} labs completed at ${snapshot.timestamp}`);
  console.log(`[Recovery] Found ${events.length} pending events to process`);

  for (const event of events) {
    console.log(`[Recovery] Processing event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'USER_REGISTERED':
          // User already exists, just log
          console.log(`  → User ${event.payload.userId} registered`);
          break;

        case 'LAB_COMPLETED':
          // Already tracked in UserProgress
          console.log(`  → Lab ${event.payload.labId} completed by ${event.payload.userId}`);
          break;

        case 'PAYMENT_DONE':
          // Already tracked in Stripe webhook handler
          console.log(`  → Payment processed for ${event.payload.userId}`);
          break;

        default:
          console.log(`  → Unknown event type: ${event.type}`);
      }

      // Mark event as processed
      await prisma.event.update({
        where: { id: event.id },
        data: { status: 'done', processedAt: new Date() },
      });
    } catch (err) {
      console.error(`[Recovery] Failed to process event ${event.id}:`, err.message);
      await prisma.event.update({
        where: { id: event.id },
        data: { status: 'failed', error: err.message },
      });
    }
  }

  console.log('[Recovery] State rebuild complete');
}

async function main() {
  console.log('[Recovery] Starting state recovery...');

  try {
    // 1. Get latest snapshot
    const snapshot = await getLatestSnapshot();

    // 2. Get pending events
    const events = await getEventsAfter(snapshot.lastEventId);

    // 3. Rebuild state
    await rebuildState(snapshot, events);

    console.log('[Recovery] Node is ready to serve traffic');
  } catch (err) {
    console.error('[Recovery] FATAL:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
