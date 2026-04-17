/**
 * test_users.mjs – WINLAB v7 Integration Tests
 * Simulates 20 free (starter) + 20 pro (paying) + 20 business (B2B) users.
 *
 * Prerequisites: server must be running on :3001 or :3002
 * Run: node test_users.mjs
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

// ── Detect server port ─────────────────────────────────────────────────────────
let BASE;
for (const port of [3001, 3002]) {
  try {
    const r = await fetch(`http://localhost:${port}/api/community/posts`);
    if (r.status < 600) { BASE = `http://localhost:${port}`; break; }
  } catch { /* try next */ }
}
if (!BASE) {
  console.error("❌  Server not running on port 3001 or 3002.");
  console.error("    Start it with: npm run dev:backend");
  process.exit(1);
}
console.log(`\n🔗  Testing against ${BASE}\n`);

// ── Helpers ────────────────────────────────────────────────────────────────────
const TS    = Date.now();
const prisma = new PrismaClient();
const EMAIL  = (tier, i) => `${tier}${i}_${TS}@winlab.test`;
const PASS   = "Test@1234!";

const api = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// Register a user, then optionally upgrade the plan via /api/user/upgrade
const createUser = async (tier, i, plan = "starter") => {
  const r = await api("POST", "/api/auth/register", {
    email: EMAIL(tier, i),
    name:  `${tier}-${i}`,
    password: PASS,
  });
  assert.equal(r.status, 200, `register ${tier}-${i} failed: ${JSON.stringify(r.data)}`);
  if (plan !== "starter") {
    const up = await api("POST", "/api/user/upgrade", { plan }, r.data.token);
    assert.equal(up.status, 200, `upgrade ${tier}-${i} to ${plan} failed: ${JSON.stringify(up.data)}`);
  }
  return r.data; // { token, user }
};

// Cleanup: delete all users created by this test run
process.on("beforeExit", async () => {
  const users = await prisma.user.findMany({
    where: { email: { contains: `_${TS}@winlab.test` } },
  });
  const ids = users.map(u => u.id);
  if (!ids.length) { await prisma.$disconnect(); return; }
  await prisma.vote.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userProgress.deleteMany({ where: { userId: { in: ids } } });
  await prisma.certificate.deleteMany({ where: { userId: { in: ids } } });
  await prisma.analytics.deleteMany({ where: { userId: { in: ids } } });
  await prisma.post.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  console.log(`\n🧹  Cleaned up ${ids.length} test users from DB.\n`);
});

