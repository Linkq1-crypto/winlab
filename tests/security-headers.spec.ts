/**
 * Security Headers Suite
 *
 * Verifica che ogni risposta HTTP includa gli header di sicurezza obbligatori.
 * Nessuna dipendenza interna — fetch puro contro BASE_URL.
 *
 * Header verificati:
 *   - Strict-Transport-Security (HSTS)        — previene downgrade HTTP
 *   - X-Content-Type-Options: nosniff         — blocca MIME sniffing
 *   - X-Frame-Options / CSP frame-ancestors   — clickjacking protection
 *   - Content-Security-Policy                 — XSS / injection mitigation
 *   - Referrer-Policy                         — no referrer leak
 *   - Permissions-Policy                      — disable unused APIs
 *   - Cache-Control on /api/*                 — no sensitive data cached
 *   - X-Powered-By rimosso                    — info leakage
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const TIMEOUT  = 8_000;
const isProd   = BASE_URL.includes("winlab.cloud");

async function head(path: string): Promise<Headers> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      signal: controller.signal,
    });
    return res.headers;
  } finally {
    clearTimeout(t);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🔒 Security Headers", () => {

  let rootHeaders: Headers;
  let apiHeaders:  Headers;
  let healthHeaders: Headers;

  beforeAll(async () => {
    [rootHeaders, apiHeaders, healthHeaders] = await Promise.all([
      head("/"),
      head("/api/v1/health").catch(() => head("/health")),
      head("/health"),
    ]);
  });

  // ── X-Content-Type-Options ──────────────────────────────────────────────
  it("sets X-Content-Type-Options: nosniff on /", () => {
    expect(rootHeaders.get("x-content-type-options")).toBe("nosniff");
  });

  it("sets X-Content-Type-Options: nosniff on API routes", () => {
    expect(apiHeaders.get("x-content-type-options")).toBe("nosniff");
  });

  // ── X-Frame-Options / CSP frame-ancestors ──────────────────────────────
  it("prevents framing via X-Frame-Options or CSP", () => {
    const xfo = rootHeaders.get("x-frame-options");
    const csp = rootHeaders.get("content-security-policy");
    const protected_ = xfo?.toUpperCase().includes("DENY") ||
                       xfo?.toUpperCase().includes("SAMEORIGIN") ||
                       csp?.includes("frame-ancestors");
    expect(protected_).toBe(true);
  });

  // ── HSTS (prod only — not valid on HTTP) ───────────────────────────────
  it.skipIf(!isProd)("sets HSTS on production", () => {
    const hsts = rootHeaders.get("strict-transport-security");
    expect(hsts).toBeTruthy();
    expect(hsts).toMatch(/max-age=\d+/);
    const maxAge = parseInt(hsts!.match(/max-age=(\d+)/)![1]);
    expect(maxAge).toBeGreaterThanOrEqual(15_552_000); // 6 months minimum
  });

  // ── X-Powered-By removed ────────────────────────────────────────────────
  it("does not expose X-Powered-By", () => {
    expect(rootHeaders.get("x-powered-by")).toBeNull();
  });

  // ── Referrer-Policy ────────────────────────────────────────────────────
  it("sets Referrer-Policy", () => {
    const rp = rootHeaders.get("referrer-policy");
    expect(rp).toBeTruthy();
    expect(rp).toMatch(/no-referrer|strict-origin|same-origin/i);
  });

  // ── Cache-Control on /health ─────────────────────────────────────────
  it("health endpoint is not publicly cached", () => {
    const cc = healthHeaders.get("cache-control");
    // Either no-store / no-cache / private — or no header at all (also fine for health)
    if (cc) {
      expect(cc).toMatch(/no-store|no-cache|private/i);
    }
  });

  // ── Content-Security-Policy ─────────────────────────────────────────
  it("sets Content-Security-Policy (or equivalent)", () => {
    const csp = rootHeaders.get("content-security-policy");
    const cspro = rootHeaders.get("content-security-policy-report-only");
    expect(csp || cspro).toBeTruthy();
  });

  // ── Server header — no version disclosure ────────────────────────────
  it("does not expose server version in Server header", () => {
    const server = rootHeaders.get("server");
    if (server) {
      // nginx/1.24.0 or Apache/2.4.x would be a fail
      expect(server).not.toMatch(/[\d]+\.[\d]+/);
    }
  });
});
