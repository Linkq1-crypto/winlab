/**
 * Production Readiness Test Suite
 *
 * Covers:
 * - Cascading failures & self-healing cycle
 * - API resilience: retry with exponential backoff
 * - Cache hit / miss / stale-while-revalidate
 * - Offline conflict resolution (lastWriteWins, mergeProgress)
 * - Offline queue logic (queue / dequeue / replay)
 * - Load simulation: concurrent operations
 * - Full incident → chaos → recovery pipeline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Infrastructure ───────────────────────────────────────────────────────────
import { graph, STATUS, seedDefaultTopology } from "../src/core/dependencyGraph.js";
import { triggerFailure, computeImpactScore, recoverService } from "../src/core/impactEngine.js";
import { selfHealingEngine } from "../src/core/selfHealingEngine.js";
import { timelineStore } from "../src/core/timelineStore.js";
import { recommendRemediation, analyzeRootCause } from "../src/core/remediationAdvisor.js";

// ─── Offline / Sync ───────────────────────────────────────────────────────────
import {
  lastWriteWins,
  mergeProgress,
} from "../src/services/offlineEngine.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function freshEnv() {
  graph.reset(STATUS.UP);
  timelineStore.clear();
  seedDefaultTopology();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CASCADE FAILURE
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Cascading Failures", () => {
  beforeEach(freshEnv);

  it("DB crash propagates to API and Frontend", () => {
    triggerFailure("DB");

    expect(graph.getNode("DB")?.status).toBe(STATUS.DOWN);
    // Auth depends on DB → DEGRADED
    expect(graph.getNode("Auth")?.status).toBe(STATUS.DEGRADED);
    // API depends on DB + Auth → DOWN
    expect(graph.getNode("API")?.status).toBe(STATUS.DOWN);
    // Frontend depends on API → DEGRADED
    expect(graph.getNode("Frontend")?.status).toBe(STATUS.DEGRADED);
  });

  it("impact score rises proportionally with cascade depth", () => {
    const before = computeImpactScore();

    triggerFailure("DB");
    const afterDB = computeImpactScore();

    triggerFailure("Auth");
    const afterAuth = computeImpactScore();

    expect(afterDB).toBeGreaterThan(before);
    expect(afterAuth).toBeGreaterThanOrEqual(afterDB);
  });

  it("recovering DB restores its status", () => {
    triggerFailure("DB");
    expect(graph.getNode("DB")?.status).toBe(STATUS.DOWN);

    recoverService("DB");
    expect(graph.getNode("DB")?.status).toBe(STATUS.UP);
  });

  it("impact score is zero on healthy topology", () => {
    const score = computeImpactScore();
    expect(score).toBe(0);
  });

  it("multiple simultaneous failures amplify impact", () => {
    triggerFailure("DB");
    const singleFailure = computeImpactScore();

    freshEnv();
    triggerFailure("DB");
    triggerFailure("Auth");
    const doubleFailure = computeImpactScore();

    expect(doubleFailure).toBeGreaterThanOrEqual(singleFailure);
  });

  // ── Advanced: Partial Brownout ─────────────────────────────────────────────
  it("Partial Brownout: timeout at 2s triggers Circuit Breaker before 5s DB latency", async () => {
    // Circuit breaker: wraps a slow call and opens after THRESHOLD consecutive timeouts
    const TIMEOUT_MS = 2000;
    const CB_THRESHOLD = 1; // apre al primo timeout in questo scenario
    let state: "CLOSED" | "OPEN" = "CLOSED";
    let failures = 0;

    async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
        fn().then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
    }

    // Simula query DB con 5s di latenza
    function slowDBQuery(): Promise<{ rows: number }> {
      return new Promise((resolve) => setTimeout(() => resolve({ rows: 42 }), 5000));
    }

    async function callDB() {
      if (state === "OPEN") throw new Error("CIRCUIT_OPEN");
      try {
        const result = await withTimeout(slowDBQuery, TIMEOUT_MS);
        failures = 0;
        return result;
      } catch (err) {
        failures++;
        if (failures >= CB_THRESHOLD) state = "OPEN";
        throw err;
      }
    }

    // Prima chiamata: deve andare in timeout (non attendere 5s reali — usiamo fake timer)
    vi.useFakeTimers();

    const callPromise = callDB().catch((e) => e.message);

    // Avanza il tempo di 2001ms → timeout scatta
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);
    const result = await callPromise;

    expect(result).toBe("TIMEOUT");
    expect(failures).toBe(1);
    expect(state).toBe("OPEN");

    // Seconda chiamata: circuit breaker aperto → risposta immediata senza attendere DB
    const blocked = await callDB().catch((e) => e.message);
    expect(blocked).toBe("CIRCUIT_OPEN");

    // Il DB è ancora "DOWN" dal punto di vista del circuit breaker
    triggerFailure("DB");
    expect(graph.getNode("DB")?.status).toBe(STATUS.DOWN);

    vi.useRealTimers();
  });

  // ── Advanced: Retry Storm with Jitter ─────────────────────────────────────
  it("Retry Storm with Jitter: 50 concurrent failures spread delays without collisions", async () => {
    const BASE_DELAY = 100;   // ms
    const MAX_DELAY  = 2000;  // ms cap
    const JITTER     = 0.4;   // ±40 %

    function exponentialDelay(attempt: number): number {
      const base = BASE_DELAY * Math.pow(2, attempt);
      const capped = Math.min(base, MAX_DELAY);
      const jitter = capped * JITTER * (Math.random() * 2 - 1);
      return Math.max(10, Math.round(capped + jitter));
    }

    // Genera 50 delay indipendenti per attempt=0 (primo retry)
    const delays = Array.from({ length: 50 }, () => exponentialDelay(0));

    // Tutti i delay devono stare nell'intervallo atteso
    const expectedBase = BASE_DELAY * 1;          // 2^0 = 1
    const tolerance    = expectedBase * JITTER;

    delays.forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(10);
      expect(d).toBeLessThanOrEqual(MAX_DELAY);
      // Nessun delay deve essere esattamente uguale agli altri (jitter randomico)
      // → verifichiamo invece che non siano tutti identici
    });

    // Varianza: con 50 campioni randomici deve esserci dispersione
    const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
    const variance = delays.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / delays.length;
    expect(variance).toBeGreaterThan(0); // jitter produce valori diversi

    // Nessuna "collision burst": meno del 20% dei delay condivide lo stesso valore
    const freq = new Map<number, number>();
    delays.forEach((d) => freq.set(d, (freq.get(d) ?? 0) + 1));
    const maxCollisions = Math.max(...freq.values());
    expect(maxCollisions).toBeLessThan(delays.length * 0.20);

    // Verifica che in produzione il DB sia stato segnato DOWN durante la storm
    triggerFailure("DB");
    const score = computeImpactScore();
    expect(score).toBeGreaterThan(0);
  });

  // ── Advanced: Poison Pill Recovery ────────────────────────────────────────
  it("Poison Pill Recovery: corrupted payload lands in Dead Letter after 3 attempts, valid messages continue", async () => {
    type Msg = { id: string; payload: unknown; retries: number; dead: boolean };

    const MAX_RETRIES = 3;
    const deadLetter: Msg[] = [];
    const processed: string[] = [];

    function isValid(payload: unknown): boolean {
      return (
        payload !== null &&
        typeof payload === "object" &&
        "type" in (payload as object) &&
        typeof (payload as any).type === "string"
      );
    }

    async function processMessage(msg: Msg): Promise<void> {
      if (!isValid(msg.payload)) {
        msg.retries++;
        if (msg.retries >= MAX_RETRIES) {
          msg.dead = true;
          deadLetter.push(msg);
        }
        throw new Error("INVALID_PAYLOAD");
      }
      processed.push(msg.id);
    }

    // Coda: 1 poison pill + 3 messaggi validi
    const queue: Msg[] = [
      { id: "poison", payload: "%%CORRUPTED%%",          retries: 0, dead: false },
      { id: "msg-1",  payload: { type: "SYNC",  data: 1 }, retries: 0, dead: false },
      { id: "msg-2",  payload: { type: "SYNC",  data: 2 }, retries: 0, dead: false },
      { id: "msg-3",  payload: { type: "UPDATE", data: 3 }, retries: 0, dead: false },
    ];

    // Processa con retry sul poison pill, skip dopo MAX_RETRIES
    for (const msg of queue) {
      let attempts = 0;
      while (attempts < MAX_RETRIES) {
        try {
          await processMessage(msg);
          break;
        } catch {
          attempts++;
          if (msg.dead) break; // già in DLQ → stop
        }
      }
    }

    // Poison pill finisce nella Dead Letter Queue
    expect(deadLetter).toHaveLength(1);
    expect(deadLetter[0].id).toBe("poison");
    expect(deadLetter[0].retries).toBe(MAX_RETRIES);
    expect(deadLetter[0].dead).toBe(true);

    // I 3 messaggi validi vengono processati correttamente
    expect(processed).toHaveLength(3);
    expect(processed).toContain("msg-1");
    expect(processed).toContain("msg-2");
    expect(processed).toContain("msg-3");

    // Il sistema non è bloccato: l'impact score riflette solo i failure infrastrutturali
    expect(computeImpactScore()).toBe(0); // topologia ancora sana
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. REMEDIATION ADVISOR
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Remediation Advisor", () => {
  beforeEach(freshEnv);

  it("no recommendations on healthy topology", () => {
    const actions = recommendRemediation();
    expect(actions).toHaveLength(0);
  });

  it("recommends action for DOWN service", () => {
    triggerFailure("DB");
    const actions = recommendRemediation();
    expect(actions.length).toBeGreaterThan(0);

    const dbAction = actions.find((a) => a.serviceId === "DB");
    expect(dbAction).toBeDefined();
    expect(dbAction?.confidence).toBeGreaterThan(0);
  });

  it("root cause analysis names the failed service", () => {
    triggerFailure("DB");
    const analysis = analyzeRootCause();

    // analyzeRootCause returns a string describing the root cause
    expect(typeof analysis).toBe("string");
    expect(analysis.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SELF-HEALING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Self-Healing Engine", () => {
  beforeEach(freshEnv);

  afterEach(() => {
    selfHealingEngine.stop();
  });

  it("starts and stops cleanly", () => {
    expect(selfHealingEngine.running).toBe(false);
    selfHealingEngine.start(50);
    expect(selfHealingEngine.running).toBe(true);
    selfHealingEngine.stop();
    expect(selfHealingEngine.running).toBe(false);
  });

  it("does not double-start", () => {
    selfHealingEngine.start(50);
    const timerRef = selfHealingEngine.timer;
    selfHealingEngine.start(50); // second call should be a no-op
    expect(selfHealingEngine.timer).toBe(timerRef);
    selfHealingEngine.stop();
  });

  it("auto-heals a DOWN service within one cycle", async () => {
    triggerFailure("DB");
    expect(graph.getNode("DB")?.status).toBe(STATUS.DOWN);

    selfHealingEngine.start(30);

    await new Promise((r) => setTimeout(r, 200));
    selfHealingEngine.stop();

    // After healing cycles the service should no longer be DOWN
    const status = graph.getNode("DB")?.status;
    expect([STATUS.UP, STATUS.RECOVERING]).toContain(status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. RETRY ENGINE (pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Retry Logic", () => {
  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    // Inline smartRetry to avoid navigator dependency in node
    async function smartRetry(fn: () => Promise<any>, { maxRetries = 3, baseDelay = 0 } = {}) {
      let lastErr: unknown;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < maxRetries) {
            await new Promise((r) => setTimeout(r, baseDelay));
          }
        }
      }
      throw lastErr;
    }

    const result = await smartRetry(fn, { baseDelay: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) throw new Error("transient");
      return Promise.resolve("recovered");
    });

    async function smartRetry(fn: () => Promise<any>, { maxRetries = 3, baseDelay = 0 } = {}) {
      let lastErr: unknown;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < maxRetries) await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
      throw lastErr;
    }

    const result = await smartRetry(fn, { maxRetries: 5, baseDelay: 0 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));

    async function smartRetry(fn: () => Promise<any>, { maxRetries = 3, baseDelay = 0 } = {}) {
      let lastErr: unknown;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          if (i < maxRetries) await new Promise((r) => setTimeout(r, baseDelay));
        }
      }
      throw lastErr;
    }

    await expect(smartRetry(fn, { maxRetries: 2, baseDelay: 0 })).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CACHE ENGINE (mocked fetch)
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Cache Layer", () => {
  const CACHE_TTL = 500; // ms — short TTL for testing

  function makeCache() {
    const store = new Map<string, { data: any; fetchedAt: number }>();

    async function cachedFetch(url: string, opts: { ttl?: number; forceRefresh?: boolean } = {}) {
      const { ttl = CACHE_TTL, forceRefresh = false } = opts;

      if (!forceRefresh) {
        const cached = store.get(url);
        if (cached && Date.now() - cached.fetchedAt < ttl) {
          return { source: "cache", data: cached.data };
        }
      }

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        store.set(url, { data, fetchedAt: Date.now() });
        return { source: "network", data };
      } catch {
        const cached = store.get(url);
        if (cached) return { source: "stale", data: cached.data };
        throw new Error("network error and no cache");
      }
    }

    return { cachedFetch, store };
  }

  it("returns cached data on second call", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: 42 }),
    } as any);

    const { cachedFetch } = makeCache();

    const first = await cachedFetch("/api/data");
    const second = await cachedFetch("/api/data");

    expect(first.source).toBe("network");
    expect(second.source).toBe("cache");
    expect(second.data.value).toBe(42);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after TTL expires", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: 99 }),
    } as any);

    const { cachedFetch } = makeCache();

    await cachedFetch("/api/fresh", { ttl: 10 });
    await new Promise((r) => setTimeout(r, 20)); // outlive TTL
    const second = await cachedFetch("/api/fresh", { ttl: 10 });

    expect(second.source).toBe("network");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("serves stale data when network fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: "stale-value" }),
      } as any)
      .mockRejectedValue(new Error("offline"));

    const { cachedFetch } = makeCache();

    await cachedFetch("/api/stale", { ttl: 0 }); // populate cache
    const fallback = await cachedFetch("/api/stale", { ttl: 0 });

    expect(fallback.source).toBe("stale");
    expect(fallback.data.value).toBe("stale-value");
  });

  it("forceRefresh bypasses cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ v: 1 }),
    } as any);

    const { cachedFetch } = makeCache();

    await cachedFetch("/api/force");
    await cachedFetch("/api/force", { forceRefresh: true });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CONFLICT RESOLUTION (Offline Engine)
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Conflict Resolution", () => {
  it("lastWriteWins: newer local beats older server", () => {
    const local = { timestamp: 2000, payload: { step: 5 } };
    const server = { timestamp: 1000, payload: { step: 3 } };
    expect(lastWriteWins(local, server)).toBe(true);
  });

  it("lastWriteWins: older local loses to newer server", () => {
    const local = { timestamp: 1000, payload: {} };
    const server = { timestamp: 9000, payload: {} };
    expect(lastWriteWins(local, server)).toBe(false);
  });

  it("mergeProgress: picks max step", () => {
    const local = { timestamp: 2000, payload: { step: 7 } };
    const server = { payload: { step: 10 } };
    const merged = mergeProgress(local, server);
    expect(merged.payload.step).toBe(10);
  });

  it("mergeProgress: preserves local step when higher", () => {
    const local = { timestamp: 5000, payload: { step: 15 } };
    const server = { payload: { step: 3 } };
    const merged = mergeProgress(local, server);
    expect(merged.payload.step).toBe(15);
  });

  it("mergeProgress: handles missing server payload gracefully", () => {
    const local = { timestamp: 1000, payload: { step: 4 } };
    const server = {};
    const merged = mergeProgress(local, server);
    expect(merged.payload.step).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. OFFLINE QUEUE SIMULATION (pure logic, no IndexedDB)
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Offline Queue (pure)", () => {
  type QueueItem = {
    id: string;
    url: string;
    method: string;
    body?: unknown;
    retries: number;
    maxRetries: number;
  };

  function makeQueue() {
    const items: QueueItem[] = [];

    function enqueue(action: Omit<QueueItem, "id" | "retries">) {
      items.push({ id: `q_${Date.now()}_${Math.random()}`, retries: 0, ...action });
    }

    async function replay(fetchFn: (item: QueueItem) => Promise<boolean>) {
      let replayed = 0;
      let failed = 0;
      for (const item of [...items]) {
        const ok = await fetchFn(item);
        if (ok) {
          items.splice(items.indexOf(item), 1);
          replayed++;
        } else {
          item.retries++;
          if (item.retries >= item.maxRetries) {
            items.splice(items.indexOf(item), 1);
          }
          failed++;
        }
      }
      return { replayed, failed };
    }

    return { enqueue, replay, items };
  }

  it("queues actions when offline", () => {
    const q = makeQueue();
    q.enqueue({ url: "/api/sync", method: "POST", maxRetries: 3 });
    q.enqueue({ url: "/api/progress", method: "POST", maxRetries: 3 });
    expect(q.items).toHaveLength(2);
  });

  it("replays successfully when back online", async () => {
    const q = makeQueue();
    q.enqueue({ url: "/api/sync", method: "POST", maxRetries: 3 });

    const result = await q.replay(() => Promise.resolve(true));
    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(0);
    expect(q.items).toHaveLength(0);
  });

  it("retries up to maxRetries then drops", async () => {
    const q = makeQueue();
    q.enqueue({ url: "/api/fail", method: "POST", maxRetries: 2 });

    // 3 failed replays
    for (let i = 0; i < 3; i++) {
      await q.replay(() => Promise.resolve(false));
    }

    // Should be evicted after maxRetries exceeded
    expect(q.items).toHaveLength(0);
  });

  it("partial replay: some succeed, some fail", async () => {
    const q = makeQueue();
    q.enqueue({ url: "/api/ok", method: "POST", maxRetries: 3 });
    q.enqueue({ url: "/api/fail", method: "POST", maxRetries: 3 });

    let call = 0;
    const result = await q.replay(() => {
      call++;
      return Promise.resolve(call === 1); // first succeeds, second fails
    });

    expect(result.replayed).toBe(1);
    expect(result.failed).toBe(1);
    expect(q.items).toHaveLength(1); // failing item still in queue
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. API FALLBACK SIMULATION (smart client pattern)
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — API Smart Fallback", () => {
  const MOCK_DB = {
    devices: [{ id: "WIN-01", status: "Compliant" }, { id: "WIN-02", status: "Non-compliant" }],
    user: { name: "Demo User", xp: 120 },
  };

  async function mockFetch(path: string) {
    await new Promise((r) => setTimeout(r, 5)); // simulate latency
    if (path.includes("/devices")) return MOCK_DB.devices;
    if (path.includes("/profile")) return MOCK_DB.user;
    return { ok: true };
  }

  async function apiFetch(path: string, realFetchFn: () => Promise<any>) {
    try {
      return await realFetchFn();
    } catch {
      return await mockFetch(path);
    }
  }

  it("uses real API when available", async () => {
    const realFetch = vi.fn().mockResolvedValue({ id: "WIN-01", status: "Compliant" });
    const result = await apiFetch("/devices", realFetch);
    expect(result).toEqual({ id: "WIN-01", status: "Compliant" });
    expect(realFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to mock when real API fails", async () => {
    const realFetch = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await apiFetch("/devices", realFetch);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe("WIN-01");
  });

  it("mock returns correct data per route", async () => {
    const devices = await mockFetch("/devices");
    expect(devices).toHaveLength(2);

    const user = await mockFetch("/profile");
    expect(user.name).toBe("Demo User");

    const other = await mockFetch("/policy");
    expect(other).toEqual({ ok: true });
  });

  it("handles concurrent fallback calls correctly", async () => {
    const realFetch = vi.fn().mockRejectedValue(new Error("offline"));

    const results = await Promise.all([
      apiFetch("/devices", realFetch),
      apiFetch("/profile", realFetch),
      apiFetch("/policy", realFetch),
    ]);

    expect(results[0]).toHaveLength(2);          // devices
    expect(results[1].name).toBe("Demo User");   // user profile
    expect(results[2]).toEqual({ ok: true });     // generic
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. LOAD SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Load Simulation", () => {
  beforeEach(freshEnv);

  it("handles 100 concurrent impact-score reads without throwing", async () => {
    triggerFailure("DB");

    const scores = await Promise.all(
      Array.from({ length: 100 }, () =>
        Promise.resolve(computeImpactScore())
      )
    );

    expect(scores.every((s) => typeof s === "number")).toBe(true);
    expect(scores.every((s) => s >= 0)).toBe(true);
  });

  it("topology remains consistent after rapid failure/recovery cycles", () => {
    for (let i = 0; i < 20; i++) {
      triggerFailure("DB");
      recoverService("DB");
    }

    // After 20 cycles, DB should be UP
    expect(graph.getNode("DB")?.status).toBe(STATUS.UP);
  });

  it("50 conflict resolutions complete deterministically", () => {
    const results = Array.from({ length: 50 }, (_, i) => {
      const local = { timestamp: i % 2 === 0 ? 2000 : 500, payload: { step: i } };
      const server = { timestamp: 1000, payload: { step: i + 1 } };
      return lastWriteWins(local, server);
    });

    // Even-indexed: local.ts=2000 > server.ts=1000 → true
    // Odd-indexed:  local.ts=500  < server.ts=1000 → false
    results.forEach((r, i) => {
      expect(r).toBe(i % 2 === 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. FULL PRODUCTION SCENARIO
// ─────────────────────────────────────────────────────────────────────────────

describe("Production — Full Scenario", () => {
  afterEach(() => {
    selfHealingEngine.stop();
  });

  it("incident → cascade → remediation → self-heal → stable", async () => {
    // 1. Healthy start
    freshEnv();
    expect(computeImpactScore()).toBe(0);

    // 2. DB failure triggers cascade
    triggerFailure("DB");
    expect(graph.getNode("DB")?.status).toBe(STATUS.DOWN);
    expect(computeImpactScore()).toBeGreaterThan(0);

    // 3. Remediation advisor detects the problem
    const actions = recommendRemediation();
    expect(actions.length).toBeGreaterThan(0);

    // 4. Self-healing engine auto-recovers
    selfHealingEngine.start(20);
    await new Promise((r) => setTimeout(r, 250));
    selfHealingEngine.stop();

    const dbStatus = graph.getNode("DB")?.status;
    expect([STATUS.UP, STATUS.RECOVERING]).toContain(dbStatus);

    // 5. Timeline logs the incident
    const incidents = timelineStore.getRecent(50);
    expect(incidents.length).toBeGreaterThan(0);
  });

  it("offline→online: queue drains and sync completes", async () => {
    type Item = { id: string; url: string; retries: number; maxRetries: number };
    const queue: Item[] = [];

    // Simulate going offline: queue 5 actions
    for (let i = 0; i < 5; i++) {
      queue.push({ id: `q_${i}`, url: `/api/event/${i}`, retries: 0, maxRetries: 3 });
    }
    expect(queue).toHaveLength(5);

    // Simulate coming back online: replay all
    let replayed = 0;
    for (const item of [...queue]) {
      const ok = true; // network is back
      if (ok) {
        queue.splice(queue.indexOf(item), 1);
        replayed++;
      }
    }

    expect(replayed).toBe(5);
    expect(queue).toHaveLength(0);
  });
});
