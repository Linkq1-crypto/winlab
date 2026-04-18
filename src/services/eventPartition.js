/**
 * Event Log Partitioning
 *
 * Partition key: tenant_id / device_id / date-bucket
 * Rule: never global scan. Always filtered replay.
 *
 * Physical layout (logical — maps to DB index strategy):
 *   tenant_a / device_1 / 2026-04-18 / [events]
 *   tenant_a / device_1 / 2026-04-19 / [events]
 *   tenant_b / device_2 / 2026-04-18 / [events]
 */

import prisma from '../api/db/prisma.js';
import { assertTenantId } from './tenantManager.js';

// ──── Partition Key ────

/**
 * Build a partition key string for logging / cache keys.
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {Date|string|number} [date] - defaults to today
 */
export function partitionKey(tenantId, deviceId, date = new Date()) {
  const d = new Date(date);
  const bucket = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return `${tenantId}/${deviceId}/${bucket}`;
}

/**
 * Build an hourly bucket key (sub-partition for high-frequency devices).
 */
export function hourlyPartitionKey(tenantId, deviceId, date = new Date()) {
  const d = new Date(date);
  const bucket = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
  return `${tenantId}/${deviceId}/${bucket}`;
}

// ──── Scoped Queries (no global scan) ────

/**
 * Load events for one partition (tenant + device + day).
 * This is the primary replay unit — keep it cheap.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {Date}   date        - Any moment within the target day
 * @param {object} [opts]
 * @param {number} [opts.limit]
 */
export async function loadPartition(tenantId, deviceId, date, opts = {}) {
  assertTenantId(tenantId);

  const start = startOfDay(new Date(date));
  const end   = endOfDay(new Date(date));

  return prisma.event.findMany({
    where: {
      AND: [
        { payload: { contains: `"tenant_id":"${tenantId}"` } },
        { payload: { contains: `"device_id":"${deviceId}"` } },
        { createdAt: { gte: start, lte: end } },
        { status: { not: 'failed' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    ...(opts.limit ? { take: opts.limit } : {}),
  });
}

/**
 * Load events across a date range for a device — still scoped to tenant.
 * Use for multi-day replay or state rebuild from snapshot.
 *
 * @param {string} tenantId
 * @param {string} deviceId
 * @param {Date}   from
 * @param {Date}   to
 * @param {object} [opts]
 */
export async function loadPartitionRange(tenantId, deviceId, from, to, opts = {}) {
  assertTenantId(tenantId);

  return prisma.event.findMany({
    where: {
      AND: [
        { payload: { contains: `"tenant_id":"${tenantId}"` } },
        { payload: { contains: `"device_id":"${deviceId}"` } },
        { createdAt: { gte: new Date(from), lte: new Date(to) } },
        { status: { not: 'failed' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    ...(opts.limit ? { take: opts.limit } : {}),
  });
}

/**
 * Count events in a partition — cheap stats without full load.
 */
export async function countPartition(tenantId, deviceId, date) {
  assertTenantId(tenantId);
  const start = startOfDay(new Date(date));
  const end   = endOfDay(new Date(date));

  return prisma.event.count({
    where: {
      AND: [
        { payload: { contains: `"tenant_id":"${tenantId}"` } },
        { payload: { contains: `"device_id":"${deviceId}"` } },
        { createdAt: { gte: start, lte: end } },
      ],
    },
  });
}

/**
 * List distinct date buckets that have events for a device.
 * Used to build the replay timeline UI.
 */
export async function listBuckets(tenantId, deviceId, from, to) {
  assertTenantId(tenantId);

  const events = await prisma.event.findMany({
    where: {
      AND: [
        { payload: { contains: `"tenant_id":"${tenantId}"` } },
        { payload: { contains: `"device_id":"${deviceId}"` } },
        { createdAt: { gte: new Date(from), lte: new Date(to) } },
      ],
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Deduplicate by day bucket
  const seen = new Set();
  const buckets = [];
  for (const { createdAt } of events) {
    const key = createdAt.toISOString().slice(0, 10);
    if (!seen.has(key)) { seen.add(key); buckets.push(key); }
  }
  return buckets;
}

/**
 * Archive events older than N days for a tenant.
 * Marks them as 'archived' — does not delete (audit-safe).
 *
 * @param {string} tenantId
 * @param {number} [olderThanDays=90]
 */
export async function archiveOldPartitions(tenantId, olderThanDays = 90) {
  assertTenantId(tenantId);
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);

  const { count } = await prisma.event.updateMany({
    where: {
      payload: { contains: `"tenant_id":"${tenantId}"` },
      createdAt: { lt: cutoff },
      status: 'done',
    },
    data: { status: 'archived' },
  });

  return { archived: count, cutoff };
}

// ──── Helpers ────
function pad(n) { return String(n).padStart(2, '0'); }
function startOfDay(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)); }
function endOfDay(d)   { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)); }
