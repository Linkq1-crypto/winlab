const tenantUsage = new Map();

function getTenantId(req) {
  return req.user?.tenantId || req.headers["x-tenant-id"] || req.body?.tenantId || "default";
}

function getRequestCost(req) {
  return req.body?.mode === "patch" ? 3 : 1;
}

export function enforceTenantBudget({
  windowMs = 60_000,
  maxCost = 20,
} = {}) {
  return function tenantBudget(req, res, next) {
    const tenantId = String(getTenantId(req)).slice(0, 100);
    const now = Date.now();
    const records = tenantUsage.get(tenantId) || [];
    const valid = records.filter((record) => now - record.ts < windowMs);
    const currentCost = valid.reduce((sum, record) => sum + record.cost, 0);
    const cost = getRequestCost(req);

    if (currentCost + cost > maxCost) {
      tenantUsage.set(tenantId, valid);
      return res.status(429).json({
        ok: false,
        error: {
          message: "Tenant budget exceeded",
          currentCost,
          limit: maxCost,
        },
      });
    }

    valid.push({ ts: now, cost });
    tenantUsage.set(tenantId, valid);
    return next();
  };
}

export function clearTenantBudgetUsage() {
  tenantUsage.clear();
}

export default { enforceTenantBudget, clearTenantBudgetUsage };
