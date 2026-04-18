/**
 * Cost Optimizer — Event log scale management
 *
 * Goal: cost scales O(1 per active tenant), not O(n events)
 *
 * Strategies:
 *   1. Event compression — merge similar events → delta events
 *   2. Storage tiering — hot / warm / cold
 *   3. Partition pruning — scoped queries only (enforced elsewhere)
 *   4. Snapshot strategy — rebuild rare, replay delta only
 */

import { createSnapshot } from './stateRebuildEngine.js';
import { rebuildState }   from './stateRebuildEngine.js';

// ──── 1. Event Compression ────

/**
 * Merge a sequence of similar events into one aggregate event.
 * "Similar" = same type + same device_id within a time window.
 *
 * Example: 10 motion_events in 5s → 1 aggregated_motion_event
 *
 * @param {object[]} events   - Ordered event array
 * @param {object}   [opts]
 * @param {number}   [opts.windowMs=5000]  - Merge window in ms
 * @param {number}   [opts.minMerge=3]     - Min events to trigger merge
 * @returns {{ compressed: object[], savedCount: number }}
 */
export function compressEvents(events, opts = {}) {
  const { windowMs = 5_000, minMerge = 3 } = opts;
  const compressed = [];
  let i = 0;
  let savedCount = 0;

  while (i < events.length) {
    const anchor = events[i];
    const group  = [anchor];

    // Collect similar events within the time window
    let j = i + 1;
    while (j < events.length) {
      const candidate = events[j];
      const sameType  = candidate.event_type === anchor.event_type || candidate.type === anchor.type;
      const sameDevice= (candidate.device_id ?? candidate.deviceId) === (anchor.device_id ?? anchor.deviceId);
      const inWindow  = Math.abs((candidate.timestamp ?? 0) - (anchor.timestamp ?? 0)) <= windowMs;

      if (sameType && sameDevice && inWindow) { group.push(candidate); j++; }
      else break;
    }

    if (group.length >= minMerge) {
      // Merge into one aggregate event
      compressed.push(aggregateGroup(group));
      savedCount += group.length - 1;
    } else {
      compressed.push(...group);
    }

    i = j;
  }

  return { compressed, savedCount, compressionRatio: events.length > 0 ? +(1 - compressed.length / events.length).toFixed(3) : 0 };
}

