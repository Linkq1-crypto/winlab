const buckets = new Map();

function pruneBucket(timestamps, now, windowMs) {
  return timestamps.filter((ts) => now - ts < windowMs);
}

export function createRateLimiter({
  windowMs = 60_000,
  maxRequests = 10,
  keyFn,
} = {}) {
  if (typeof keyFn !== "function") {
    throw new Error("createRateLimiter requires keyFn");
  }

  return function rateLimit(req, res, next) {
    const key = String(keyFn(req) || "anonymous");
    const now = Date.now();
    const valid = pruneBucket(buckets.get(key) || [], now, windowMs);

    valid.push(now);
    buckets.set(key, valid);

    if (valid.length > maxRequests) {
      return res.status(429).json({
        ok: false,
        error: {
          message: "Rate limit exceeded",
          retryAfterMs: windowMs,
        },
      });
    }

    return next();
  };
}

export function clearRateLimitBuckets() {
  buckets.clear();
}

export default { createRateLimiter, clearRateLimitBuckets };
