const tenantRunning = new Map();
let globalRunning = 0;

function getTenantKey(tenantId) {
  return String(tenantId || "default").slice(0, 64);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSlot(tenantId, { tenantLimit, globalLimit, pollMs }) {
  const key = getTenantKey(tenantId);
  for (;;) {
    const t = tenantRunning.get(key) || 0;
    if (t < tenantLimit && globalRunning < globalLimit) return;
    await delay(pollMs);
  }
}

export async function runQueuedJob(tenantId, fn, opts = {}) {
  const tenantLimit = Number(opts.tenantLimit || process.env.CODEX_TENANT_CONCURRENCY || 2);
  const globalLimit = Number(opts.globalLimit || process.env.CODEX_GLOBAL_CONCURRENCY || 4);
  const pollMs = Number(opts.pollMs || 50);

  const key = getTenantKey(tenantId);
  await waitForSlot(key, { tenantLimit, globalLimit, pollMs });

  tenantRunning.set(key, (tenantRunning.get(key) || 0) + 1);
  globalRunning += 1;
  try {
    return await fn();
  } finally {
    tenantRunning.set(key, Math.max(0, (tenantRunning.get(key) || 1) - 1));
    if (tenantRunning.get(key) === 0) tenantRunning.delete(key);
    globalRunning = Math.max(0, globalRunning - 1);
  }
}

export default { runQueuedJob };
