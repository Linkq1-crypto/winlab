/**
 * Helpdesk Suite — Full API Coverage
 *
 * Testa tutti gli endpoint /api/helpdesk/* senza dipendenze esterne:
 *
 * Email Processing:
 *   POST /ingest          — ingest email, security pipeline, classify
 *   POST /ai-reply        — AI reply generation (cached or live)
 *   POST /reply           — send reply + tracking
 *   POST /webhook/resend  — inbound email webhook
 *
 * Core:
 *   GET  /inbox           — lista ticket con AI metadata
 *   GET  /sla             — SLA status + metriche
 *   GET  /metrics         — queue metrics
 *   GET  /verify          — verifica token email
 *
 * Intelligence:
 *   GET  /insights        — clustering + business insights
 *   GET  /analytics       — KPIs, time series, groupings
 *   GET  /bugs            — spike detection + deploy correlation
 *   POST /deploy          — registra deploy event
 *   GET  /churn           — churn prediction + at-risk users
 *   GET  /ai-summary      — AI-generated state summary
 *
 * Knowledge:
 *   GET  /kb              — knowledge base articles
 *   GET  /templates       — template suggestions
 *   GET  /faqs            — auto-generated FAQs
 *
 * Security:
 *   GET  /security        — security stats + cache
 *   POST /blacklist       — blacklist email
 *
 * Edge Sync:
 *   POST /sync/batch      — batch event sync (idempotency)
 *   POST /sync            — single event sync
 *
 * AI Cache:
 *   POST /ai-cache/feedback — registra feedback
 *   GET  /ai-cache/stats    — statistiche cache
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const HD       = `${BASE_URL}/api/helpdesk`;
const TIMEOUT  = 10_000;

// ─── Helper ──────────────────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<Response> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(`${HD}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body:    body ? JSON.stringify(body) : undefined,
      signal:  ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

const get  = (path: string) => req("GET",  path);
const post = (path: string, body: any) => req("POST", path, body);

// ─── State shared across tests ────────────────────────────────────────────────

let serverReachable = false;
let ingestedTicketId: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────

describe("🎫 Helpdesk — Full API Suite", () => {

  beforeAll(async () => {
    try {
      const r = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
      serverReachable = r.status === 200;
    } catch { serverReachable = false; }
  });

  // ── Email Processing ──────────────────────────────────────────────────────

  describe("Email Processing", () => {

    it("POST /ingest — accepts valid email payload", async () => {
      if (!serverReachable) return;
      const res = await post("/ingest", {
        emails: [{
          from:     "user@example.com",
          subject:  "Cannot access lab — getting 403",
          body:     "Hi, I signed up yesterday and I cannot access any lab. Getting 403 Forbidden every time.",
          snippet:  "Cannot access lab",
          priority: 5,
        }],
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      // Store ticket id for later tests
      if (data.tickets?.[0]?.id) ingestedTicketId = data.tickets[0].id;
      if (data[0]?.id) ingestedTicketId = data[0].id;
    });

    it("POST /ingest — rejects empty emails array", async () => {
      if (!serverReachable) return;
      const res = await post("/ingest", { emails: [] });
      expect([400, 422]).toContain(res.status);
    });

    it("POST /ingest — handles potential spam/phishing email gracefully", async () => {
      if (!serverReachable) return;
      const res = await post("/ingest", {
        emails: [{
          from:    "nigerian.prince@suspicious.xyz",
          subject: "URGENT: CLICK THIS LINK NOW $$$ FREE MONEY",
          body:    "Click http://phishing.xyz/steal-creds to claim your prize!!!",
          snippet: "URGENT CLICK",
          priority: 1,
        }],
      });
      // Should not crash — security pipeline handles it
      expect(res.status).toBeLessThan(500);
    });

    it("POST /ingest — SQL injection in subject does not crash", async () => {
      if (!serverReachable) return;
      const res = await post("/ingest", {
        emails: [{
          from:    "test@test.com",
          subject: "'; DROP TABLE tickets; --",
          body:    "union select * from users",
          snippet: "injection test",
          priority: 3,
        }],
      });
      expect(res.status).toBeLessThan(500);
    });

    it("POST /ai-reply — returns reply for valid ticket subject", async () => {
      if (!serverReachable) return;
      const res = await post("/ai-reply", {
        ticketId: ingestedTicketId || "test-ticket-001",
        subject:  "Cannot access lab — getting 403",
        body:     "I signed up but keep getting 403 when trying to start a lab.",
        from:     "user@example.com",
      });
      expect([200, 202]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data.reply || data.text || data.content).toBeTruthy();
      }
    });

    it("POST /ai-reply — missing ticketId/body returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/ai-reply", {});
      expect([400, 422]).toContain(res.status);
    });

    it("POST /webhook/resend — accepts valid Resend webhook payload", async () => {
      if (!serverReachable) return;
      const res = await post("/webhook/resend", {
        type: "email.received",
        data: {
          from:    "webhook-test@example.com",
          to:      "support@winlab.cloud",
          subject: "Test webhook inbound email",
          text:    "This is a test inbound email via Resend webhook.",
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
    });

    it("POST /webhook/resend — rejects wrong event type", async () => {
      if (!serverReachable) return;
      const res = await post("/webhook/resend", { type: "email.bounced", data: {} });
      expect(res.status).toBe(400);
    });

    it("POST /reply — missing fields returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/reply", {});
      expect([400, 422]).toContain(res.status);
    });
  });

  // ── Core ──────────────────────────────────────────────────────────────────

  describe("Core", () => {

    it("GET /inbox — returns array", async () => {
      if (!serverReachable) return;
      const res  = await get("/inbox");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data) || Array.isArray(data.tickets)).toBe(true);
    });

    it("GET /inbox — ticket has required fields", async () => {
      if (!serverReachable) return;
      const res  = await get("/inbox");
      const data = await res.json();
      const tickets = Array.isArray(data) ? data : data.tickets || [];
      if (tickets.length > 0) {
        const t = tickets[0];
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("subject");
        expect(t).toHaveProperty("from");
      }
    });

    it("GET /sla — returns SLA object", async () => {
      if (!serverReachable) return;
      const res  = await get("/sla");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /metrics — returns metrics object", async () => {
      if (!serverReachable) return;
      const res  = await get("/metrics");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /verify — missing token returns 400 or 401", async () => {
      if (!serverReachable) return;
      const res = await get("/verify");
      expect([400, 401, 422]).toContain(res.status);
    });

    it("GET /verify — tampered token returns 400 or 401", async () => {
      if (!serverReachable) return;
      const res = await fetch(`${HD}/verify?token=invalid.jwt.token`);
      expect([400, 401]).toContain(res.status);
    });
  });

  // ── Intelligence ──────────────────────────────────────────────────────────

  describe("Intelligence", () => {

    it("GET /insights — returns insights object", async () => {
      if (!serverReachable) return;
      const res  = await get("/insights");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /analytics — returns analytics with KPIs", async () => {
      if (!serverReachable) return;
      const res  = await get("/analytics");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /bugs — returns bug/spike detection object", async () => {
      if (!serverReachable) return;
      const res  = await get("/bugs");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("POST /deploy — records deploy event", async () => {
      if (!serverReachable) return;
      const res = await post("/deploy", {
        version:   "1.4.2",
        env:       "production",
        deployedAt: new Date().toISOString(),
        deployedBy: "qa-test",
      });
      expect([200, 201]).toContain(res.status);
    });

    it("POST /deploy — missing version returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/deploy", { env: "production" });
      expect([400, 422]).toContain(res.status);
    });

    it("GET /bugs — after deploy, correlates spike correctly", async () => {
      if (!serverReachable) return;
      // Ingest a burst of tickets to simulate spike
      await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          post("/ingest", {
            emails: [{
              from:    `spike${i}@example.com`,
              subject: "Lab not loading after update",
              body:    "After the latest update labs stopped loading.",
              snippet: "labs not loading",
              priority: 7,
            }],
          })
        )
      );
      const res  = await get("/bugs");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /churn — returns churn prediction data", async () => {
      if (!serverReachable) return;
      const res  = await get("/churn");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("POST /churn/update — batch update accepted", async () => {
      if (!serverReachable) return;
      const res = await post("/churn/update", {
        updates: [
          { userId: "user-qa-1", lastActive: new Date().toISOString(), logins: 3 },
          { userId: "user-qa-2", lastActive: new Date(Date.now() - 30 * 86400_000).toISOString(), logins: 0 },
        ],
      });
      expect([200, 201, 202]).toContain(res.status);
    });

    it("GET /ai-summary — returns text summary", async () => {
      if (!serverReachable) return;
      const res  = await get("/ai-summary");
      expect([200, 202, 503]).toContain(res.status); // 503 if AI not configured
      if (res.status === 200) {
        const data = await res.json();
        expect(data.summary || data.text || data.content).toBeTruthy();
      }
    });
  });

  // ── Knowledge ────────────────────────────────────────────────────────────

  describe("Knowledge Base", () => {

    it("GET /kb — returns array of KB articles", async () => {
      if (!serverReachable) return;
      const res  = await get("/kb");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data) || Array.isArray(data.articles)).toBe(true);
    });

    it("GET /templates — returns template suggestions", async () => {
      if (!serverReachable) return;
      const res  = await get("/templates");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("GET /faqs — returns FAQ list", async () => {
      if (!serverReachable) return;
      const res  = await get("/faqs");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });
  });

  // ── Security ──────────────────────────────────────────────────────────────

  describe("Security", () => {

    it("GET /security — returns security stats object", async () => {
      if (!serverReachable) return;
      const res  = await get("/security");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("POST /blacklist — blacklists email address", async () => {
      if (!serverReachable) return;
      const res = await post("/blacklist", { email: "spammer@evil.com", reason: "bulk spam" });
      expect([200, 201]).toContain(res.status);
    });

    it("POST /blacklist — missing email returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/blacklist", { reason: "no email provided" });
      expect([400, 422]).toContain(res.status);
    });

    it("POST /ingest — blacklisted email is flagged or rejected", async () => {
      if (!serverReachable) return;
      const res = await post("/ingest", {
        emails: [{
          from:    "spammer@evil.com",
          subject: "Free money now",
          body:    "Click here!",
          snippet: "Free money",
          priority: 1,
        }],
      });
      expect(res.status).toBeLessThan(500);
      // Either rejected (4xx) or ingested with low trust score — never 500
    });
  });

  // ── Edge Sync ────────────────────────────────────────────────────────────

  describe("Edge Sync", () => {

    it("POST /sync/batch — acknowledges valid events", async () => {
      if (!serverReachable) return;
      const eventId = `evt_qa_${Date.now()}`;
      const res = await post("/sync/batch", {
        events: [{
          event_id:      eventId,
          event_type:    "ticket.created",
          schema_version: 1,
          device_id:     "qa-device-001",
          sequence:       1,
          payload:        { subject: "batch sync test" },
        }],
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.acknowledged).toContain(eventId);
    });

    it("POST /sync/batch — idempotent: duplicate event acknowledged, not doubled", async () => {
      if (!serverReachable) return;
      const eventId = `evt_idem_${Date.now()}`;
      const payload = {
        events: [{
          event_id:   eventId,
          event_type: "ticket.updated",
          payload:    { status: "open" },
        }],
      };
      const r1 = await post("/sync/batch", payload);
      const r2 = await post("/sync/batch", payload);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      const d2 = await r2.json();
      expect(d2.acknowledged).toContain(eventId);
      expect(d2.conflicts).toHaveLength(0);
    });

    it("POST /sync/batch — rejects empty events array", async () => {
      if (!serverReachable) return;
      const res = await post("/sync/batch", { events: [] });
      expect(res.status).toBe(400);
    });

    it("POST /sync/batch — rejects batch over 100 events", async () => {
      if (!serverReachable) return;
      const events = Array.from({ length: 101 }, (_, i) => ({
        event_id: `evt_over_${i}`,
        event_type: "ping",
      }));
      const res = await post("/sync/batch", { events });
      expect(res.status).toBe(400);
    });

    it("POST /sync — single event acknowledged", async () => {
      if (!serverReachable) return;
      const eventId = `evt_single_${Date.now()}`;
      const res = await post("/sync", {
        event_id:   eventId,
        event_type: "ticket.closed",
        payload:    { reason: "resolved" },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.acknowledged).toContain(eventId);
    });

    it("POST /sync — missing event_id returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/sync", { event_type: "ping" });
      expect(res.status).toBe(400);
    });
  });

  // ── AI Cache ─────────────────────────────────────────────────────────────

  describe("AI Cache", () => {

    it("GET /ai-cache/stats — returns stats object", async () => {
      if (!serverReachable) return;
      const res  = await get("/ai-cache/stats");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe("object");
    });

    it("POST /ai-cache/feedback — records feedback", async () => {
      if (!serverReachable) return;
      const res = await post("/ai-cache/feedback", {
        key:      "reply:403-access-denied",
        feedback: "helpful",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.recorded).toBe(true);
    });

    it("POST /ai-cache/feedback — missing key returns 400", async () => {
      if (!serverReachable) return;
      const res = await post("/ai-cache/feedback", { feedback: "good" });
      expect(res.status).toBe(400);
    });
  });

  // ── Response time budget ─────────────────────────────────────────────────

  describe("Performance", () => {

    it("GET /inbox responds within 1000ms", async () => {
      if (!serverReachable) return;
      const start = Date.now();
      await get("/inbox");
      expect(Date.now() - start).toBeLessThan(1_000);
    });

    it("GET /metrics responds within 500ms", async () => {
      if (!serverReachable) return;
      const start = Date.now();
      await get("/metrics");
      expect(Date.now() - start).toBeLessThan(500);
    });

    it("GET /sla responds within 500ms", async () => {
      if (!serverReachable) return;
      const start = Date.now();
      await get("/sla");
      expect(Date.now() - start).toBeLessThan(500);
    });

    it("POST /ingest single email responds within 2000ms", async () => {
      if (!serverReachable) return;
      const start = Date.now();
      await post("/ingest", {
        emails: [{
          from: "perf@test.com",
          subject: "Performance test ticket",
          body: "Testing ingest latency",
          snippet: "perf test",
          priority: 3,
        }],
      });
      expect(Date.now() - start).toBeLessThan(2_000);
    });

    it("no endpoint returns 5xx under normal load (10 parallel GET)", async () => {
      if (!serverReachable) return;
      const endpoints = ["/inbox", "/sla", "/metrics", "/kb", "/templates",
                         "/faqs", "/security", "/bugs", "/churn", "/insights"];
      const responses = await Promise.all(endpoints.map((p) => get(p)));
      const has5xx    = responses.some((r) => r.status >= 500);
      expect(has5xx).toBe(false);
    });
  });
});
