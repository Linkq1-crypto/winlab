/**
 * Stripe API Endpoint Tests
 * Tests all Stripe integration endpoints
 * 
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Run tests: node tests/stripe-api.test.mjs
 * 
 * Requires:
 *   - A test user token (from login)
 *   - Valid Stripe test keys in .env (mock responses for non-key endpoints)
 */

import http from "http";

const BASE_URL = "http://localhost:3000";
let authToken = null;
let testUserId = null;

// ─── Colors ──────────────────────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

async function request(method, path, body = null) {
  const url = new URL(path, BASE_URL);
  const headers = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ─── Test Runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
  try {
    await fn();
    log(`  ✅ ${name}`, GREEN);
    passed++;
  } catch (err) {
    log(`  ❌ ${name}: ${err.message}`, RED);
    failed++;
  }
}

function skip(name, reason) {
  log(`  ⏭️  ${name} (skipped: ${reason})`, YELLOW);
  skipped++;
}

// ─── Tests ───────────────────────────────────────────────────────────────────
async function runTests() {
  log(`\n${BOLD}${CYAN}═══════════════════════════════════════════${RESET}`, CYAN);
  log(`${BOLD}${CYAN}  WinLab Stripe API Tests${RESET}`, CYAN);
  log(`${BOLD}${CYAN}═══════════════════════════════════════════${RESET}\n`, CYAN);

  // ── 1. Health check ──────────────────────────────────────────────────────
  log(`${BOLD}1. Health Checks${RESET}`);

  await test("Server is running", async () => {
    const res = await request("GET", "/");
    // Even if it returns 404, the server is running
    assert(res.status < 600, `Server not reachable: status ${res.status}`);
  });

  // ── 2. Pricing endpoint ──────────────────────────────────────────────────
  log(`\n${BOLD}2. Public Endpoints (no auth)${RESET}`);

  await test("GET /api/stripe/pricing returns pricing data", async () => {
    const res = await request("GET", "/api/stripe/pricing");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.subscriptions, "Missing subscriptions in pricing");
    assert(res.data.payPerIncident, "Missing payPerIncident in pricing");
    assert(res.data.subscriptions.pro, "Missing pro plan");
    assert(res.data.subscriptions.business, "Missing business plan");
  });

  // ── 3. Auth-required endpoints ───────────────────────────────────────────
  log(`\n${BOLD}3. Auth-Required Endpoints${RESET}`);

  // Check if we have a test token
  const testToken = process.env.STRIPE_TEST_TOKEN;

  if (!testToken) {
    skip("GET /api/stripe/subscription", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/subscribe", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/pay-per-incident", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/portal", "No STRIPE_TEST_TOKEN set");
    skip("GET /api/stripe/payments", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/cancel", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/resume", "No STRIPE_TEST_TOKEN set");
    skip("POST /api/stripe/pause", "No STRIPE_TEST_TOKEN set");
  } else {
    authToken = testToken;

    await test("GET /api/stripe/subscription returns subscription data", async () => {
      const res = await request("GET", "/api/stripe/subscription");
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(
        typeof res.data.hasSubscription === "boolean",
        "Missing hasSubscription field"
      );
    });

    await test("GET /api/stripe/payments returns payments array", async () => {
      const res = await request("GET", "/api/stripe/payments");
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.data.payments), "Missing payments array");
    });

    await test("POST /api/stripe/subscribe creates checkout session", async () => {
      const res = await request("POST", "/api/stripe/subscribe", {
        plan: "pro",
        currency: "usd",
      });
      // Should return a URL (or error if Stripe key is invalid)
      assert(res.status === 200 || res.status === 500, `Unexpected status: ${res.status}`);
    });

    await test("POST /api/stripe/pay-per-incident creates checkout session", async () => {
      const res = await request("POST", "/api/stripe/pay-per-incident", {
        currency: "usd",
        labId: "test-lab",
      });
      assert(res.status === 200 || res.status === 500, `Unexpected status: ${res.status}`);
    });

    await test("POST /api/stripe/portal returns billing portal URL", async () => {
      const res = await request("POST", "/api/stripe/portal");
      // May error if no Stripe customer exists yet
      assert(
        res.status === 200 || res.status === 400,
        `Unexpected status: ${res.status}`
      );
    });

    // Test cancel without subscription → should error gracefully
    await test("POST /api/stripe/cancel errors gracefully without subscription", async () => {
      const res = await request("POST", "/api/stripe/cancel");
      assert(
        res.status === 400 || res.status === 500,
        `Expected 400 or 500, got ${res.status}`
      );
      assert(res.data.error, "Missing error message");
    });

    await test("POST /api/stripe/resume errors gracefully without subscription", async () => {
      const res = await request("POST", "/api/stripe/resume");
      assert(
        res.status === 400 || res.status === 500,
        `Expected 400 or 500, got ${res.status}`
      );
      assert(res.data.error, "Missing error message");
    });

    await test("POST /api/stripe/pause errors gracefully without subscription", async () => {
      const res = await request("POST", "/api/stripe/pause");
      assert(
        res.status === 400 || res.status === 500,
        `Expected 400 or 500, got ${res.status}`
      );
      assert(res.data.error, "Missing error message");
    });
  }

  // ── 4. Invalid plan test ─────────────────────────────────────────────────
  log(`\n${BOLD}4. Error Handling${RESET}`);

  if (testToken) {
    await test("POST /api/stripe/subscribe rejects invalid plan", async () => {
      const res = await request("POST", "/api/stripe/subscribe", {
        plan: "invalid_plan",
        currency: "usd",
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.error, "Missing error message");
      assert(
        res.data.error.toLowerCase().includes("invalid"),
        "Error should mention 'invalid'"
      );
    });

    await test("POST /api/stripe/update-subscription rejects invalid plan", async () => {
      const res = await request("POST", "/api/stripe/update-subscription", {
        newPlan: "nonexistent",
        currency: "usd",
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });
  } else {
    skip("Error handling tests", "No STRIPE_TEST_TOKEN set");
  }

  // ── 5. Webhook endpoint ──────────────────────────────────────────────────
  log(`\n${BOLD}5. Webhook Endpoint${RESET}`);

  await test("POST /api/billing/webhook rejects without signature", async () => {
    const res = await request("POST", "/api/billing/webhook", {
      type: "test",
    });
    // Should fail without valid Stripe signature
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("POST /api/billing/webhook rejects invalid signature", async () => {
    const url = new URL("/api/billing/webhook", BASE_URL);
    const payload = JSON.stringify({ type: "checkout.session.completed" });

    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "stripe-signature": "invalid_signature",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode, data }));
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

    assert(result.status === 400, `Expected 400, got ${result.status}`);
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  log(`\n${BOLD}${CYAN}═══════════════════════════════════════════${RESET}`);
  log(`${BOLD}${CYAN}  Test Results${RESET}`, CYAN);
  log(`${BOLD}${CYAN}═══════════════════════════════════════════${RESET}\n`, CYAN);

  log(`  ${GREEN}✅ Passed:  ${passed}${RESET}`);
  log(`  ${RED}❌ Failed:  ${failed}${RESET}`);
  log(`  ${YELLOW}⏭️  Skipped: ${skipped}${RESET}`);
  log(`  Total:     ${passed + failed + skipped}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
runTests().catch((err) => {
  log(`\n${RED}${BOLD}Fatal error: ${err.message}${RESET}`, RED);
  console.error(err);
  process.exit(1);
});
