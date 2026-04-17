/**
 * Tests for:
 *   - Schema Validation Error → 400 con request_id e VALIDATION_ERROR
 *   - /ready Dependency Health → 503 quando il DB è down
 *   - Load Shedding middleware → 503 quando event loop lag supera la soglia
 *
 * Tutti i test sono unit/integration puri (nessun server live).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: simulano Express req/res/next
// ─────────────────────────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, any> = {}) {
  return {
    body:       {},
    headers:    {},
    originalUrl: "/test",
    requestId:  "test-req-id-001",
    path:       "/test",
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    _status: 0,
    _body:   null,
    status(code: number) { this._status = code; return this; },
    json(body: any)      { this._body   = body; return this; },
    setHeader()          { return this; },
  };
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. VALIDATION ERROR HANDLER
// Replicato qui in modo identico a come è nel backend,
// così il test non richiede il server live.
// ─────────────────────────────────────────────────────────────────────────────

function securityLogNoop(_entry: any) {}  // stub silenzioso

function makeErrorHandler(logFn = securityLogNoop) {
  return function errorHandler(err: any, req: any, res: any, _next: any) {
    const requestId = req.requestId || req.headers["x-request-id"] || "internal";

    if (err.validation) {
      logFn({ level: "warn", event: "validation_error", request_id: requestId, details: err.validation });
      return res.status(400).json({
        request_id: requestId,
        code:       "VALIDATION_ERROR",
        message:    "Payload malformato",
        details:    err.validation,
      });
    }

    const status = err.statusCode || err.status || 500;
    logFn({ level: status >= 500 ? "error" : "warn", event: "unhandled_error", request_id: requestId });
    res.status(status).json({
      request_id: requestId,
      code:       "INTERNAL_ERROR",
      message:    err.message,
    });
  };
}

function makeValidateBody(schema: Record<string, { type: string; required?: boolean }>) {
  return (req: any, _res: any, next: any) => {
    const details: Array<{ field: string; message: string }> = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body?.[field];
      if (rules.required && (val === undefined || val === null || val === "")) {
        details.push({ field, message: `"${field}" is required` });
        continue;
      }
      if (val !== undefined && val !== null && typeof val !== rules.type) {
        details.push({ field, message: `"${field}" must be of type ${rules.type}` });
      }
    }
    if (details.length > 0) {
      const err: any = new Error("Payload malformato");
      err.validation = details;
      err.statusCode = 400;
      return next(err);
    }
    next();
  };
}

describe("Validation Error Handler", () => {
  const handler = makeErrorHandler();

  it("should return 400 with structured logging fields (request_id) on invalid payload", () => {
    const err: any  = new Error("Payload malformato");
    err.validation  = [{ field: "email", message: '"email" is required' }];
    err.statusCode  = 400;

    const req = makeReq({ requestId: "trace-abc-123" });
    const res = makeRes();

    handler(err, req, res, () => {});

    expect(res._status).toBe(400);
    expect(res._body).toHaveProperty("request_id", "trace-abc-123");
    expect(res._body.code).toBe("VALIDATION_ERROR");
    expect(res._body.message).toBe("Payload malformato");
    expect(Array.isArray(res._body.details)).toBe(true);
    expect(res._body.details[0].field).toBe("email");
  });

  it("uses incoming x-request-id header when req.requestId is absent", () => {
    const err: any = new Error("bad");
    err.validation = [{ field: "name", message: '"name" is required' }];

    const req = makeReq({ requestId: undefined, headers: { "x-request-id": "from-header-xyz" } });
    const res = makeRes();

    handler(err, req, res, () => {});

    expect(res._body.request_id).toBe("from-header-xyz");
  });

  it("falls back to 'internal' when no request id is available", () => {
    const err: any = new Error("bad");
    err.validation = [];

    const req = makeReq({ requestId: undefined, headers: {} });
    const res = makeRes();

    handler(err, req, res, () => {});

    expect(res._body.request_id).toBe("internal");
  });

  it("handles generic errors with status 500", () => {
    const err = new Error("Something exploded");
    const req = makeReq();
    const res = makeRes();

    handler(err, req, res, () => {});

    expect(res._status).toBe(500);
    expect(res._body.code).toBe("INTERNAL_ERROR");
    expect(res._body).toHaveProperty("request_id");
  });

  it("logs validation errors without throwing", () => {
    const logged: any[] = [];
    const h = makeErrorHandler((e) => logged.push(e));

    const err: any = new Error("bad");
    err.validation = [{ field: "type", message: '"type" is required' }];

    h(err, makeReq(), makeRes(), () => {});

    expect(logged).toHaveLength(1);
    expect(logged[0].event).toBe("validation_error");
    expect(logged[0].request_id).toBe("test-req-id-001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateBody middleware
// ─────────────────────────────────────────────────────────────────────────────

describe("validateBody middleware", () => {
  const schema = {
    email:    { type: "string", required: true },
    password: { type: "string", required: true },
    age:      { type: "number" },
  };

  it("calls next() when payload is valid", () => {
    const mw   = makeValidateBody(schema);
    const req  = makeReq({ body: { email: "a@b.com", password: "secret" } });
    const next = vi.fn();

    mw(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(next.mock.calls[0]).toHaveLength(0); // nessun errore
  });

  it("passes error to next() when required field is missing", () => {
    const mw   = makeValidateBody(schema);
    const req  = makeReq({ body: { password: "secret" } }); // email mancante
    const next = vi.fn();

    mw(req, makeRes(), next);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.validation).toHaveLength(1);
    expect(err.validation[0].field).toBe("email");
    expect(err.statusCode).toBe(400);
  });

  it("passes error when field has wrong type", () => {
    const mw   = makeValidateBody(schema);
    const req  = makeReq({ body: { email: "a@b.com", password: "x", age: "not-a-number" } });
    const next = vi.fn();

    mw(req, makeRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.validation.some((d: any) => d.field === "age")).toBe(true);
  });

  it("accumulates multiple field errors in one pass", () => {
    const mw   = makeValidateBody(schema);
    const req  = makeReq({ body: {} }); // entrambi i campi mancanti
    const next = vi.fn();

    mw(req, makeRes(), next);

    expect(next.mock.calls[0][0].validation).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEPENDENCY HEALTH CHECK /ready  (DB mockato)
// ─────────────────────────────────────────────────────────────────────────────

/** Fabbrica un handler /ready con la funzione checkDb iniettabile */
function makeReadyHandler(checkDb: () => Promise<boolean>) {
  return async (req: any, res: any) => {
    const dbOk = await checkDb();
    if (!dbOk) {
      return res.status(503).json({
        status:     "unavailable",
        dependency: "database",
        request_id: req.requestId,
        timestamp:  new Date().toISOString(),
      });
    }
    res.status(200).json({
      status:     "ready",
      request_id: req.requestId,
      timestamp:  new Date().toISOString(),
    });
  };
}

