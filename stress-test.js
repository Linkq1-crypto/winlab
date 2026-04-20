/**
 * WinLab — K6 Stress Test
 *
 * Verifica che il server regga il carico e risponda correttamente:
 *   - timeout sotto pressione
 *   - 503 Load Shedding prima del crash del processo
 *   - nessun 5xx grezzo (stack trace esposti)
 *   - header x-request-id sempre presente
 *
 * Prerequisiti:
 *   brew install k6           (macOS)
 *   choco install k6          (Windows)
 *   apt install k6            (Ubuntu)
 *
 * Esecuzione:
 *   k6 run stress-test.js
 *   BASE_URL=https://staging.app.com k6 run stress-test.js
 *   k6 run --vus 200 --duration 60s stress-test.js   (più aggressivo)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Mark expected 4xx as non-failures so http_req_failed only tracks real errors
http.setResponseCallback(http.expectedStatuses(
  { min: 200, max: 299 },
  400, 401, 403, 404, 422, 429, 503
));

// ─── Configurazione ────────────────────────────────────────────────────────

const BASE_URL  = __ENV.BASE_URL || "http://localhost:3001";
const REQ_TIMEOUT = "3s";  // timeout per singola request

// ─── Metriche custom ──────────────────────────────────────────────────────

const shedRequests     = new Counter("load_shed_503");       // risposte 503 LOAD_SHED
const validationErrors = new Counter("validation_errors");   // risposte 400
const unexpectedErrors = new Counter("unexpected_5xx");      // 5xx non-503
const requestIdMissing = new Counter("missing_request_id");  // header assente
const responseTime     = new Trend("response_time_ms", true);

// ─── Scenari di carico ────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Rampa graduale: simula picco di traffico organico
    ramp_up: {
      executor:   "ramping-vus",
      startVUs:   0,
      stages: [
        { duration: "10s", target: 20  },   // warm-up
        { duration: "20s", target: 100 },   // carico normale
        { duration: "20s", target: 200 },   // picco — qui scatta il load shedding
        { duration: "10s", target: 0   },   // cool-down
      ],
      gracefulRampDown: "5s",
    },
  },

  // Soglie: il test FALLISCE se non rispettate
  thresholds: {
    // Il 95% delle risposte deve arrivare entro 2s
    "http_req_duration":          ["p(95)<2000"],
    // Meno del 10% di errori totali (inclusi 503 controllati)
    "http_req_failed":            ["rate<0.10"],
    // Nessun 5xx grezzo (stack trace) — solo 503 strutturati sono ok
    "unexpected_5xx":             ["count==0"],
    // Header x-request-id sempre presente
    "missing_request_id":         ["count==0"],
  },
};

// ─── Scenari HTTP ─────────────────────────────────────────────────────────

const PARAMS = { timeout: REQ_TIMEOUT };

function checkRequestId(res) {
  const hasId = res.headers["X-Request-Id"] || res.headers["x-request-id"];
  if (!hasId) requestIdMissing.add(1);
  return !!hasId;
}

/** 1. Health check — sempre deve rispondere */
function testHealth() {
  const res = http.get(`${BASE_URL}/health`, PARAMS);
  responseTime.add(res.timings.duration);

  check(res, {
    "health: status 200":           (r) => r.status === 200,
    "health: body has status ok":   (r) => {
      try { return JSON.parse(r.body).status === "ok"; } catch { return false; }
    },
    "health: x-request-id present": (r) => checkRequestId(r),
  });
}

/** 2. Readiness probe — verifica dipendenze */
function testReady() {
  const res = http.get(`${BASE_URL}/ready`, PARAMS);
  responseTime.add(res.timings.duration);

  const ok = check(res, {
    "ready: 200 or 503 (no other)": (r) => [200, 503].includes(r.status),
    "ready: x-request-id present":  (r) => checkRequestId(r),
  });

  if (res.status === 503) {
    try {
      const body = JSON.parse(res.body);
      check(res, {
        "ready/503: structured body":    () => body.status === "unavailable",
        "ready/503: dependency named":   () => typeof body.dependency === "string",
        "ready/503: request_id in body": () => typeof body.request_id === "string",
      });
    } catch { /* body non JSON */ }
  }
}

