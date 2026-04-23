import { createRateLimiter } from "./rateLimit.js";

function userKey(req) {
  return req.user?.id || req.user?.userId || req.body?.userId || "anonymous";
}

function tenantKey(req) {
  return req.user?.tenantId || req.headers["x-tenant-id"] || req.body?.tenantId || "default";
}

export const rateLimitByIP = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyFn: (req) => `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`,
});

export const rateLimitByUser = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyFn: (req) => `user:${userKey(req)}`,
});

export const rateLimitByTenant = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyFn: (req) => `tenant:${tenantKey(req)}`,
});

export default { rateLimitByIP, rateLimitByUser, rateLimitByTenant };
