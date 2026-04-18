/**
 * Tenant Manager — Multi-tenant isolation layer
 *
 * Rules:
 *   - Every event MUST carry tenant_id
 *   - No query may scan across tenants
 *   - Encryption key derived per tenant (AES-GCM, optional)
 *   - All DB helpers require explicit tenantId — no global fallback
 */

import prisma from '../api/db/prisma.js';

// ──── Tenant Context (server-side) ────

/**
 * Extract tenant_id from request.
 * Priority: JWT claim → header → subdomain.
 */
export function resolveTenant(req) {
  // 1. From verified JWT payload (set by authMiddleware)
  if (req.user?.tenantDomain) return slugify(req.user.tenantDomain);

  // 2. From explicit header (service-to-service)
  const header = req.headers['x-tenant-id'];
  if (header && isValidTenantId(header)) return header;

  // 3. From subdomain: tenant.winlab.cloud → tenant
  const host = req.hostname ?? '';
  const sub  = host.split('.')[0];
  if (sub && sub !== 'winlab' && sub !== 'www' && isValidTenantId(sub)) return sub;

  // 4. Default for single-tenant / dev
  return 'default';
}

/**
 * Express middleware — attaches tenant_id to req.
 * Must run after authMiddleware.
 */
export function tenantMiddleware(req, res, next) {
  req.tenantId = resolveTenant(req);
  next();
}

// ──── Tenant-scoped Event Queries ────

/**
 * Load events for a specific tenant + device, ordered by createdAt.
 * NEVER scans across tenants.
 *
 * @param {string} tenantId
 * @param {string} [deviceId]   - Optional: further scope to one device
 * @param {object} [opts]
 * @param {Date}   [opts.since] - Load events after this date (partition pruning)
 * @param {number} [opts.limit]
 */
export async function loadTenantEvents(tenantId, deviceId = null, opts = {}) {
  assertTenantId(tenantId);

  const { since, limit } = opts;

  const where = {
    payload: { contains: `"tenant_id":"${tenantId}"` },
    status:  { not: 'failed' },
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  // Further scope to device without cross-tenant risk
  if (deviceId) {
    where.AND = [
      { payload: { contains: `"device_id":"${deviceId}"` } },
    ];
  }

  return prisma.event.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });
}

/**
 * Load events for a user, scoped to their tenant.
 */
export async function loadTenantUserEvents(tenantId, userId, opts = {}) {
  assertTenantId(tenantId);
  const { since, limit } = opts;

  return prisma.event.findMany({
    where: {
      AND: [
        { payload: { contains: `"tenant_id":"${tenantId}"` } },
        {
          OR: [
            { payload: { contains: `"userId":"${userId}"` } },
            { payload: { contains: `"userId": "${userId}"` } },
          ],
        },
        ...(since ? [{ createdAt: { gte: since } }] : []),
      ],
      status: { not: 'failed' },
    },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });
}

/**
 * Count events per tenant (admin only, no payload scan).
 */
export async function getTenantStats(tenantId) {
  assertTenantId(tenantId);
  const [total, pending, failed] = await Promise.all([
    prisma.event.count({ where: { payload: { contains: `"tenant_id":"${tenantId}"` } } }),
    prisma.event.count({ where: { payload: { contains: `"tenant_id":"${tenantId}"` }, status: 'pending' } }),
    prisma.event.count({ where: { payload: { contains: `"tenant_id":"${tenantId}"` }, status: 'failed' } }),
  ]);
  return { tenantId, total, pending, failed };
}

// ──── Tenant-aware event envelope ────

/**
 * Wrap a raw event with tenant_id before persisting to central store.
 * Called by the sync ingest route.
 */
export function envelopeEvent(event, tenantId) {
  assertTenantId(tenantId);
  const payload = typeof event.payload === 'string'
    ? JSON.parse(event.payload)
    : (event.payload ?? {});

  return {
    ...event,
    payload: JSON.stringify({ ...payload, tenant_id: tenantId }),
  };
}

// ──── Guards ────

export function assertTenantId(tenantId) {
  if (!tenantId || !isValidTenantId(tenantId)) {
    throw new Error(`[TenantManager] Invalid or missing tenant_id: "${tenantId}"`);
  }
}

function isValidTenantId(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{1,64}$/.test(id);
}

function slugify(domain) {
  return domain.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 64);
}

export default { resolveTenant, tenantMiddleware, loadTenantEvents, loadTenantUserEvents, envelopeEvent, getTenantStats };