// ════════════════════════════════════════════════════════════════════════════════
// STARTER (FREE) — 20 users
// ════════════════════════════════════════════════════════════════════════════════
describe("Starter (Free) — 20 users", async () => {
  const TIER = "free";
  let users  = [];

  before(async () => {
    users = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createUser(TIER, i))
    );
  });

  // ── Auth ───────────────────────────────────────────────────────────────────
  test("all 20 registered with plan: starter", () => {
    for (const u of users) assert.equal(u.user.plan, "starter");
  });

  test("login works for all 20", async () => {
    await Promise.all(users.map(async (_, i) => {
      const r = await api("POST", "/api/auth/login", { email: EMAIL(TIER, i), password: PASS });
      assert.equal(r.status, 200);
      assert.ok(r.data.token, "missing token");
    }));
  });

  test("duplicate email → 409", async () => {
    const r = await api("POST", "/api/auth/register", { email: EMAIL(TIER, 0), password: PASS });
    assert.equal(r.status, 409);
  });

  test("wrong password → 401", async () => {
    const r = await api("POST", "/api/auth/login", { email: EMAIL(TIER, 0), password: "wrong" });
    assert.equal(r.status, 401);
  });

  test("register missing password → 400", async () => {
    const r = await api("POST", "/api/auth/register", { email: "nopw@test.com" });
    assert.equal(r.status, 400);
  });

  // ── Profile ────────────────────────────────────────────────────────────────
  test("GET /user/me → plan: starter for all 20", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/user/me", undefined, u.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.plan, "starter");
    }));
  });

  test("GET /user/me without token → 401", async () => {
    const r = await api("GET", "/api/user/me");
    assert.equal(r.status, 401);
  });

  test("PATCH /user/me updates name", async () => {
    const r = await api("PATCH", "/api/user/me", { name: "Updated Starter" }, users[0].token);
    assert.equal(r.status, 200);
    assert.equal(r.data.name, "Updated Starter");
    assert.equal(r.data.plan, "starter"); // plan unchanged
  });

  // ── Progress ───────────────────────────────────────────────────────────────
  test("GET /progress/:userId own data → 200 for all 20", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", `/api/progress/${u.user.id}`, undefined, u.token);
      assert.equal(r.status, 200);
      assert.ok(typeof r.data === "object");
    }));
  });

  test("GET /progress/:otherId → 403 (cross-user access denied)", async () => {
    const r = await api("GET", `/api/progress/${users[1].user.id}`, undefined, users[0].token);
    assert.equal(r.status, 403);
  });

  test("progress/update missing userId → 400", async () => {
    const r = await api("POST", "/api/progress/update", { labId: "linux-terminal" });
    assert.equal(r.status, 400);
  });

  test("1st lab → triggerPaywall: false for all 20 starter users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "linux-terminal", completed: true, score: 90,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.triggerPaywall, false, `paywall fired too early for ${u.user.id}`);
    }));
  });

  test("2nd lab → triggerPaywall: true for all 20 starter users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "raid-simulator", completed: true, score: 80,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.triggerPaywall, true, `paywall should fire after 2 labs`);
    }));
  });

  // ── Access gating ──────────────────────────────────────────────────────────
  test("GET /team/progress → 403 for all 20 starter users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/team/progress", undefined, u.token);
      assert.equal(r.status, 403);
    }));
  });

  test("GET /admin/feedback-summary → 403 for all 20 starter users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/admin/feedback-summary", undefined, u.token);
      assert.equal(r.status, 403);
    }));
  });

  test("POST /cert/generate → 403 (only 2 labs, need 10)", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("POST", "/api/cert/generate", {}, u.token);
      assert.equal(r.status, 403);
      assert.ok(r.data.progress, "missing progress field");
    }));
  });

  // ── Community ──────────────────────────────────────────────────────────────
  let postIds = [];

  test("POST /community/posts → 201 for all 20", async () => {
    const results = await Promise.all(users.map(async (u, i) => {
      const r = await api("POST", "/api/community/posts", {
        type: "feature", title: `Feature from free user ${i}`, body: "Nice to have",
      }, u.token);
      assert.equal(r.status, 201);
      assert.ok(r.data.id);
      return r.data.id;
    }));
    postIds = results;
  });

  test("POST /community/posts missing title → 400", async () => {
    const r = await api("POST", "/api/community/posts", { type: "feature" }, users[0].token);
    assert.equal(r.status, 400);
  });

  test("vote → 'voted', revote → 'unvoted' (toggle) for all 20", async () => {
    await Promise.all(users.map(async (u, i) => {
      const v1 = await api("POST", `/api/community/posts/${postIds[i]}/vote`, {}, u.token);
      assert.equal(v1.status, 200);
      assert.equal(v1.data.action, "voted");
      const v2 = await api("POST", `/api/community/posts/${postIds[i]}/vote`, {}, u.token);
      assert.equal(v2.status, 200);
      assert.equal(v2.data.action, "unvoted");
    }));
  });

  test("POST /community/bugs → 201 for all 20", async () => {
    await Promise.all(users.map(async (u, i) => {
      const r = await api("POST", "/api/community/bugs", {
        labId: "linux-terminal", title: `Bug from free user ${i}`, severity: "medium",
      }, u.token);
      assert.equal(r.status, 201);
      assert.equal(r.data.type, "bug");
    }));
  });

  test("GET /community/posts → 200 public (no auth needed)", async () => {
    const r = await api("GET", "/api/community/posts");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
    assert.ok(r.data.length >= 20);
  });

  // ── Billing validation ─────────────────────────────────────────────────────
  test("POST /billing/checkout invalid plan → 400", async () => {
    const r = await api("POST", "/api/billing/checkout", { plan: "enterprise" }, users[0].token);
    assert.equal(r.status, 400);
  });

  test("POST /billing/checkout without auth → 401", async () => {
    const r = await api("POST", "/api/billing/checkout", { plan: "pro" });
    assert.equal(r.status, 401);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// PRO (PAYING) — 20 users
// ════════════════════════════════════════════════════════════════════════════════
describe("Pro (Paying) — 20 users", async () => {
  const TIER = "pro";
  let users  = [];

  before(async () => {
    users = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createUser(TIER, i, "pro"))
    );
  });

  test("all 20 registered and upgraded to pro", () => {
    for (const u of users) assert.ok(u.token);
  });

  test("GET /user/me → plan: pro for all 20", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/user/me", undefined, u.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.plan, "pro");
    }));
  });

  test("2 labs completed → triggerPaywall: false for all 20 pro users", async () => {
    await Promise.all(users.map(async u => {
      await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "linux-terminal", completed: true, score: 90,
      });
      const r = await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "raid-simulator", completed: true, score: 85,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.triggerPaywall, false, "pro user hit paywall after 2 labs!");
    }));
  });

  test("8 pro labs completed — no paywall at any point", async () => {
    const proLabs = ["os-install", "vsphere", "sssd-ldap", "real-server", "advanced-scenarios", "ai-challenges"];
    await Promise.all(users.map(async u => {
      for (const labId of proLabs) {
        const r = await api("POST", "/api/progress/update", {
          userId: u.user.id, labId, completed: true, score: 80,
        });
        assert.equal(r.data.triggerPaywall, false, `paywall fired on labId: ${labId}`);
      }
    }));
  });

  test("GET /team/progress → 403 for all 20 pro users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/team/progress", undefined, u.token);
      assert.equal(r.status, 403);
    }));
  });

  test("GET /admin/feedback-summary → 403 for all 20 pro users", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/admin/feedback-summary", undefined, u.token);
      assert.equal(r.status, 403);
    }));
  });

  test("POST /cert/generate → 403 with progress: '8/10'", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("POST", "/api/cert/generate", {}, u.token);
      assert.equal(r.status, 403);
      assert.equal(r.data.progress, "8/10");
    }));
  });

  test("community posts work for all 20 pro users", async () => {
    await Promise.all(users.map(async (u, i) => {
      const r = await api("POST", "/api/community/posts", {
        type: "feature", title: `Pro feature request ${i}`,
      }, u.token);
      assert.equal(r.status, 201);
    }));
  });

  test("POST /user/upgrade invalid plan → 400", async () => {
    const r = await api("POST", "/api/user/upgrade", { plan: "gold" }, users[0].token);
    assert.equal(r.status, 400);
  });

  test("GET /progress/:userId own data → 200 with 8 completed labs", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", `/api/progress/${u.user.id}`, undefined, u.token);
      assert.equal(r.status, 200);
      const completed = Object.values(r.data).filter(l => l.completed).length;
      assert.equal(completed, 8);
    }));
  });

  test("PATCH /user/me preserves pro plan", async () => {
    await Promise.all(users.map(async (u, i) => {
      const r = await api("PATCH", "/api/user/me", { name: `Pro Updated ${i}` }, u.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.plan, "pro");
    }));
  });

  test("GET /admin/cache-stats → 200 (public endpoint)", async () => {
    const r = await api("GET", "/api/admin/cache-stats");
    assert.equal(r.status, 200);
    assert.ok("cachedEntries" in r.data);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// BUSINESS (B2B) — 20 users
// ════════════════════════════════════════════════════════════════════════════════
describe("Business (B2B) — 20 users", async () => {
  const TIER = "biz";
  let users  = [];

  before(async () => {
    users = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createUser(TIER, i, "business"))
    );
  });

  test("all 20 registered and upgraded to business", () => {
    for (const u of users) assert.ok(u.token);
  });

  test("GET /user/me → plan: business for all 20", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/user/me", undefined, u.token);
      assert.equal(r.status, 200);
      assert.equal(r.data.plan, "business");
    }));
  });

  test("2 labs (including business-tier labs) → triggerPaywall: false", async () => {
    await Promise.all(users.map(async u => {
      await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "linux-terminal", completed: true, score: 95,
      });
      const r = await api("POST", "/api/progress/update", {
        userId: u.user.id, labId: "network-lab", completed: true, score: 92,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.triggerPaywall, false, "business user should never see paywall");
    }));
  });

  test("GET /team/progress → 200 [] (no team assigned yet) for all 20", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/team/progress", undefined, u.token);
      assert.equal(r.status, 200);
      assert.ok(Array.isArray(r.data));
    }));
  });

  test("GET /admin/feedback-summary → plan check passes (200 or 500, never 403)", async () => {
    await Promise.all(users.map(async u => {
      const r = await api("GET", "/api/admin/feedback-summary", undefined, u.token);
      assert.notEqual(r.status, 403, "business user should not be blocked by plan check");
      assert.ok([200, 500].includes(r.status), `unexpected status ${r.status}`);
    }));
  });

  // 10 labs → cert generation (first 5 users)
  test("10 labs completed → cert generates with WINLAB- prefix", async () => {
    const remainingLabs = [
      "os-install", "vsphere", "sssd-ldap", "real-server",
      "advanced-scenarios", "ai-challenges", "raid-simulator", "security-audit",
    ];
    await Promise.all(users.slice(0, 5).map(async u => {
      for (const labId of remainingLabs) {
        await api("POST", "/api/progress/update", {
          userId: u.user.id, labId, completed: true, score: 85,
        });
      }
      const r = await api("POST", "/api/cert/generate", {}, u.token);
      assert.equal(r.status, 200, `cert generation failed: ${JSON.stringify(r.data)}`);
      assert.ok(r.data.certId.startsWith("WINLAB-"), "certId format wrong");
    }));
  });

  test("cert generation is idempotent (same certId on re-call)", async () => {
    const u = users[0];
    const r1 = await api("POST", "/api/cert/generate", {}, u.token);
    const r2 = await api("POST", "/api/cert/generate", {}, u.token);
    assert.equal(r1.data.certId, r2.data.certId);
    assert.equal(r2.data.alreadyIssued, true);
  });

  test("GET /cert/verify/:certId → valid: true (public endpoint)", async () => {
    const cert = await api("POST", "/api/cert/generate", {}, users[0].token);
    const r    = await api("GET",  `/api/cert/verify/${cert.data.certId}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.valid, true);
    assert.equal(r.data.labsCompleted, 10);
  });

  test("GET /cert/verify/fake-id → valid: false + 404", async () => {
    const r = await api("GET", "/api/cert/verify/WINLAB-fake-000-INVALID");
    assert.equal(r.status, 404);
    assert.equal(r.data.valid, false);
  });

  test("POST /cert/generate → 403 for users with < 10 labs (remaining 15)", async () => {
    await Promise.all(users.slice(5).map(async u => {
      const r = await api("POST", "/api/cert/generate", {}, u.token);
      assert.equal(r.status, 403);
      assert.equal(r.data.progress, "2/10");
    }));
  });

  test("community bugs with critical severity → 201 for all 20", async () => {
    await Promise.all(users.map(async (u, i) => {
      const r = await api("POST", "/api/community/bugs", {
        labId: "security-audit",
        title: `Critical bug from biz user ${i}`,
        severity: "critical",
      }, u.token);
      assert.equal(r.status, 201);
      assert.equal(r.data.severity, "critical");
    }));
  });

  test("business users can vote on community posts", async () => {
    const posts = await api("GET", "/api/community/posts");
    assert.ok(posts.data.length > 0, "no posts found to vote on");
    const postId = posts.data[0].id;
    await Promise.all(users.map(async u => {
      const r = await api("POST", `/api/community/posts/${postId}/vote`, {}, u.token);
      assert.equal(r.status, 200);
      assert.ok(["voted", "unvoted"].includes(r.data.action));
    }));
  });

  test("GET /community/posts?type=bug → only bug posts returned", async () => {
    const r = await api("GET", "/api/community/posts?type=bug");
    assert.equal(r.status, 200);
    for (const p of r.data) assert.equal(p.type, "bug");
  });

  test("POST /community/posts without auth → 401", async () => {
    const r = await api("POST", "/api/community/posts", { title: "unauth post" });
    assert.equal(r.status, 401);
  });
});
