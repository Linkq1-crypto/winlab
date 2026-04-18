// scripts/state-recovery.js – Pure State Rebuild from Event Log
// Called on node startup or manual recovery.
// Usage: node scripts/state-recovery.js [--user <userId>] [--dry-run]
//
// State is NEVER read from DB tables directly.
// It is always recomputed from the Event log — same log = same state.

import { PrismaClient } from '@prisma/client';
import { rebuildState, rebuildUserState, createSnapshot } from '../src/services/stateRebuildEngine.js';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    userId:  args.includes('--user')    ? args[args.indexOf('--user') + 1]    : null,
    dryRun:  args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
  };
}

// ──── Load ordered event log ────
async function loadEvents(userId = null) {
  const where = userId
    ? { OR: [
        { payload: { contains: `"userId":"${userId}"` } },
        { payload: { contains: `"userId": "${userId}"` } },
      ]}
    : {};

  return prisma.event.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
}

// ──── Validate rebuilt state against DB ────
// Compares key fields between rebuilt state and live DB rows.
// Reports divergences — does NOT fix them (that's the event log's job).
async function validateState(builtState, opts = {}) {
  const mismatches = [];

  // Check user account statuses
  const dbUsers = await prisma.user.findMany({ select: { id: true, accountStatus: true, totalXp: true } });
  for (const dbUser of dbUsers) {
    const built = builtState.users[dbUser.id];
    if (!built) {
      mismatches.push({ type: 'USER_MISSING_IN_STATE', userId: dbUser.id });
      continue;
    }
    if (built.accountStatus !== dbUser.accountStatus) {
      mismatches.push({ type: 'ACCOUNT_STATUS_MISMATCH', userId: dbUser.id, built: built.accountStatus, db: dbUser.accountStatus });
    }
  }

  // Check lab completions
  const dbProgress = await prisma.userProgress.findMany({ where: { completed: true } });
  for (const row of dbProgress) {
    const userLabs = builtState.labProgress[row.userId] ?? {};
    const lab      = userLabs[row.labId];
    if (!lab?.completed) {
      mismatches.push({ type: 'LAB_COMPLETION_MISSING_IN_STATE', userId: row.userId, labId: row.labId });
    }
  }

  if (opts.verbose) {
    console.log(`[Validate] Checked ${dbUsers.length} users, ${dbProgress.length} lab completions`);
  }

  return mismatches;
}

// ──── Main ────
async function main() {
  const opts = parseArgs();
  console.log('[Recovery] Starting pure state rebuild from event log...');
  console.log(`[Recovery] Mode: ${opts.dryRun ? 'DRY RUN' : 'LIVE'} | User filter: ${opts.userId ?? 'ALL'}`);

  try {
    // 1. Load ordered event log (source of truth)
    const events = await loadEvents(opts.userId);
    console.log(`[Recovery] Loaded ${events.length} events`);

    if (events.length === 0) {
      console.log('[Recovery] No events found — nothing to rebuild');
      return;
    }

    // 2. Rebuild state — pure, deterministic
    const { state, eventsApplied, lastEventId } = opts.userId
      ? (() => {
          const s = rebuildUserState(events, opts.userId);
          return { state: { users: {}, ...s, labProgress: { [opts.userId]: s.labProgress }, subscriptions: { [opts.userId]: s.subscription }, skills: { [opts.userId]: s.skills }, badges: { [opts.userId]: s.badges }, payments: { [opts.userId]: s.payments }, earlyAccess: {} }, eventsApplied: events.length, lastEventId: events.at(-1)?.id };
        })()
      : rebuildState(events);

    console.log(`[Recovery] Rebuilt state from ${eventsApplied} events (last: ${lastEventId})`);
    console.log(`[Recovery] Users in state:  ${Object.keys(state.users).length}`);
    console.log(`[Recovery] Labs in state:   ${Object.values(state.labProgress).reduce((n, u) => n + Object.keys(u).length, 0)}`);
    console.log(`[Recovery] Subs in state:   ${Object.values(state.subscriptions).filter(Boolean).length}`);

    // 3. Validate rebuilt state vs live DB (report only — no writes)
    if (!opts.userId) {
      const mismatches = await validateState(state, opts);
      if (mismatches.length > 0) {
        console.warn(`[Recovery] ⚠️  ${mismatches.length} divergence(s) found between event log and DB:`);
        mismatches.forEach(m => console.warn('  ', JSON.stringify(m)));
        console.warn('[Recovery] Divergences mean DB was mutated outside the event log. Re-emit missing events to reconcile.');
      } else {
        console.log('[Recovery] ✅ Event log state matches DB — no divergences');
      }
    }

    // 4. Create snapshot (performance cache, NOT source of truth)
    if (!opts.dryRun) {
      const snapshot = createSnapshot(state, lastEventId);
      console.log(`[Recovery] Snapshot created at ${new Date(snapshot.createdAt).toISOString()} (v${snapshot.snapshotVersion})`);
    }

    console.log('[Recovery] Node is ready to serve traffic');
  } catch (err) {
    console.error('[Recovery] FATAL:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