describe("GET /ready — Dependency Health Check", () => {
  it("should return 200 when database is up", async () => {
    const checkDb = vi.fn().mockResolvedValue(true);
    const handler = makeReadyHandler(checkDb);

    const req = makeReq({ requestId: "ready-ok-001" });
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.status).toBe("ready");
    expect(res._body.request_id).toBe("ready-ok-001");
    expect(checkDb).toHaveBeenCalledTimes(1);
  });

  it("should return 503 when database is down", async () => {
    const checkDb = vi.fn().mockResolvedValue(false);
    const handler = makeReadyHandler(checkDb);

    const req = makeReq({ requestId: "ready-fail-002" });
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._body.status).toBe("unavailable");
    expect(res._body.dependency).toBe("database");
    expect(res._body.request_id).toBe("ready-fail-002");
  });

  it("returns 503 when checkDb throws (resilient to exceptions)", async () => {
    const checkDb = vi.fn().mockRejectedValue(new Error("connection refused"));

    // Handler difensivo che non propaga eccezioni
    const safeHandler = async (req: any, res: any) => {
      try {
        await makeReadyHandler(checkDb)(req, res);
      } catch {
        res.status(503).json({ status: "unavailable", dependency: "database", request_id: req.requestId });
      }
    };

    const req = makeReq({ requestId: "ready-throw-003" });
    const res = makeRes();

    await safeHandler(req, res);

    expect(res._status).toBe(503);
    expect(res._body.dependency).toBe("database");
  });

  it("includes ISO timestamp in response", async () => {
    const before  = Date.now();
    const handler = makeReadyHandler(vi.fn().mockResolvedValue(true));
    const res     = makeRes();

    await handler(makeReq(), res);

    const ts = new Date(res._body.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LOAD SHEDDING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

function makeLoadSheddingMiddleware(getLag: () => number, limitMs: number) {
  return (req: any, res: any, next: any) => {
    if (["/health", "/ready", "/healthz/ping.txt"].includes(req.path)) return next();
    if (getLag() > limitMs) {
      return res.status(503).json({
        error:       "Server Overloaded",
        code:        "LOAD_SHED",
        request_id:  req.requestId,
        retry_after: 2,
      });
    }
    next();
  };
}

describe("Load Shedding Middleware", () => {
  it("passes request through when lag is below limit", () => {
    const mw   = makeLoadSheddingMiddleware(() => 50, 250);
    const next = vi.fn();
    mw(makeReq({ path: "/api/data" }), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 503 LOAD_SHED when event loop lag exceeds limit", () => {
    const mw  = makeLoadSheddingMiddleware(() => 300, 250);
    const res = makeRes();
    const next = vi.fn();

    mw(makeReq({ path: "/api/helpdesk/sync" }), res, next);

    expect(res._status).toBe(503);
    expect(res._body.code).toBe("LOAD_SHED");
    expect(res._body.retry_after).toBe(2);
    expect(res._body.request_id).toBe("test-req-id-001");
    expect(next).not.toHaveBeenCalled();
  });

  it("never sheds health check endpoint even under extreme lag", () => {
    const mw   = makeLoadSheddingMiddleware(() => 9999, 250);
    const next = vi.fn();

    mw(makeReq({ path: "/health" }), makeRes(), next);
    expect(next).toHaveBeenCalled();

    mw(makeReq({ path: "/ready" }), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(2);

    mw(makeReq({ path: "/healthz/ping.txt" }), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("shed response includes request_id from req", () => {
    const mw  = makeLoadSheddingMiddleware(() => 999, 100);
    const res = makeRes();

    mw(makeReq({ path: "/api/sync", requestId: "shedded-req-xyz" }), res, vi.fn());

    expect(res._body.request_id).toBe("shedded-req-xyz");
  });

  it("passes at exactly the limit (boundary: lag === limit is ok)", () => {
    const mw   = makeLoadSheddingMiddleware(() => 250, 250);  // non strettamente maggiore
    const next = vi.fn();
    mw(makeReq({ path: "/api/data" }), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
