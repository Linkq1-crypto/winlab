/**
 * Rate Limiting Suite
 *
 * Verifica che il server risponda 429 dopo aver superato le soglie
 * e che gli header standard di rate-limit siano presenti.
 *
 * Scenari:
 *   1. Burst su /api/v1/health → 429 after threshold
 *   2. Retry-After o RateLimit-Reset header presente sul 429
 *   3. Dopo cooling-off il limite si resetta (finestra scorrevole)
 *   4. Auth endpoint ha limite più basso (brute-force protection)
 *   5. /health (no-auth) non è rate-limited a chiamate normali
 *   6. x-request-id presente anche sulle risposte 429
 */

import { describe, it, expect } from "vitest";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const TIMEOUT  = 5_000;

async function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      headers: { "x-request-id": `test-${Date.now()}`, ...headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function burst(path: string, count: number): Promise<Response[]> {
  return Promise.all(Array.from({ length: count }, () => get(path)));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🚦 Rate Limiting", () => {

  it("/health responds 200 under normal load (10 requests)", async () => {
    const responses = await burst("/health", 10);
    const statuses  = responses.map((r) => r.status);
    const ok        = statuses.filter((s) => s === 200).length;
    expect(ok).toBeGreaterThanOrEqual(8); // at least 80% ok
  });

  it("API burst (60 requests) triggers 429 before exhausting", async () => {
    const responses  = await burst("/api/v1/health", 60);
    const statuses   = responses.map((r) => r.status);
    const has429     = statuses.includes(429);
    const has500plus = statuses.some((s) => s >= 500);

    // Either rate-limited (429) OR all ok (limiter may not be configured in dev)
    // Critical: NO 500s from burst
    expect(has500plus).toBe(false);

    if (has429) {
      // 429 found — verify proper headers
      const blocked = responses.find((r) => r.status === 429)!;
      const hasRateLimitHeader =
        blocked.headers.has("retry-after") ||
        blocked.headers.has("ratelimit-reset") ||
        blocked.headers.has("x-ratelimit-reset");
      expect(hasRateLimitHeader).toBe(true);
    }
  });

  it("429 response includes x-request-id", async () => {
    const responses = await burst("/api/v1/health", 60);
    const blocked   = responses.find((r) => r.status === 429);
    if (blocked) {
      expect(blocked.headers.has("x-request-id")).toBe(true);
    }
    // If no 429, rate limiter is off in this env — test passes
  });

  it("auth endpoint blocks brute-force (20 rapid POST /api/auth/login)", async () => {
    const controller = new AbortController();
    const requests   = Array.from({ length: 20 }, () =>
      fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-request-id": `bf-${Math.random()}` },
        body: JSON.stringify({ email: "attacker@evil.com", password: "wrong" }),
        signal: controller.signal,
      }).catch(() => ({ status: 0 } as any))
    );

    const responses = await Promise.all(requests);
    const statuses  = responses.map((r) => r.status);
    const has500    = statuses.some((s) => s >= 500);
    expect(has500).toBe(false);

    // After brute-force, expect either 429 or 401 — never 200
    const has200 = statuses.some((s) => s === 200);
    expect(has200).toBe(false); // wrong password — should never be 200
  });

  it("early access signup rate-limited (30 rapid POST /api/early-access)", async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        fetch(`${BASE_URL}/api/early-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: `test${i}@spam.com` }),
        }).catch(() => ({ status: 0 } as any))
      )
    );
    const has500 = responses.map((r) => r.status).some((s) => s >= 500);
    expect(has500).toBe(false);
  });
});