/** 3. Endpoint protetto senza token — verifica gestione errori auth */
function testAuthError() {
  const res = http.get(`${BASE_URL}/api/user/me`, PARAMS);
  responseTime.add(res.timings.duration);

  check(res, {
    "auth-error: 401 or 403":        (r) => [401, 403].includes(r.status),
    "auth-error: x-request-id":      (r) => checkRequestId(r),
    "auth-error: no stack trace":     (r) => !r.body?.includes("at Object."),
  });
}

/** 4. Validation error — payload intenzionalmente malformato */
function testValidationError() {
  const payload = JSON.stringify({ invalid_field: true });
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    payload,
    { headers: { "Content-Type": "application/json" }, ...PARAMS }
  );
  responseTime.add(res.timings.duration);

  if (res.status === 400) {
    validationErrors.add(1);
    check(res, {
      "validation: request_id present": (r) => {
        try { return !!JSON.parse(r.body).request_id; } catch { return false; }
      },
      "validation: code field":         (r) => {
        try {
          const b = JSON.parse(r.body);
          return b.code === "VALIDATION_ERROR" || typeof b.error === "string";
        } catch { return false; }
      },
    });
  }
}

/** 5. Carico pesante sull'endpoint sync — forza load shedding */
function testSyncHeavy() {
  const payload = JSON.stringify({
    id:       `stress_${__VU}_${__ITER}`,
    type:     "SYNC",
    payload:  { type: "PROGRESS", step: __ITER, vu: __VU },
    deviceId: `vuser_${__VU}`,
    timestamp: Date.now(),
  });

  const res = http.post(
    `${BASE_URL}/api/helpdesk/sync`,
    payload,
    { headers: { "Content-Type": "application/json" }, ...PARAMS }
  );
  responseTime.add(res.timings.duration);

  if (res.status === 503) {
    shedRequests.add(1);
    check(res, {
      "shed/503: structured body":    (r) => {
        try { return JSON.parse(r.body).code === "LOAD_SHED"; } catch { return false; }
      },
      "shed/503: retry_after field":  (r) => {
        try { return typeof JSON.parse(r.body).retry_after === "number"; } catch { return false; }
      },
    });
  } else if (res.status >= 500 && res.status !== 503) {
    unexpectedErrors.add(1);
    check(res, {
      "no raw stack trace": (r) => !r.body?.includes("at Object.") && !r.body?.includes("node_modules"),
    });
  } else {
    check(res, {
      "sync: 200 or 400/422":        (r) => [200, 400, 422].includes(r.status),
      "sync: x-request-id present":  (r) => checkRequestId(r),
    });
  }
}

// ─── VU main loop ─────────────────────────────────────────────────────────

export default function () {
  // Distribuisce il carico in modo realistico
  const roll = Math.random();

  if (roll < 0.10)      testHealth();
  else if (roll < 0.15) testReady();
  else if (roll < 0.30) testAuthError();
  else if (roll < 0.45) testValidationError();
  else                  testSyncHeavy();   // 55% del traffico → forza lo shedding al picco

  sleep(Math.random() * 0.5);  // 0–500ms think time (realismo)
}

// ─── Summary finale ───────────────────────────────────────────────────────

export function handleSummary(data) {
  const passed   = data.metrics["http_req_failed"]?.values["rate"] < 0.10;
  const shed     = data.metrics["load_shed_503"]?.values["count"]  || 0;
  const p95      = Math.round(data.metrics["http_req_duration"]?.values["p(95)"] || 0);
  const total    = data.metrics["http_reqs"]?.values["count"] || 0;
  const missingId = data.metrics["missing_request_id"]?.values["count"] || 0;
  const bad5xx   = data.metrics["unexpected_5xx"]?.values["count"] || 0;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WinLab Stress Test — Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Totale richieste  : ${total}
  Esito             : ${passed ? "✅ PASS" : "❌ FAIL"}
  P95 latency       : ${p95}ms  (soglia: 2000ms)
  Load shed (503)   : ${shed}   (attesi sotto picco)
  5xx inattesi      : ${bad5xx} (soglia: 0)
  x-request-id KO   : ${missingId} (soglia: 0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  return {
    "stdout": JSON.stringify(data, null, 2),
    "stress-report.json": JSON.stringify(data, null, 2),
  };
}