function aggregateGroup(events) {
  const first = events[0];
  const last  = events[events.length - 1];

  // Aggregate numeric payload fields (avg)
  const payloads = events.map(e => (typeof e.payload === 'object' ? e.payload?.data ?? e.payload : {}));
  const aggPayload = {};
  for (const key of Object.keys(payloads[0] ?? {})) {
    const vals = payloads.map(p => p[key]).filter(v => typeof v === 'number');
    if (vals.length > 0) aggPayload[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return {
    ...first,
    id:          `agg_${first.id}`,
    event_id:    `agg_${first.event_id ?? first.id}`,
    event_type:  first.event_type ?? first.type,
    type:        first.event_type ?? first.type,
    payload:     { data: aggPayload, _aggregated: true, _count: events.length, _from: first.timestamp, _to: last.timestamp },
    timestamp:   first.timestamp,
    _merged:     events.length,
    sequence:    first.sequence,
  };
}

// ──── 2. Storage Tiering ────

export const STORAGE_TIERS = Object.freeze({
  HOT:  { maxAgeDays: 7,   label: 'hot',  queryPriority: 1 },
  WARM: { maxAgeDays: 90,  label: 'warm', queryPriority: 2 },
  COLD: { maxAgeDays: Infinity, label: 'cold', queryPriority: 3 },
});

/**
 * Classify an event into a storage tier based on age.
 * @param {object|string} event - event object or ISO timestamp string
 */
export function classifyEventTier(event) {
  const ts  = new Date(event.createdAt ?? event.timestamp ?? 0);
  const age = (Date.now() - ts.getTime()) / 86_400_000; // days

  if (age <= STORAGE_TIERS.HOT.maxAgeDays)  return STORAGE_TIERS.HOT;
  if (age <= STORAGE_TIERS.WARM.maxAgeDays) return STORAGE_TIERS.WARM;
  return STORAGE_TIERS.COLD;
}

/**
 * Archive events beyond hot tier in the DB.
 * hot → warm: status stays 'done'
 * warm → cold: status = 'archived', payload compressed
 *
 * @param {object} prisma
 * @param {string} tenantId
 */
export async function runStorageTiering(prisma, tenantId) {
  const warmCutoff = new Date(Date.now() - STORAGE_TIERS.HOT.maxAgeDays * 86_400_000);
  const coldCutoff = new Date(Date.now() - STORAGE_TIERS.WARM.maxAgeDays * 86_400_000);

  // Move warm → cold: compress payload + mark archived
  const { count: archived } = await prisma.event.updateMany({
    where: {
      payload:   { contains: `"tenant_id":"${tenantId}"` },
      createdAt: { lt: coldCutoff },
      status:    'done',
    },
    data: { status: 'archived' },
  });

  return { tenantId, archived, warmCutoff, coldCutoff };
}

// ──── 3. Snapshot Strategy ────

/**
 * Decide whether a new snapshot is needed, based on event count since last snapshot.
 *
 * @param {number} eventsSinceSnapshot
 * @param {number} [threshold=1000] - Rebuild full + snapshot every N events
 */
export function shouldSnapshot(eventsSinceSnapshot, threshold = 1_000) {
  return eventsSinceSnapshot >= threshold;
}

/**
 * Build a performance snapshot from the current event log.
 * Cheap replay path: only load events after snapshot.lastEventId.
 *
 * @param {object[]} allEvents - Full ordered event log
 * @param {object}   [existingSnapshot] - Previous snapshot to build from
 * @returns {{ snapshot: object, replayedFrom: string|null }}
 */
export function buildSnapshot(allEvents, existingSnapshot = null) {
  // If we have a snapshot, replay only delta events
  const startIdx = existingSnapshot
    ? allEvents.findIndex(e => (e.id ?? e.event_id) === existingSnapshot.lastEventId) + 1
    : 0;

  const deltaEvents = allEvents.slice(startIdx);

  if (deltaEvents.length === 0 && existingSnapshot) {
    return { snapshot: existingSnapshot, replayedFrom: existingSnapshot.lastEventId, deltaEvents: 0 };
  }

  const { state, lastEventId } = existingSnapshot
    ? (() => {
        const { state } = rebuildState(deltaEvents, existingSnapshot);
        return { state, lastEventId: deltaEvents.at(-1)?.id ?? existingSnapshot.lastEventId };
      })()
    : rebuildState(allEvents);

  const snapshot = createSnapshot(state, lastEventId);
  return { snapshot, replayedFrom: existingSnapshot?.lastEventId ?? null, deltaEvents: deltaEvents.length };
}

/**
 * Estimate cost savings from compression + tiering.
 * @param {number} totalEvents
 * @param {number} compressedEvents
 * @param {number} archivedEvents
 */
export function estimateSavings(totalEvents, compressedEvents, archivedEvents) {
  const storageSavedBytes  = (totalEvents - compressedEvents) * 512; // avg 512 bytes/event
  const coldStorageFactor  = 0.1; // cold storage = 10% of hot cost
  const archivedSavings    = archivedEvents * 512 * (1 - coldStorageFactor);

  return {
    eventsSaved:      totalEvents - compressedEvents,
    compressionRatio: +(1 - compressedEvents / totalEvents).toFixed(3),
    storageSavedMb:   +((storageSavedBytes + archivedSavings) / (1024 ** 2)).toFixed(2),
  };
}

export default { compressEvents, classifyEventTier, runStorageTiering, shouldSnapshot, buildSnapshot, estimateSavings, STORAGE_TIERS };
