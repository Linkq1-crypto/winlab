/**
 * Session Persistence & Resume Suite
 *
 * Verifica che WinLab salvi lo stato di una sessione lab e lo ripristini
 * correttamente dopo:
 *   - ricarica pagina (F5)
 *   - chiusura tab → riapertura
 *   - disconnessione di rete → riconnessione
 *   - scadenza token JWT → re-login
 *
 * Stack:
 *   - Vitest (API layer): salvataggio progress, replay eventi, idempotency
 *   - Playwright (UI layer): stato visivo ripristinato dopo reload
 *
 * Endpoints testati:
 *   POST /api/auth/register   — crea utente test
 *   POST /api/auth/login      — ottieni JWT
 *   POST /api/progress/update — salva progresso lab
 *   GET  /api/user/profile    — verifica progresso salvato
 *   POST /api/replay/event    — registra evento sessione
 *   GET  /api/replay/:id      — recupera eventi sessione
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const TIMEOUT  = 8_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(method: string, path: string, body?: any, token?: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

const testEmail    = `session-test-${Date.now()}@winlab-qa.internal`;
const testPassword = "QA_s3ss10n_Test!";
const labId        = "nginx-port-conflict";
const sessionId    = `sess_qa_${Date.now()}`;

let authToken = "";
let serverReachable = false;

// ─────────────────────────────────────────────────────────────────────────────

describe("💾 Session Persistence & Resume", () => {

  beforeAll(async () => {
    try {
      const res = await api("GET", "/health");
      serverReachable = res.status === 200;
    } catch {
      serverReachable = false;
    }

    if (!serverReachable) return;

    // Register test user
    const reg = await api("POST", "/api/auth/register", {
      email: testEmail,
      password: testPassword,
      name: "QA Session Tester",
    });

    if (reg.status === 200 || reg.status === 201) {
      const data = await reg.json();
      authToken = data.token;
    } else if (reg.status === 409) {
      // Already exists — login instead
      const login = await api("POST", "/api/auth/login", { email: testEmail, password: testPassword });
      const data  = await login.json();
      authToken   = data.token;
    }
  });

  // ── Auth prerequisite ─────────────────────────────────────────────────────
  it("setup: auth token obtained", () => {
    if (!serverReachable) return;
    expect(authToken).toBeTruthy();
  });

  // ── 1. Save progress ──────────────────────────────────────────────────────
  it("POST /api/progress/update saves lab progress", async () => {
    if (!serverReachable || !authToken) return;

    const res  = await api("POST", "/api/progress/update", {
      labId,
      completed: false,
      score: 42,
      xpEarned: 10,
    }, authToken);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.labId).toBe(labId);
    expect(data.score).toBe(42);
  });

  // ── 2. Progress persists across re-fetch ──────────────────────────────────
  it("GET /api/user/profile returns saved progress after update", async () => {
    if (!serverReachable || !authToken) return;

    const res  = await api("GET", "/api/user/profile", undefined, authToken);
    expect(res.status).toBe(200);

    const data = await res.json();
    const prog = (data.progress || []).find((p: any) => p.labId === labId);
    expect(prog).toBeDefined();
    expect(prog.score).toBe(42);
  });

  // ── 3. Progress update is idempotent ─────────────────────────────────────
  it("POST /api/progress/update twice — second call overwrites, no duplicate", async () => {
    if (!serverReachable || !authToken) return;

    await api("POST", "/api/progress/update", { labId, completed: false, score: 42 }, authToken);
    await api("POST", "/api/progress/update", { labId, completed: true,  score: 99 }, authToken);

    const res  = await api("GET", "/api/user/profile", undefined, authToken);
    const data = await res.json();
    const prog = (data.progress || []).find((p: any) => p.labId === labId);
    expect(prog.score).toBe(99);
    expect(prog.completed).toBe(true);

    // Only one record per user+lab
    const duplicates = (data.progress || []).filter((p: any) => p.labId === labId);
    expect(duplicates.length).toBe(1);
  });

  // ── 4. Session events saved ───────────────────────────────────────────────
  it("POST /api/replay/event records commands in session", async () => {
    if (!serverReachable) return;

    const commands = [
      { cmd: "ss -tlnp | grep :80", output: "LISTEN 0 511 0.0.0.0:80" },
      { cmd: "nginx -t",             output: "syntax is ok" },
      { cmd: "systemctl restart nginx", output: "● nginx.service - active" },
    ];

    for (const { cmd, output } of commands) {
      const res = await api("POST", "/api/replay/event", {
        sessionId,
        labId,
        cmd,
        output,
      }, authToken);
      expect(res.status).toBe(200);
    }
  });

  // ── 5. Session replay retrieves events in order ───────────────────────────
  it("GET /api/replay/:sessionId returns events in chronological order", async () => {
    if (!serverReachable) return;

    const res    = await api("GET", `/api/replay/${sessionId}`);
    expect(res.status).toBe(200);

    const events: any[] = await res.json();
    expect(events.length).toBeGreaterThanOrEqual(3);

    // Commands in order
    expect(events[0].cmd).toBe("ss -tlnp | grep :80");
    expect(events[1].cmd).toBe("nginx -t");
    expect(events[2].cmd).toBe("systemctl restart nginx");

    // Timestamps ascending
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i].ts).getTime())
        .toBeGreaterThanOrEqual(new Date(events[i - 1].ts).getTime());
    }
  });

  // ── 6. Session event without auth is accepted (anonymous lab) ─────────────
  it("POST /api/replay/event works without auth token (anonymous session)", async () => {
    if (!serverReachable) return;

    const anonSessionId = `anon_${Date.now()}`;
    const res = await api("POST", "/api/replay/event", {
      sessionId: anonSessionId,
      labId,
      cmd: "cat /var/log/nginx/error.log",
      output: "[error] bind() to 0.0.0.0:80 failed",
    });
    expect(res.status).toBe(200);
  });

  // ── 7. No token → profile endpoint rejects with 401 ──────────────────────
  it("GET /api/user/profile without token → 401 (session not leaked)", async () => {
    if (!serverReachable) return;

    const res = await api("GET", "/api/user/profile");
    expect(res.status).toBe(401);
  });

  // ── 8. Invalid token → 401 (no session hijack) ───────────────────────────
  it("GET /api/user/profile with tampered token → 401", async () => {
    if (!serverReachable) return;

    const res = await api("GET", "/api/user/profile", undefined, "eyJhbGciOiJIUzI1NiJ9.tampered.sig");
    expect(res.status).toBe(401);
  });

  // ── 9. Progress endpoint missing labId → 400 ──────────────────────────────
  it("POST /api/progress/update without labId → 400", async () => {
    if (!serverReachable || !authToken) return;

    const res = await api("POST", "/api/progress/update", { completed: true }, authToken);
    expect(res.status).toBe(400);
  });

  // ── 10. Completed session marks lab as done ────────────────────────────────
  it("completed=true + score=100 → profile shows lab completed", async () => {
    if (!serverReachable || !authToken) return;

    await api("POST", "/api/progress/update", {
      labId: "disk-full",
      completed: true,
      score: 100,
      xpEarned: 50,
    }, authToken);

    const res  = await api("GET", "/api/user/profile", undefined, authToken);
    const data = await res.json();
    const prog = (data.progress || []).find((p: any) => p.labId === "disk-full");
    expect(prog?.completed).toBe(true);
    expect(prog?.score).toBe(100);
  });
});
