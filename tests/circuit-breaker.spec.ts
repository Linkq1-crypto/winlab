/**
 * Circuit Breaker E2E Tests
 *
 * Stack: Vitest + Supertest + Express miniapp
 *
 * Differenze rispetto al template Jest/Fastify/nock:
 *   - app.inject (Fastify) → supertest(app).get(...)  [Express]
 *   - nock                 → vi.fn() mock sul client interno
 *   - jest.setTimeout      → vi.useFakeTimers() per il reset senza attese reali
 *   - CircuitBreaker importato da src/services/retryEngine.js (già nel codebase)
 *
 * Scenari:
 *   1. Fail-Fast   – circuito si apre dopo N fallimenti, risposta < 50ms
 *   2. Recovery    – HALF-OPEN → CLOSED dopo il resetTimeout
 *   3. Half-Open   – un secondo fallimento in HALF-OPEN riapre il circuito
 *   4. Stato       – getState() riflette correttamente ogni transizione
 *   5. Concorrenza – chiamate parallele durante OPEN sono tutte rifiutate
 *   6. Request-Id  – header x-request-id propagato anche nelle risposte CIRCUIT_OPEN
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response } from "express";
import request from "supertest";
import { CircuitBreaker } from "../src/services/retryEngine.js";

// ─────────────────────────────────────────────────────────────────────────────
// Costanti che corrispondono alla configurazione del CircuitBreaker in produzione
// ─────────────────────────────────────────────────────────────────────────────

const FAILURE_THRESHOLD = 3;    // circuito si apre al 3° fallimento
const RESET_TIMEOUT_MS  = 2000; // ms prima di entrare in HALF-OPEN

// ─────────────────────────────────────────────────────────────────────────────
// App Express minimale — replica il pattern usato nel backend reale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un'app isolata con il suo CircuitBreaker e un client esterno mockabile.
 * Questo approccio permette di testare ogni scenario con uno stato pulito.
 */
