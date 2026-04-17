#!/usr/bin/env node
/**
 * test-cert.mjs — Quick certificate end-to-end test
 *
 * Creates a test user, marks 10 labs as completed, generates a cert,
 * then prints the public verification URL.
 *
 * Usage:
 *   node scripts/test-cert.mjs
 *   node scripts/test-cert.mjs --base http://localhost:3001
 *   node scripts/test-cert.mjs --base https://winlab.cloud
 */

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
let BASE = baseIdx !== -1 ? args[baseIdx + 1] : null;

// Auto-detect running server
if (!BASE) {
  for (const port of [3001, 3002, 5173]) {
    try {
      const r = await fetch(`http://localhost:${port}/api/community/posts`);
      if (r.status < 600) { BASE = `http://localhost:${port}`; break; }
    } catch { /* try next */ }
  }
}
if (!BASE) {
  console.error("❌  Server not found. Start with: npm run dev:backend");
  console.error("    Or pass: node scripts/test-cert.mjs --base http://localhost:3001");
  process.exit(1);
}
console.log(`\n🔗  Using server: ${BASE}\n`);

const api = async (method, path, body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

// Real lab IDs from src/SaaSOrchestrator.jsx LABS array
const LAB_IDS = [
  "linux-terminal",
  "enhanced-terminal",
  "raid-simulator",
  "vsphere",
  "sssd-ldap",
  "network-lab",
  "ai-challenges",
  // 3 extra filler IDs to reach 10 — backend only checks count, not specific IDs
  "incident-response-01",
  "backup-recovery-01",
  "perf-tuning-01",
];

const TS    = Date.now();
const EMAIL = `certtest_${TS}@winlab.test`;
const PASS  = "Test@1234!";
const NAME  = `CertTest-${TS}`;

// ── Step 1: Register ───────────────────────────────────────────────────────────
process.stdout.write("1/4  Registering test user… ");
const reg = await api("POST", "/api/auth/register", { email: EMAIL, name: NAME, password: PASS });
if (reg.status !== 201 && reg.status !== 200) {
  console.error(`\n❌  Register failed (${reg.status}):`, reg.data);
  process.exit(1);
}
const token = reg.data.token;
console.log("✅");

// ── Step 2: Mark 10 labs complete ──────────────────────────────────────────────
process.stdout.write("2/4  Marking 10 labs as completed… ");
for (const labId of LAB_IDS) {
  const r = await api("POST", "/api/progress/update", { labId, completed: true, score: 100 }, token);
  if (r.status !== 200) {
    console.error(`\n❌  Progress update failed for ${labId} (${r.status}):`, r.data);
    process.exit(1);
  }
}
console.log("✅");

// ── Step 3: Generate certificate ───────────────────────────────────────────────
process.stdout.write("3/4  Generating certificate… ");
const certRes = await api("POST", "/api/cert/generate", undefined, token);
if (certRes.status !== 200) {
  console.error(`\n❌  Cert generation failed (${certRes.status}):`, certRes.data);
  process.exit(1);
}
const { certId, issuedAt, name } = certRes.data;
console.log("✅");

// ── Step 4: Verify public endpoint ─────────────────────────────────────────────
process.stdout.write("4/4  Verifying public cert endpoint… ");
const verifyRes = await api("GET", `/api/cert/verify/${encodeURIComponent(certId)}`);
if (!verifyRes.data.valid) {
  console.error(`\n❌  Cert verify returned invalid (${verifyRes.status}):`, verifyRes.data);
  process.exit(1);
}
console.log("✅");

// ── Result ─────────────────────────────────────────────────────────────────────
const appUrl = BASE.includes("localhost") ? BASE : "https://winlab.cloud";
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Certificate issued successfully!

  Name     : ${name}
  Cert ID  : ${certId}
  Issued   : ${new Date(issuedAt).toLocaleString()}

  Public URL:
  ${appUrl}/cert/${certId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
