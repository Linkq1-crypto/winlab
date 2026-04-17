/**
 * Production Readiness Suite
 *
 * Test black-box contro il server live (locale o remoto).
 * Nessuna dipendenza interna: usa solo fetch standard.
 *
 * Utilizzo:
 *   npx vitest run tests/production-readiness.spec.ts
 *   BASE_URL=https://tua-app.com npx vitest run tests/production-readiness.spec.ts
 *
 * Richiede il backend attivo su BASE_URL (default: http://localhost:3001).
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";
const TIMEOUT  = 8_000; // ms — ogni fetch

/** Wrapper con timeout esplicito */
async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🚀 Production Readiness Suite", () => {

  // Fallisce in anticipo se il server non risponde affatto
  beforeAll(async () => {
    try {
      await timedFetch(`${BASE_URL}/health`);
    } catch {
      throw new Error(
        `\n❌ Backend non raggiungibile su ${BASE_URL}\n` +
        "   Avvia il server con: npm start   oppure   npm run dev:backend\n" +
        "   Oppure imposta BASE_URL=https://tuo-server.com"
      );
    }
  });

  // ─── 1. Health Check ────────────────────────────────────────────────────
  it("1. API Health Check: il server è vivo e sano", async () => {
    const res  = await timedFetch(`${BASE_URL}/health`);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Il backend restituisce { status: 'ok', timestamp: '...' }
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();

    // Timestamp deve essere una data ISO recente (< 5 secondi fa)
    const serverTime = new Date(data.timestamp).getTime();
    expect(Date.now() - serverTime).toBeLessThan(5_000);
  });

  // ─── 2. Liveness Probe (plain-text) ─────────────────────────────────────
  it("2. Liveness Probe: /healthz/ping.txt risponde con testo OK", async () => {
    const res  = await timedFetch(`${BASE_URL}/healthz/ping.txt`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text.startsWith("OK")).toBe(true);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  // ─── 3. Circuit Breaker / Fallback ──────────────────────────────────────
  it("3. Circuit Breaker & Fallback: payload corrotto → 400/422, mai 500 grezzo", async () => {
    const res = await timedFetch(`${BASE_URL}/api/helpdesk/sync`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      // Payload "poison pill": type presente ma payload corrotto (stringa invece di oggetto)
      body: JSON.stringify({ id: "pr-test-001", type: "SYNC", payload: "%%CORRUPTED%%" }),
    });

    // Deve essere gestito (400 o 422), non un crash 500
    expect([400, 422]).toContain(res.status);

    const data = await res.json();
    // Risposta strutturata — non uno stack trace
    expect(data).toHaveProperty("error");
    expect(typeof data.error).toBe("string");
  });

  it("3b. Circuit Breaker: dopo 3 tentativi il messaggio finisce in Dead Letter (422)", async () => {
    const poisonId = `pr-poison-${Date.now()}`;
    const body = JSON.stringify({
      id:      poisonId,
      type:    "SYNC",
      payload: null, // null → sempre invalido
    });

    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const res = await timedFetch(`${BASE_URL}/api/helpdesk/sync`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      lastStatus = res.status;
    }

    // Al terzo tentativo deve rispondere 422 DEAD_LETTER
    expect(lastStatus).toBe(422);
  });

  // ─── 4. Security Headers ────────────────────────────────────────────────
  it("4. Security: X-Frame-Options blocca il clickjacking", async () => {
    const res = await timedFetch(`${BASE_URL}/health`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("4b. Security: Content-Security-Policy è presente e non permissivo", async () => {
    const res = await timedFetch(`${BASE_URL}/health`);
    const csp = res.headers.get("content-security-policy") ?? "";

    expect(csp.length).toBeGreaterThan(0);
    // frame-ancestors 'none' → nessun iframe embedding
    expect(csp).toContain("frame-ancestors 'none'");
    // object-src 'none' → nessun plugin Flash/Silverlight
    expect(csp).toContain("object-src 'none'");
  });

  it("4c. Security: Strict-Transport-Security forza HTTPS per 1 anno", async () => {
    const res  = await timedFetch(`${BASE_URL}/health`);
    const hsts = res.headers.get("strict-transport-security") ?? "";

    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
  });

  it("4d. Security: X-Content-Type-Options previene il MIME sniffing", async () => {
    const res = await timedFetch(`${BASE_URL}/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("4e. Security: Referrer-Policy limita i dati inviati nei redirect", async () => {
    const res = await timedFetch(`${BASE_URL}/health`);
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  // ─── 5. Telemetry / Logging ─────────────────────────────────────────────
  it("5. Telemetry: /api/logs/status risponde e riporta il logger attivo", async () => {
    const res  = await timedFetch(`${BASE_URL}/api/logs/status`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.logger).toBe("pino");
    expect(typeof data.uptime).toBe("number");
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it("5b. Telemetry: Dead Letter Queue è ispezionabile via API", async () => {
    const res  = await timedFetch(`${BASE_URL}/api/helpdesk/dlq`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.count).toBe("number");
    expect(Array.isArray(data.messages)).toBe(true);
  });

  // ─── 6. Rate Limiting ───────────────────────────────────────────────────
  it("6. Rate Limiting: /api/auth/login risponde 429 dopo troppi tentativi", async () => {
    const hit = async () =>
      timedFetch(`${BASE_URL}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: "ratelimit@test.local", password: "wrong" }),
      });

    // Supera il limite di 5 richieste/minuto definito da authLimiter
    const results = await Promise.all(Array.from({ length: 8 }, hit));
    const statuses = results.map((r) => r.status);

    // Almeno una risposta deve essere 429 Too Many Requests
    expect(statuses.some((s) => s === 429)).toBe(true);
  });

  // ─── 7. Endpoint sconosciuto → 404, mai stack trace ─────────────────────
  it("7. Error handling: endpoint inesistente restituisce 404 strutturato", async () => {
    const res = await timedFetch(`${BASE_URL}/api/non-existent-endpoint-xyz`);

    // Non deve mai esporre uno stack trace in produzione
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain("at Object.");    // no stack trace Node
    expect(text).not.toContain("node_modules");  // no path interni
  });

  // ─── 8. CORS: preflight risponde correttamente ───────────────────────────
  it("8. CORS: preflight OPTIONS su /health non crasha il server", async () => {
    const res = await timedFetch(`${BASE_URL}/health`, { method: "OPTIONS" });
    // Accetta 200 o 204 (No Content) — l'importante è che non sia 5xx
    expect(res.status).toBeLessThan(500);
  });

});