function buildApp(externalClient: { fetchData: () => Promise<any> }) {
  const app = express();
  app.use(express.json());

  // Middleware request-id (identico al backend reale)
  app.use((req: Request, res: Response, next) => {
    const incoming = req.headers["x-request-id"];
    (req as any).requestId =
      typeof incoming === "string" && incoming.trim()
        ? incoming.trim()
        : crypto.randomUUID();
    res.setHeader("x-request-id", (req as any).requestId);
    next();
  });

  const cb = new CircuitBreaker({
    failureThreshold: FAILURE_THRESHOLD,
    resetTimeout:     RESET_TIMEOUT_MS,
  });

  // Espone lo stato del CB per l'ispezione nei test
  app.get("/cb-state", (_req: Request, res: Response) => {
    res.json(cb.getState());
  });

  // Endpoint soggetto al circuit breaker.
  //
  // ⚠️  Non pre-controlliamo cb.getState().state prima di chiamare execute().
  //     Lasciamo che execute() gestisca internamente OPEN → HALF-OPEN (via Date.now()),
  //     così vi.useFakeTimers() può avanzare il clock e far scattare la transizione.
  //
  // Distinzione delle risposte basata sul MESSAGGIO dell'errore lanciato da CB:
  //   "Circuit breaker open…" → 503 CIRCUIT_OPEN  (fast-fail, nessuna call upstream)
  //   qualsiasi altro errore  → 500 UPSTREAM_ERROR (la call è andata, ma ha fallito)
  //
  // Questo significa che la chiamata N che APRE il circuito restituisce ancora 500
  // (l'upstream ha risposto con errore); solo dalla chiamata N+1 in poi si ottiene 503.
  app.get("/external-data", async (req: Request, res: Response) => {
    const reqId = (req as any).requestId;
    try {
      const data = await cb.execute(() => externalClient.fetchData());
      res.status(200).json({ ...data, request_id: reqId });
    } catch (err: any) {
      if (err.message?.includes("Circuit breaker open")) {
        return res.status(503).json({
          code:       "CIRCUIT_OPEN",
          message:    "Service temporarily unavailable — circuit breaker open",
          request_id: reqId,
        });
      }
      res.status(500).json({
        code:       "UPSTREAM_ERROR",
        message:    err.message,
        request_id: reqId,
      });
    }
  });

  return { app, cb };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────

describe("Circuit Breaker E2E Tests", () => {

  // ── 1. FAIL-FAST ──────────────────────────────────────────────────────────
  describe("Fail-Fast: il circuito si apre dopo N fallimenti consecutivi", () => {
    let fetchData: ReturnType<typeof vi.fn>;
    let app: express.Express;

    beforeEach(() => {
      fetchData = vi.fn().mockRejectedValue(new Error("Internal Server Error"));
      ({ app } = buildApp({ fetchData }));
    });

    it("le prime N chiamate ricevono 500 (upstream error)", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        const res = await request(app).get("/external-data");
        expect(res.status).toBe(500);
        expect(res.body.code).toBe("UPSTREAM_ERROR");
      }
    });

    it("la chiamata N+1 riceve 503 CIRCUIT_OPEN (Fail-Fast)", async () => {
      // Raggiungi la soglia
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      const start = Date.now();
      const res   = await request(app).get("/external-data");
      const ms    = Date.now() - start;

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("CIRCUIT_OPEN");
      // Fail-Fast: risposta senza toccare l'upstream → < 50ms
      expect(ms).toBeLessThan(50);
    });

    it("il client esterno non viene chiamato quando il circuito è OPEN", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }
      const callsBefore = fetchData.mock.calls.length;

      await request(app).get("/external-data"); // circuito OPEN → nessuna call

      expect(fetchData.mock.calls.length).toBe(callsBefore); // nessuna nuova chiamata
    });

    it("la risposta CIRCUIT_OPEN include request_id", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      const res = await request(app)
        .get("/external-data")
        .set("x-request-id", "trace-cb-001");

      expect(res.body.request_id).toBe("trace-cb-001");
      expect(res.headers["x-request-id"]).toBe("trace-cb-001");
    });

    it("getState() riporta stato OPEN e il contatore corretto", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      const res = await request(app).get("/cb-state");
      expect(res.body.state).toBe("open");
      expect(res.body.failures).toBe(FAILURE_THRESHOLD);
      expect(res.body.threshold).toBe(FAILURE_THRESHOLD);
    });
  });

  // ── 2. RECOVERY: OPEN → HALF-OPEN → CLOSED ────────────────────────────────
  describe("Recovery: il circuito torna CLOSED dopo il resetTimeout", () => {
    let fetchData: ReturnType<typeof vi.fn>;
    let app: express.Express;
    let cb: CircuitBreaker;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchData = vi.fn().mockRejectedValue(new Error("down"));
      ({ app, cb } = buildApp({ fetchData }));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("entra in HALF-OPEN dopo il resetTimeout", async () => {
      // 1. Apri il circuito
      fetchData.mockRejectedValue(new Error("down"));
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }
      expect(cb.getState().state).toBe("open");

      // 2. Avanza il clock oltre il resetTimeout
      vi.advanceTimersByTime(RESET_TIMEOUT_MS + 100);

      // 3. Il CB deve ora essere half-open (la transizione avviene al prossimo execute)
      // Facciamo una chiamata di prova con upstream sano
      fetchData.mockResolvedValue({ success: true });
      const res = await request(app).get("/external-data");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("torna CLOSED dopo una chiamata riuscita in HALF-OPEN", async () => {
      // Apri il circuito
      fetchData.mockRejectedValue(new Error("down"));
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      // Avanza il clock → HALF-OPEN
      vi.advanceTimersByTime(RESET_TIMEOUT_MS + 100);

      // Chiamata di prova OK → CLOSED
      fetchData.mockResolvedValue({ healed: true });
      await request(app).get("/external-data");

      expect(cb.getState().state).toBe("closed");
      expect(cb.getState().failures).toBe(0);
    });

    it("chiamate successive dopo recovery funzionano normalmente", async () => {
      fetchData.mockRejectedValue(new Error("down"));
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      vi.advanceTimersByTime(RESET_TIMEOUT_MS + 100);
      fetchData.mockResolvedValue({ data: "live" });

      // Prima chiamata chiude il circuito
      await request(app).get("/external-data");

      // Le successive devono raggiungere l'upstream normalmente
      const res = await request(app).get("/external-data");
      expect(res.status).toBe(200);
      expect(fetchData).toHaveBeenCalledTimes(FAILURE_THRESHOLD + 2);
    });

    it("il circuito NON si chiude prima del resetTimeout", async () => {
      fetchData.mockRejectedValue(new Error("down"));
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      // Avanza solo metà del timeout
      vi.advanceTimersByTime(RESET_TIMEOUT_MS / 2);

      const res = await request(app).get("/external-data");
      // Ancora OPEN → Fail-Fast
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("CIRCUIT_OPEN");
    });
  });

  // ── 3. HALF-OPEN: SECONDO FALLIMENTO RIAPRE IL CIRCUITO ───────────────────
  describe("Half-Open: un secondo fallimento in sonda riapre il circuito", () => {
    let fetchData: ReturnType<typeof vi.fn>;
    let app: express.Express;
    let cb: CircuitBreaker;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchData = vi.fn().mockRejectedValue(new Error("down"));
      ({ app, cb } = buildApp({ fetchData }));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("rimane OPEN se la chiamata di sonda fallisce ancora", async () => {
      // Apri circuito
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      // Avanza il clock → HALF-OPEN
      vi.advanceTimersByTime(RESET_TIMEOUT_MS + 100);

      // Upstream ancora giù → la sonda fallisce → ritorna OPEN
      fetchData.mockRejectedValue(new Error("still down"));
      const res = await request(app).get("/external-data");

      // Il breaker ha aperto di nuovo durante execute()
      expect([500, 503]).toContain(res.status);

      // Dopo la sonda fallita deve essere di nuovo OPEN
      const nextRes = await request(app).get("/external-data");
      expect(nextRes.status).toBe(503);
      expect(nextRes.body.code).toBe("CIRCUIT_OPEN");
    });
  });

  // ── 4. CONCORRENZA ────────────────────────────────────────────────────────
  describe("Concorrenza: tutte le chiamate parallele durante OPEN sono rifiutate", () => {
    it("50 richieste simultanee ricevono tutte 503 quando il circuito è OPEN", async () => {
      const fetchData = vi.fn().mockRejectedValue(new Error("down"));
      const { app } = buildApp({ fetchData });

      // Apri il circuito
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }

      // Lancia 50 richieste in parallelo
      const results = await Promise.all(
        Array.from({ length: 50 }, () => request(app).get("/external-data"))
      );

      expect(results.every((r) => r.status === 503)).toBe(true);
      expect(results.every((r) => r.body.code === "CIRCUIT_OPEN")).toBe(true);

      // Il client esterno non deve essere chiamato nemmeno una volta
      expect(fetchData.mock.calls.length).toBe(FAILURE_THRESHOLD);
    });
  });

  // ── 5. CIRCUIT BREAKER SANO (baseline) ────────────────────────────────────
  describe("Baseline: senza fallimenti il circuito resta CLOSED", () => {
    it("risponde 200 e stato CLOSED con upstream sano", async () => {
      const fetchData = vi.fn().mockResolvedValue({ value: 42 });
      const { app, cb } = buildApp({ fetchData });

      const res = await request(app).get("/external-data");

      expect(res.status).toBe(200);
      expect(res.body.value).toBe(42);
      expect(cb.getState().state).toBe("closed");
      expect(cb.getState().failures).toBe(0);
    });

    it("fallimenti sotto la soglia non aprono il circuito", async () => {
      const fetchData = vi.fn()
        .mockRejectedValueOnce(new Error("transient"))   // 1 fallimento
        .mockResolvedValue({ ok: true });                // poi ok

      const { app, cb } = buildApp({ fetchData });

      const first = await request(app).get("/external-data");
      expect(first.status).toBe(500); // fallimento, ma circuito ancora closed

      const second = await request(app).get("/external-data");
      expect(second.status).toBe(200);
      expect(cb.getState().state).toBe("closed");
    });
  });

  // ── 6. RESILIENZA DEGLI HEADER ────────────────────────────────────────────
  describe("Request-Id: propagato in tutte le risposte, successo o errore", () => {
    let fetchData: ReturnType<typeof vi.fn>;
    let app: express.Express;

    beforeEach(() => {
      fetchData = vi.fn().mockRejectedValue(new Error("down"));
      ({ app } = buildApp({ fetchData }));
    });

    it("risposta 500 contiene request_id", async () => {
      const res = await request(app)
        .get("/external-data")
        .set("x-request-id", "err-trace-500");
      expect(res.body.request_id).toBe("err-trace-500");
    });

    it("risposta 503 CIRCUIT_OPEN contiene request_id", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }
      const res = await request(app)
        .get("/external-data")
        .set("x-request-id", "err-trace-cb");
      expect(res.body.request_id).toBe("err-trace-cb");
      expect(res.headers["x-request-id"]).toBe("err-trace-cb");
    });

    it("genera un UUID se il client non passa x-request-id", async () => {
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        await request(app).get("/external-data");
      }
      const res = await request(app).get("/external-data");
      expect(typeof res.body.request_id).toBe("string");
      expect(res.body.request_id.length).toBeGreaterThan(0);
    });
  });
});
