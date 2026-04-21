// ====================================================================
// WINLAB v7 — Main Server
// Node 22 ESM · Express · Prisma · Stripe · Anthropic · WebSocket
// ====================================================================

import express from "express";
import { rateLimit } from "express-rate-limit";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

import {
  sendPasswordResetEmail,
  sendVerifyEmail,
  verifyResetToken,
  verifyEmailToken,
  sendNewDeviceLoginEmail,
  sendAccountDeletedEmail,
  sendWelcomeEmail,
} from "./src/services/userLifecycleEmailFlow.js";
// import { bootstrapAlertFlow } from "./src/core/alertDispatcher.js";
import helpdeskRouter from "./src/api/routes/helpdesk.js";
import { startHelpdeskWorker } from "./src/services/helpdeskWorker.js";
import publicApiRouter from "./src/api/routes/publicApi.js";
import i18nRouter from "./src/api/routes/i18n.js";
import { tenantMiddleware } from "./src/services/tenantManager.js";
import { qosMiddleware } from "./src/services/qosLayer.js";
import { startMeteringFlush } from "./src/services/billingMetering.js";
import { recordDeploy as recordDeployEvent, getDeployHistory as getDeployHistoryFn } from "./src/services/helpdeskEngines/bugDetection.js";
import { syncLogger, dlqLogger } from "./src/services/logger.js";

// try { bootstrapAlertFlow(); } catch (e) { console.warn("[AlertDispatcher] bootstrap skipped:", e.message); }
try { startHelpdeskWorker(); } catch (e) { console.warn("[Helpdesk] worker skipped:", e.message); }

// ── Constants ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const BASE_PORT  = parseInt(process.env.PORT || "3001", 10);
const IS_PROD    = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const ENC_KEY    = (process.env.ENCRYPTION_KEY || "00000000000000000000000000000000").slice(0, 32);
const EARLY_ACCESS_FILE = path.join(__dirname, "data", "early-access-seats.json");

// ── Clients ──────────────────────────────────────────────────────────
const prisma    = new PrismaClient();
const stripe    = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// ── Encryption helpers ───────────────────────────────────────────────
function encryptField(text) {
  if (!text) return text;
  try {
    const iv  = crypto.randomBytes(12);
    const key = Buffer.from(ENC_KEY, "utf8");
    const c   = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
    const tag = c.getAuthTag();
    return JSON.stringify({ iv: iv.toString("hex"), enc: enc.toString("hex"), tag: tag.toString("hex") });
  } catch { return text; }
}
function decryptField(stored) {
  if (!stored) return stored;
  try {
    const { iv, enc, tag } = JSON.parse(stored);
    const key = Buffer.from(ENC_KEY, "utf8");
    const d   = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
    d.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([d.update(Buffer.from(enc, "hex")), d.final()]).toString("utf8");
  } catch { return stored; }
}

// ── Express setup ────────────────────────────────────────────────────
const app = express();

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Request ID (must be before all routes) ───────────────────────────
app.use((req, res, next) => {
  const id = req.headers["x-request-id"] || uuidv4();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
});

// ── Health / Readiness probes (no rate limit, no auth) ───────────────
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now() }));
app.get("/ready",  (req, res) => res.json({ status: "ok", ts: Date.now() }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ["https://winlab.cloud", "https://www.winlab.cloud", "http://localhost:5173", "http://localhost:5174"];
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-tenant-id,x-tenant-tier");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Static files (React build) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));

// ── Rate limiters ────────────────────────────────────────────────────
const authLimiter    = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });
const aiLimiter      = rateLimit({ windowMs: 60_000, max: 30 });
const paymentLimiter = rateLimit({ windowMs: 60_000, max: 5 });
const generalLimiter = rateLimit({ windowMs: 60_000, max: 2_000 });
app.use("/api/", generalLimiter);

// ── Auth middleware ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const cookie = req.cookies?.winlab_token;
    const token  = header.startsWith("Bearer ") ? header.slice(7) : cookie;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Forbidden" });
    next();
  });
}
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.isAdmin, plan: user.plan },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// ── Helpdesk router ──────────────────────────────────────────────────
app.use("/api/helpdesk", helpdeskRouter);

// ── Health check ─────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Public API v1 (external integrations + SDK) ──────────────────────
app.use("/api/v1", tenantMiddleware, qosMiddleware, publicApiRouter);
app.use("/api/i18n", i18nRouter);

// ====================================================================
// AUTH
// ====================================================================

// POST /api/auth/register

app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password, name, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        plan: "starter",
      },
    });

    const seatAssigned = null;

    // 📧 WELCOME EMAIL
    sendWelcomeEmail(user).catch(err => console.error("sendWelcomeEmail error:", err));

    // 🔐 TOKEN (senza ...)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        plan: user.plan
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 🎁 REFERRAL (opzionale ma corretto)
    if (referralCode) {
      try {
        const ref = await prisma.referral.findUnique({
          where: { token: referralCode }
        });

        if (ref && ref.active && !ref.converted) {
          await prisma.referral.update({
            where: { token: referralCode },
            data: {
              converted: true,
              convertedAt: new Date()
            }
          });
        }
      } catch {}
    }

    return res.json({
      token,
      user,
      seatAssigned: !!seatAssigned,
      seatId: seatAssigned
    });

  } catch (err) {
  console.error("REGISTER ERROR FULL:", err);
  return res.status(500).json({
    error: "Registration failed",
    detail: err.message
  });
}
});
// POST /api/auth/login
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.accountStatus === "deleted") return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = generateToken(user);
    res.cookie("winlab_token", token, { httpOnly: true, secure: IS_PROD, sameSite: "strict", maxAge: 86400000 });
    res.json({ token, user: { id: user.id, email: user.email, name: decryptField(user.name), plan: user.plan, isAdmin: user.isAdmin } });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("winlab_token");
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return 200 — don't reveal whether email exists
    if (user) {
      await sendPasswordResetEmail(user).catch(err => {
        console.error("sendPasswordResetEmail error:", err);
      });
    }
    res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("POST /api/auth/forgot-password error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password too short" });
    const hash  = crypto.createHash("sha256").update(token).digest("hex");
    const reset = await prisma.passwordReset.findFirst({ where: { token: hash, usedAt: null, expiresAt: { gt: new Date() } } });
    if (!reset) return res.status(400).json({ error: "Invalid or expired token" });
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/reset-password error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Microsoft SSO ────────────────────────────────────────────────────
const MS_CLIENT_ID     = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MS_REDIRECT_URI  = process.env.MICROSOFT_REDIRECT_URI || "https://winlab.cloud/api/auth/microsoft/callback";

app.get("/api/auth/microsoft", (req, res) => {
  if (!MS_CLIENT_ID) return res.status(503).json({ error: "Microsoft SSO not configured" });
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("ms_oauth_state", state, { httpOnly: true, secure: IS_PROD, sameSite: "lax", maxAge: 600_000 });
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    scope: "openid profile email User.Read",
    state,
    response_mode: "query",
  });
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
});

app.get("/api/auth/microsoft/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect("/?ms_error=" + encodeURIComponent(error));
    const storedState = req.cookies?.ms_oauth_state;
    if (!state || state !== storedState) return res.redirect("/?ms_error=state_mismatch");
    res.clearCookie("ms_oauth_state");

    // Exchange code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        redirect_uri: MS_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.redirect("/?ms_error=" + encodeURIComponent(tokenData.error));

    // Get user profile from Graph
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const msId    = profile.id;
    const msEmail = (profile.mail || profile.userPrincipalName || "").toLowerCase();
    const msName  = profile.displayName || "";
    const tenantDomain = msEmail.includes("@") ? msEmail.split("@")[1] : null;

    // Upsert user
    let user = await prisma.user.findFirst({ where: { OR: [{ microsoftId: msId }, { email: msEmail }] } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: msEmail,
          name: msName,
          provider: "microsoft",
          providerId: msId,
          microsoftId: msId,
          tenantDomain,
          passwordHash: "",
          plan: JSON.stringify({ tier: "free" }),
        },
      });
    } else if (!user.microsoftId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { microsoftId: msId, provider: "microsoft", providerId: msId, tenantDomain },
      });
    }

    const token = generateToken(user);
    res.cookie("winlab_token", token, { httpOnly: true, secure: IS_PROD, sameSite: "lax", maxAge: 86400000 });
    res.redirect("/?ms_login=ok");
  } catch (err) {
    console.error("MS callback error:", err);
    res.redirect("/?ms_error=callback_failed");
  }
});

// ====================================================================
// USER
// ====================================================================

// GET /api/user/me
app.get("/api/user/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      id: user.id,
      email: decryptField(user.email) || user.email,
      name: decryptField(user.name),
      nickname: decryptField(user.nickname),
      plan: user.plan,
      isAdmin: user.isAdmin,
      totalXp: user.totalXp,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      mlConsent: user.mlConsent,
      aiMentorConsent: user.aiMentorConsent,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionPeriodEnd: user.subscriptionPeriodEnd,
      trialEndsAt: user.trialEndsAt,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      provider: user.provider,
      unlockedBadges: user.unlockedBadges,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("GET /api/user/me error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/user/profile
app.get("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { progress: true, certificates: true, skills: true },
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({
      id: user.id,
      email: decryptField(user.email) || user.email,
      name: decryptField(user.name),
      totalXp: user.totalXp,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      progress: user.progress,
      certificates: user.certificates,
      skills: user.skills,
      unlockedBadges: user.unlockedBadges,
    });
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/user/settings
app.patch("/api/user/settings", requireAuth, express.json(), async (req, res) => {
  try {
    const { name, nickname } = req.body;
    const data = {};
    if (name !== undefined)     data.name     = encryptField(name);
    if (nickname !== undefined) data.nickname  = encryptField(nickname);
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ ok: true, name: decryptField(user.name), nickname: decryptField(user.nickname) });
  } catch (err) {
    console.error("PATCH /api/user/settings error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/user/account (alias)
app.patch("/api/user/account", requireAuth, express.json(), async (req, res) => {
  try {
    const { name, nickname } = req.body;
    const data = {};
    if (name !== undefined)     data.name     = encryptField(name);
    if (nickname !== undefined) data.nickname  = encryptField(nickname);
    await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/user/account error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/user/change-password
app.post("/api/user/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "New password too short" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password incorrect" });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/change-password error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/user/ml-consent
app.post("/api/user/ml-consent", requireAuth, async (req, res) => {
  try {
    const { consent } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mlConsent: Boolean(consent), mlConsentDate: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/ml-consent error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/user/ai-consent
app.post("/api/user/ai-consent", requireAuth, async (req, res) => {
  try {
    const { consent } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { aiMentorConsent: Boolean(consent), aiMentorConsentDate: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/user/ai-consent error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/user/export-data
app.get("/api/user/export-data", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { progress: true, certificates: true, analytics: { take: 100 }, skills: true },
    });
    res.json({
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: decryptField(user.email) || user.email,
        name: decryptField(user.name),
        createdAt: user.createdAt,
        plan: user.plan,
        totalXp: user.totalXp,
        currentStreak: user.currentStreak,
      },
      progress: user.progress,
      certificates: user.certificates,
      skills: user.skills,
    });
  } catch (err) {
    console.error("GET /api/user/export-data error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/user/ai-training-data
app.get("/api/user/ai-training-data", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ mlConsent: user.mlConsent, aiMentorConsent: user.aiMentorConsent });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/user/account
app.delete("/api/user/account", requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { accountStatus: "deleted", email: `deleted_${req.user.id}@winlab.invalid`, name: null, nickname: null },
    });
    res.clearCookie("winlab_token");
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user/account error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/user/upgrade (internal plan change, Stripe-agnostic)
app.post("/api/user/upgrade", requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const allowed = ["free", "pro", "business", "enterprise"];
    if (!allowed.includes(plan)) return res.status(400).json({ error: "Invalid plan" });
    await prisma.user.update({ where: { id: req.user.id }, data: { plan: JSON.stringify({ tier: plan }) } });
    res.json({ ok: true, plan });
  } catch (err) {
    console.error("POST /api/user/upgrade error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// CONSENT / ANALYTICS
// ====================================================================

// POST /api/consent/log
app.post("/api/consent/log", async (req, res) => {
  try {
    const { event, userId, meta } = req.body;
    await prisma.analytics.create({
      data: { event: event || "consent", userId: userId || null, meta: meta ? JSON.stringify(meta) : null },
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // non-critical, never fail
  }
});

// POST /api/analytics/track
app.post("/api/analytics/track", async (req, res) => {
  try {
    const { event, meta } = req.body;
    let userId = null;
    try {
      const token = (req.headers.authorization || "").split(" ")[1];
      if (token) userId = jwt.verify(token, JWT_SECRET)?.id || null;
    } catch {}
    await prisma.analytics.create({ data: { event, userId, meta: meta ? JSON.stringify(meta) : null } });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// POST /api/analytics/launch
app.post("/api/analytics/launch", async (req, res) => {
  try {
    const { event, meta } = req.body;
    await prisma.analytics.create({ data: { event: event || "launch", userId: null, meta: meta ? JSON.stringify(meta) : null } });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// GET /api/analytics/launch — aggregated data for TelemetryDashboard
app.get("/api/analytics/launch", async (req, res) => {
  try {
    const rows = await prisma.analytics.findMany({ orderBy: { createdAt: "asc" } });

    const counter = (pred) => rows.filter(pred).length;
    const signupDone   = counter(r => r.event === "signup_done");
    const totalVisitors = counter(r => r.event === "page_view");
    const ctaClicks    = counter(r => r.event === "cta_click");
    const signupStarts = counter(r => r.event === "signup_start");
    const conversionRate = totalVisitors > 0
      ? ((signupDone / totalVisitors) * 100).toFixed(1) + "%"
      : "0%";

    // Daily stats
    const byDay = {};
    rows.forEach(r => {
      const day = (r.createdAt || new Date()).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, uniqueVisitors: 0, pageViews: 0 };
      if (r.event === "page_view") { byDay[day].pageViews++; byDay[day].uniqueVisitors++; }
    });
    const dailyStats = Object.values(byDay).slice(-30);

    // Sources / devices / regions from meta JSON
    const srcMap = {}, devMap = {}, regMap = {};
    rows.forEach(r => {
      try {
        const m = r.meta ? JSON.parse(r.meta) : {};
        if (m.source) srcMap[m.source] = (srcMap[m.source] || 0) + 1;
        if (m.device) devMap[m.device] = (devMap[m.device] || 0) + 1;
        if (m.region) regMap[m.region] = (regMap[m.region] || 0) + 1;
      } catch {}
    });
    const toArr = (obj) => Object.entries(obj).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    res.json({
      summary: {
        totalUniqueVisitors: totalVisitors,
        totalPageViews: totalVisitors,
        ctaClicks,
        signupStarts,
        signupDone,
        conversionRate,
      },
      dailyStats,
      sources: toArr(srcMap),
      devices: toArr(devMap),
      regions: toArr(regMap),
      scrollDepth: [],
      sections: [],
    });
  } catch (err) {
    console.error("GET /api/analytics/launch error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ====================================================================
// PROGRESS
// ====================================================================

// POST /api/progress/update
app.post("/api/progress/update", requireAuth, async (req, res) => {
  try {
    const { labId, completed, score, xpEarned } = req.body;
    if (!labId) return res.status(400).json({ error: "labId required" });
    const progress = await prisma.userProgress.upsert({
      where: { userId_labId: { userId: req.user.id, labId } },
      create: { userId: req.user.id, labId, completed: Boolean(completed), score: score || 0 },
      update: { completed: Boolean(completed), score: score || 0 },
    });
    if (xpEarned) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { totalXp: { increment: xpEarned } },
      });
    }
    res.json(progress);
  } catch (err) {
    console.error("POST /api/progress/update error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// AI MENTOR
// ====================================================================

async function getCachedAI(key) {
  try {
    const hit = await prisma.aiCache.findUnique({ where: { key } });
    if (hit) { await prisma.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } }); return hit.reply; }
  } catch {}
  return null;
}
async function setCachedAI(key, prompt, reply, model, tokensUsed) {
  try {
    await prisma.aiCache.upsert({ where: { key }, create: { key, prompt, reply, model, tokensUsed }, update: { reply, hits: { increment: 1 } } });
  } catch {}
}

// POST /api/ai/help
app.post("/api/ai/help", requireAuth, aiLimiter, async (req, res) => {
  try {
    const { cmd, context, labId } = req.body;
    if (!cmd) return res.status(400).json({ error: "cmd required" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.aiMentorConsent) return res.status(403).json({ error: "AI Mentor consent required", requireConsent: true });

    const cacheKey = crypto.createHash("sha256").update(`help:${cmd}:${labId || ""}`).digest("hex");
    const cached = await getCachedAI(cacheKey);
    if (cached) return res.json({ hint: cached, cached: true });

    if (!anthropic) return res.json({ hint: "AI Mentor is not available right now. Try checking the man pages or documentation.", cached: false });

    const prompt = `You are a senior SRE mentor helping a student in a hands-on Linux lab.\n\nThe student typed: ${cmd}\n\nLab context: ${JSON.stringify(context || {})}\n\nGive a SHORT hint (2-3 sentences max) that guides them toward the solution WITHOUT giving the answer directly. Be specific about the command or concept they should investigate.`;
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const hint = msg.content[0].text;
    await setCachedAI(cacheKey, prompt, hint, "claude-haiku-4-5-20251001", msg.usage?.input_tokens || 0);
    res.json({ hint, cached: false });
  } catch (err) {
    console.error("POST /api/ai/help error:", err);
    res.status(500).json({ error: "AI Mentor unavailable" });
  }
});

// POST /api/ai/generate-challenge
app.post("/api/ai/generate-challenge", requireAuth, aiLimiter, async (req, res) => {
  try {
    const { topic, difficulty } = req.body;
    if (!anthropic) return res.status(503).json({ error: "AI not configured" });
    const prompt = `Generate a short Linux/SRE challenge for topic: ${topic || "general linux"}, difficulty: ${difficulty || "medium"}. Return JSON with: { title, description, hint, solution_approach }`;
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    try {
      res.json(JSON.parse(msg.content[0].text));
    } catch {
      res.json({ title: topic, description: msg.content[0].text, hint: "", solution_approach: "" });
    }
  } catch (err) {
    console.error("POST /api/ai/generate-challenge error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/ai/budget-status
app.get("/api/ai/budget-status", requireAuth, async (req, res) => {
  try {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg  = await prisma.aiCache.aggregate({ _sum: { tokensUsed: true }, _count: { id: true }, where: { createdAt: { gte: from } } });
    const totalTokens  = agg._sum.tokensUsed || 0;
    const totalQueries = agg._count.id || 0;
    const budget       = parseFloat(process.env.AI_MONTHLY_BUDGET_USD || "50");
    const costUsd      = totalTokens * 0.00000025;
    res.json({ totalTokens, totalQueries, costUsd: costUsd.toFixed(4), budget, percentUsed: ((costUsd / budget) * 100).toFixed(1) });
  } catch (err) {
    console.error("GET /api/ai/budget-status error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// CERTIFICATES
// ====================================================================

// POST /api/cert/generate
app.post("/api/cert/generate", requireAuth, async (req, res) => {
  try {
    const { labsCompleted } = req.body;
    const certId = uuidv4();
    const cert = await prisma.certificate.create({
      data: { certId, userId: req.user.id, labsCompleted: labsCompleted || 0 },
    });
    res.json({ certId: cert.certId, issuedAt: cert.issuedAt });
  } catch (err) {
    console.error("POST /api/cert/generate error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// COMMUNITY (feature requests + bug reports)
// ====================================================================

// GET /api/community/posts
app.get("/api/community/posts", async (req, res) => {
  try {
    const { type } = req.query;
    const where = type ? { type } : {};
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { votes: true } } },
    });
    res.json(posts);
  } catch (err) {
    console.error("GET /api/community/posts error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/community/posts
app.post("/api/community/posts", requireAuth, async (req, res) => {
  try {
    const { type, title, body, labId, severity } = req.body;
    if (!type || !title) return res.status(400).json({ error: "type and title required" });
    const post = await prisma.post.create({
      data: { type, title, body: body || "", labId: labId || null, severity: severity || null, userId: req.user.id },
    });
    res.json(post);
  } catch (err) {
    console.error("POST /api/community/posts error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/community/bugs (alias)
app.get("/api/community/bugs", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({ where: { type: "bug" }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// EARLY ACCESS / WAITLIST
// ====================================================================

const MAX_SEATS = 500;

// GET /api/early-access/seats
app.get("/api/early-access/seats", (req, res) => {
  try {
    if (!fs.existsSync(EARLY_ACCESS_FILE)) {
      fs.mkdirSync(path.dirname(EARLY_ACCESS_FILE), { recursive: true });
      fs.writeFileSync(EARLY_ACCESS_FILE, "[]");
    }

    let data = [];
    try {
      data = JSON.parse(fs.readFileSync(EARLY_ACCESS_FILE, "utf8"));
    } catch {
      data = [];
    }

    const total = MAX_SEATS;
    const taken = Array.isArray(data) ? data.length : 0;
    const remaining = Math.max(0, total - taken);

    return res.json({ total, taken, remaining });
  } catch (err) {
    console.error("GET /api/early-access/seats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/early-access/list — admin only, anonymized
app.get("/api/early-access/list", requireAdmin, async (req, res) => {
  try {
    const anonymize = (email) => {
      const [local, domain] = (email || "").split("@");
      return `${local.slice(0, 2)}***@${domain || "?"}`;
    };

    let rows = [];
    try {
      rows = await prisma.earlyAccessSignup.findMany({
        orderBy: { position: "asc" },
        select: { position: true, email: true, name: true, referralCount: true, createdAt: true },
      });
    } catch {}

    // Merge file fallback if Prisma empty
    if (rows.length === 0 && fs.existsSync(EARLY_ACCESS_FILE)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(EARLY_ACCESS_FILE, "utf8"));
        rows = fileData.map((r, i) => ({
          position: i + 1,
          email: r.email || "",
          name: r.name || null,
          referralCount: r.referralCount || 0,
          createdAt: r.createdAt || null,
        }));
      } catch {}
    }

    const data = rows.map(r => ({
      position: r.position,
      code: `EA-${String(r.position).padStart(4, "0")}`,
      email: anonymize(r.email),
      name: r.name ? r.name.slice(0, 1) + "***" : null,
      referrals: r.referralCount || 0,
      joinedAt: r.createdAt,
    }));

    res.json({ total: data.length, signups: data });
  } catch (err) {
    console.error("GET /api/early-access/list error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/early-access/signup
app.post("/api/early-access/signup", authLimiter, async (req, res) => {
  const { email, name, referredBy } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const emailLower = email.toLowerCase();
  const referralCode = crypto.randomBytes(4).toString("hex");

  // ── Helper: file-based fallback ──────────────────────────────────────
  function fileSignup() {
    try {
      if (!fs.existsSync(path.dirname(EARLY_ACCESS_FILE))) {
        fs.mkdirSync(path.dirname(EARLY_ACCESS_FILE), { recursive: true });
      }
      let fileData = [];
      if (fs.existsSync(EARLY_ACCESS_FILE)) {
        try { fileData = JSON.parse(fs.readFileSync(EARLY_ACCESS_FILE, "utf8")); } catch { fileData = []; }
      }
      if (fileData.length >= MAX_SEATS) return { error: "All seats claimed", status: 409 };
      const hit = fileData.find(e => e.email === emailLower);
      if (hit) return { existing: true, position: hit.position, referralCode: hit.referralCode || referralCode };
      const position = fileData.length + 1;
      const rc = crypto.randomBytes(4).toString("hex");
      fileData.push({ email: emailLower, name: name || null, position, referralCode: rc, referredBy: referredBy || null, createdAt: new Date().toISOString() });
      fs.writeFileSync(EARLY_ACCESS_FILE, JSON.stringify(fileData, null, 2));
      return { ok: true, position, referralCode: rc };
    } catch (fe) {
      console.error("file-signup error:", fe.message);
      return null;
    }
  }

  // ── Try Prisma first, fall back to file ──────────────────────────────
  try {
    const count = await prisma.earlyAccessSignup.count();
    if (count >= MAX_SEATS) return res.status(409).json({ error: "All seats claimed" });
    const position = count + 1;
    const existing = await prisma.earlyAccessSignup.findUnique({ where: { email: emailLower } });
    if (existing) return res.json({ existing: true, position: existing.position, referralCode: existing.referralCode });
    const signup = await prisma.earlyAccessSignup.create({
      data: { email: emailLower, name: name || null, accessDate: new Date("2026-04-20"), referralCode, referredBy: referredBy || null, position },
    });
    if (referredBy) {
      await prisma.earlyAccessSignup.updateMany({ where: { referralCode: referredBy }, data: { referralCount: { increment: 1 } } }).catch(() => {});
    }
    // keep file in sync
    try {
      let fd = [];
      if (fs.existsSync(EARLY_ACCESS_FILE)) { try { fd = JSON.parse(fs.readFileSync(EARLY_ACCESS_FILE, "utf8")); } catch { fd = []; } }
      if (!fd.some(e => e.email === emailLower)) { fd.push({ email: emailLower, position, referralCode, createdAt: new Date().toISOString() }); fs.writeFileSync(EARLY_ACCESS_FILE, JSON.stringify(fd, null, 2)); }
    } catch {}
    return res.json({ ok: true, position: signup.position, referralCode: signup.referralCode });
  } catch (err) {
    console.warn("Prisma signup failed, using file fallback:", err.message);
    const result = fileSignup();
    if (!result) return res.status(500).json({ error: "Signup service temporarily unavailable. Please retry." });
    if (result.status) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  }
});

// ====================================================================
// PRICING
// ====================================================================

// GET /api/pricing
app.get("/api/pricing", (req, res) => {
  res.json({
    launchTierActive: false,
    plans: [
      {
        id: "early", name: "Early Access", price: 5, currency: "usd", interval: "month",
        badge: "72H Launch",
        features: ["All 100+ Linux labs", "Unlimited AI Mentor", "Verifiable certificate", "Daily challenges", "Cancel anytime", "Price locked for life"],
      },
      {
        id: "pro", name: "Pro Individual", price: 19, currency: "usd", interval: "month",
        badge: "After launch",
        features: ["All 100+ Linux labs", "Jamf + Networking tracks", "Unlimited AI Mentor", "Verifiable certificate", "Daily challenges", "Cancel anytime"],
      },
      {
        id: "business", name: "Business Team", price: 199, currency: "usd", interval: "month",
        badge: "5 seats",
        features: ["Everything in Pro", "5 team seats included", "SSO (Azure AD / Okta)", "Admin dashboard", "Team leaderboard", "Skill gap analytics"],
      },
    ],
  });
});

// ====================================================================
// STRIPE
// ====================================================================

// POST /api/stripe/subscribe
app.post("/api/stripe/subscribe", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const { priceId, successUrl, cancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId required" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: decryptField(user.email) || user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=success`,
      cancel_url:  cancelUrl  || `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=cancel`,
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("POST /api/stripe/subscribe error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/billing/checkout — called by PricingTable with { plan: "early"|"pro"|"business" }
app.post("/api/billing/checkout", authLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const { plan } = req.body;
    const priceMap = {
      early:    process.env.STRIPE_PRICE_EARLY    || process.env.STRIPE_EARLY_PRICE_ID,
      pro:      process.env.STRIPE_PRICE_PRO      || process.env.STRIPE_PRO_PRICE_ID,
      business: process.env.STRIPE_PRICE_BUSINESS || process.env.STRIPE_BUSINESS_PRICE_ID,
    };
    const priceId = priceMap[plan];
    if (!priceId) return res.status(400).json({ error: `No Stripe price configured for plan: ${plan}` });

    const sessionParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=cancel`,
    };

    // Attach customer if user is logged in
    const token = req.cookies?.winlab_token || req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (user) {
          let customerId = user.stripeCustomerId;
          if (!customerId) {
            const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
            customerId = customer.id;
            await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
          }
          sessionParams.customer = customerId;
        }
      } catch {}
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    console.error("POST /api/billing/checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/checkout (alias for early access)
app.post("/api/checkout", authLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const { email, priceId } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: "subscription",
      line_items: [{ price: priceId || process.env.STRIPE_EARLY_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.APP_URL || "https://winlab.cloud"}/?checkout=cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("POST /api/checkout error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/stripe/subscription
app.get("/api/stripe/subscription", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan,
      periodEnd: user.subscriptionPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      trialEndsAt: user.trialEndsAt,
    });
  } catch (err) {
    console.error("GET /api/stripe/subscription error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/portal
app.post("/api/stripe/portal", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.stripeCustomerId) return res.status(400).json({ error: "No billing account found" });
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: process.env.APP_URL || "https://winlab.cloud",
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("POST /api/stripe/portal error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/cancel
app.post("/api/stripe/cancel", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.stripeSubscriptionId) return res.status(400).json({ error: "No active subscription" });
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
    await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/stripe/cancel error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/resume
app.post("/api/stripe/resume", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.stripeSubscriptionId) return res.status(400).json({ error: "No subscription" });
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
    await prisma.user.update({ where: { id: user.id }, data: { cancelAtPeriodEnd: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/stripe/resume error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/update-subscription
app.post("/api/stripe/update-subscription", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const { priceId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.stripeSubscriptionId) return res.status(400).json({ error: "No subscription" });
    const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: "create_prorations",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/stripe/update-subscription error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/stripe/payments
app.get("/api/stripe/payments", requireAuth, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json(payments);
  } catch (err) {
    console.error("GET /api/stripe/payments error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/pay-per-incident
app.post("/api/stripe/pay-per-incident", requireAuth, paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: "Payments not configured" });
    const { scenarioId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: decryptField(user.email) || user.email });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price_data: { currency: "usd", product_data: { name: `WinLab Incident: ${scenarioId || "Enterprise"}` }, unit_amount: 499 }, quantity: 1 }],
      success_url: `${process.env.APP_URL || "https://winlab.cloud"}/?incident=success`,
      cancel_url:  `${process.env.APP_URL || "https://winlab.cloud"}/?incident=cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("POST /api/stripe/pay-per-incident error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/stripe/webhook
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.sendStatus(200);
    const sig    = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Deduplication
    const existing = await prisma.processedWebhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) return res.sendStatus(200);
    await prisma.processedWebhookEvent.create({ data: { eventId: event.id, eventType: event.type } });

    const obj = event.data.object;

    if (event.type === "checkout.session.completed") {
      const customerId = obj.customer;
      const subId      = obj.subscription;
      if (customerId) {
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subId,
              subscriptionStatus: sub.status,
              subscriptionPlan: "pro",
              subscriptionPeriodEnd: new Date(sub.current_period_end * 1000),
              plan: JSON.stringify({ tier: "pro" }),
            },
          });
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const user = await prisma.user.findFirst({ where: { stripeSubscriptionId: obj.id } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: obj.status,
            subscriptionPeriodEnd: new Date(obj.current_period_end * 1000),
            cancelAtPeriodEnd: obj.cancel_at_period_end,
          },
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("POST /api/stripe/webhook error:", err);
    res.sendStatus(200);
  }
});

// ====================================================================
// REFERRALS
// ====================================================================

// POST /api/referral/generate-peer
app.post("/api/referral/generate-peer", requireAuth, async (req, res) => {
  try {
    const token = crypto.randomBytes(8).toString("hex");
    const ref = await prisma.referral.create({
      data: { referrerId: req.user.id, refereeEmail: "", token, type: "peer", discount: 20 },
    });
    res.json({ token: ref.token, discount: ref.discount, url: `${process.env.APP_URL || "https://winlab.cloud"}/?ref=${ref.token}` });
  } catch (err) {
    console.error("POST /api/referral/generate-peer error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/referral/generate-corporate
app.post("/api/referral/generate-corporate", requireAuth, async (req, res) => {
  try {
    const { refereeEmail } = req.body;
    const token = crypto.randomBytes(8).toString("hex");
    const ref = await prisma.referral.create({
      data: { referrerId: req.user.id, refereeEmail: refereeEmail || "", token, type: "corporate", discount: 30 },
    });
    res.json({ token: ref.token, discount: ref.discount });
  } catch (err) {
    console.error("POST /api/referral/generate-corporate error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/referral/stats
app.get("/api/referral/stats", requireAuth, async (req, res) => {
  try {
    const refs = await prisma.referral.findMany({ where: { referrerId: req.user.id } });
    res.json({ total: refs.length, converted: refs.filter(r => r.converted).length, active: refs.filter(r => r.active).length });
  } catch (err) {
    console.error("GET /api/referral/stats error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// BLOG
// ====================================================================

// GET /api/blog/all
app.get("/api/blog/all", async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true, title: true, slug: true, excerpt: true, tags: true, publishedAt: true, createdAt: true },
    });
    res.json(posts);
  } catch (err) {
    console.error("GET /api/blog/all error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/blog/:slug
app.get("/api/blog/:slug", async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || post.status !== "published") return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (err) {
    console.error("GET /api/blog/:slug error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// LEADERBOARD
// ====================================================================

// POST /api/leaderboard
app.post("/api/leaderboard", express.json(), async (req, res) => {
  try {
    const { teamName, region, scenarioId, scenarioName, leaderboardScore, riskScore, businessImpact, elapsedMin, actionCount } = req.body;
    if (!scenarioId || !scenarioName || leaderboardScore == null) {
      return res.status(400).json({ error: "scenarioId, scenarioName and leaderboardScore are required" });
    }
    let userId = null;
    try {
      const token = (req.headers.authorization || "").split(" ")[1];
      if (token) userId = jwt.verify(token, JWT_SECRET)?.id || null;
    } catch {}
    const result = await prisma.scenarioResult.create({
      data: {
        userId,
        teamName: teamName || "Anonymous",
        region: region || "EU",
        scenarioId,
        scenarioName,
        leaderboardScore: Math.round(leaderboardScore),
        riskScore: Math.round(riskScore || 0),
        businessImpact: Math.round(businessImpact || 0),
        elapsedMin: Math.round(elapsedMin || 1),
        actionCount: Math.round(actionCount || 0),
      },
    });
    broadcastLeaderboard(scenarioId).catch(() => {});
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("POST /api/leaderboard error:", err);
    res.status(500).json({ error: "Failed to save result" });
  }
});

// GET /api/leaderboard
app.get("/api/leaderboard", async (req, res) => {
  try {
    const { scenarioId, limit = "10" } = req.query;
    const where = scenarioId ? { scenarioId } : {};
    const rows = await prisma.scenarioResult.findMany({
      where,
      orderBy: { leaderboardScore: "desc" },
      take: Math.min(parseInt(limit, 10) || 10, 50),
      select: { teamName: true, region: true, scenarioName: true, leaderboardScore: true, createdAt: true },
    });
    res.json(rows);
  } catch (err) {
    console.error("GET /api/leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ====================================================================
// SESSION REPLAY
// ====================================================================

// POST /api/replay/event
app.post("/api/replay/event", express.json(), async (req, res) => {
  try {
    const { sessionId, labId, cmd, output } = req.body;
    if (!sessionId || !cmd) return res.status(400).json({ error: "sessionId and cmd required" });
    let userId = null;
    try {
      const token = (req.headers.authorization || "").split(" ")[1];
      if (token) userId = jwt.verify(token, JWT_SECRET)?.id || null;
    } catch {}
    await prisma.sessionEvent.create({ data: { sessionId, userId, labId: labId || null, cmd, output: output || "" } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/replay/event error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/replay/:sessionId
app.get("/api/replay/:sessionId", async (req, res) => {
  try {
    const events = await prisma.sessionEvent.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { ts: "asc" },
    });
    res.json(events);
  } catch (err) {
    console.error("GET /api/replay/:sessionId error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/replay (list sessions)
app.get("/api/replay", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.isAdmin;
    const where   = isAdmin ? {} : { userId: req.user.id };
    const sessions = await prisma.sessionEvent.groupBy({
      by: ["sessionId", "labId", "userId"],
      where,
      _count: { cmd: true },
      _min: { ts: true },
      _max: { ts: true },
      orderBy: { _max: { ts: "desc" } },
      take: 50,
    });
    res.json(sessions);
  } catch (err) {
    console.error("GET /api/replay error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// B2B LEADS
// ====================================================================

// POST /api/b2b/lead
app.post("/api/b2b/lead", async (req, res) => {
  try {
    const { firstName, lastName, email, company, teamSize, message, source } = req.body;
    if (!firstName || !lastName || !email || !company) {
      return res.status(400).json({ error: "firstName, lastName, email, company required" });
    }
    const tenantDomain = email.includes("@") ? email.split("@")[1].toLowerCase() : null;
    const lead = await prisma.b2bLead.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        company,
        teamSize: teamSize || "1-5",
        message: message || null,
        source: source || "website",
        tenantDomain,
      },
    });
    res.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("POST /api/b2b/lead error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/b2b/leads (admin only)
app.get("/api/b2b/leads", requireAdmin, async (req, res) => {
  try {
    const leads = await prisma.b2bLead.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json(leads);
  } catch (err) {
    console.error("GET /api/b2b/leads error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/b2b/leads/:id (admin only)
app.patch("/api/b2b/leads/:id", requireAdmin, async (req, res) => {
  try {
    const { status, notes, assignedTo } = req.body;
    const data = {};
    if (status)     data.status     = status;
    if (notes)      data.notes      = notes;
    if (assignedTo) data.assignedTo = assignedTo;
    const lead = await prisma.b2bLead.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (err) {
    console.error("PATCH /api/b2b/leads/:id error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// ENTERPRISE
// ====================================================================

// GET /api/enterprise/verify-domain
app.get("/api/enterprise/verify-domain", requireAuth, async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: "domain required" });
    const users = await prisma.user.count({ where: { tenantDomain: domain } });
    const leads = await prisma.b2bLead.count({ where: { tenantDomain: domain } });
    res.json({ domain, userCount: users, leadCount: leads, recognized: users > 0 || leads > 0 });
  } catch (err) {
    console.error("GET /api/enterprise/verify-domain error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/enterprise/stats (admin only)
app.get("/api/enterprise/stats", requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalLeads, totalResults, totalSignups] = await Promise.all([
      prisma.user.count(),
      prisma.b2bLead.count(),
      prisma.scenarioResult.count(),
      prisma.earlyAccessSignup.count(),
    ]);
    res.json({ totalUsers, totalLeads, totalResults, totalSignups });
  } catch (err) {
    console.error("GET /api/enterprise/stats error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ====================================================================
// ADMIN
// ====================================================================

// GET /api/admin/users
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { accountStatus: "active" },
      select: { id: true, plan: true, createdAt: true, totalXp: true, currentStreak: true, subscriptionStatus: true, isAdmin: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const anonymised = users.map((u, i) => ({ ...u, code: `USR-${String(i + 1).padStart(4, "0")}` }));
    res.json(anonymised);
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/admin/feedback-summary
app.get("/api/admin/feedback-summary", requireAdmin, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    const bugs     = posts.filter(p => p.type === "bug");
    const features = posts.filter(p => p.type === "feature");
    res.json({ total: posts.length, bugs: bugs.length, features: features.length, recent: posts.slice(0, 10) });
  } catch (err) {
    console.error("GET /api/admin/feedback-summary error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/admin/purge-cache
app.post("/api/admin/purge-cache", requireAdmin, async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;
    const cutoff = new Date(Date.now() - olderThanDays * 86400_000);
    const result = await prisma.aiCache.deleteMany({ where: { createdAt: { lt: cutoff } } });
    res.json({ ok: true, deleted: result.count });
  } catch (err) {
    console.error("POST /api/admin/purge-cache error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/blog (admin: create/update post)
app.post("/api/blog", requireAdmin, async (req, res) => {
  try {
    const { title, slug, excerpt, content, tags, status } = req.body;
    if (!title || !slug || !content) return res.status(400).json({ error: "title, slug, content required" });
    const post = await prisma.blogPost.upsert({
      where: { slug },
      create: { title, slug, excerpt: excerpt || null, content, tags: tags ? JSON.stringify(tags) : null, status: status || "draft", publishedAt: status === "published" ? new Date() : null },
      update: { title, excerpt: excerpt || null, content, tags: tags ? JSON.stringify(tags) : null, status: status || "draft", publishedAt: status === "published" ? new Date() : null },
    });
    res.json(post);
  } catch (err) {
    console.error("POST /api/blog error:", err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/deception/sessions (dev/demo analytics)
app.get("/api/deception/sessions", requireAdmin, async (req, res) => {
  try {
    const sessions = await prisma.sessionEvent.groupBy({
      by: ["sessionId"],
      _count: { cmd: true },
      _min: { ts: true },
      _max: { ts: true },
      orderBy: { _max: { ts: "desc" } },
      take: 50,
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/deception/stats
app.get("/api/deception/stats", requireAdmin, async (req, res) => {
  try {
    const [total, last24h] = await Promise.all([
      prisma.sessionEvent.count(),
      prisma.sessionEvent.count({ where: { ts: { gte: new Date(Date.now() - 86400_000) } } }),
    ]);
    res.json({ total, last24h });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/vhs/videos (placeholder)
app.get("/api/vhs/videos", requireAdmin, (req, res) => res.json([]));
// POST /api/vhs/schedule (placeholder)
app.post("/api/vhs/schedule", requireAdmin, (req, res) => res.json({ ok: true }));

// ====================================================================
// DRIP EMAIL SCHEDULER
// ====================================================================
async function sendDripEmails() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000);
    const users = await prisma.user.findMany({
      where: { createdAt: { lt: sevenDaysAgo }, accountStatus: "active", subscriptionStatus: "none" },
      take: 50,
    });
    for (const user of users) {
      const email = decryptField(user.email) || user.email;
      if (email && email.includes("@")) {
        // Drip email logic — extend as needed
      }
    }
  } catch (err) {
    console.error("[Drip] Scheduler error:", err.message);
  }
}
// setTimeout(sendDripEmails, 5_000);
// setInterval(sendDripEmails, 60 * 60 * 1_000);

// ── Demo page ─────────────────────────────────────────────────────────
app.get("/demo", (req, res) => {
  const demoPage = path.join(__dirname, "coming-soon", "demo.html");
  if (existsSync(demoPage)) {
    res.sendFile(demoPage);
  } else {
    res.redirect("/");
  }
});

// ── Funnel landing page ───────────────────────────────────────────────
app.get("/funnel", (req, res) => {
  const funnelPage = path.join(__dirname, "coming-soon", "funnel.html");
  if (existsSync(funnelPage)) {
    res.sendFile(funnelPage);
  } else {
    res.redirect("/");
  }
});

// ── Enterprise landing page ───────────────────────────────────────────
app.get("/enterprise", (req, res) => {
  const enterprisePage = path.join(__dirname, "coming-soon", "enterprise-landing.html");
  if (existsSync(enterprisePage)) {
    res.sendFile(enterprisePage);
  } else {
    res.redirect("/");
  }
});

// ── Test homepage (new conversion page) ──────────────────────────────
app.get("/test", (req, res) => {
  const testPage = path.join(__dirname, "coming-soon", "test.html");
  if (existsSync(testPage)) {
    res.sendFile(testPage);
  } else {
    res.redirect("/");
  }
});

// ── Homepage → coming-soon/funnel.html ───────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "coming-soon", "funnel.html"));
});

// ── SPA fallback ─────────────────────────────────────────────────────
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api/")) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ====================================================================
// START SERVER + WEBSOCKET
// ====================================================================

const server = app.listen(BASE_PORT, () => {
  console.log(`🚀 WINLAB v7 running on :${BASE_PORT}`);
  startMeteringFlush(prisma);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallback = BASE_PORT + 1;
    console.warn(`⚠️  Port ${BASE_PORT} in use, trying :${fallback}`);
    app.listen(fallback, () => console.log(`🚀 WINLAB v7 running on :${fallback}`));
  } else {
    throw err;
  }
});

// WebSocket server — same port, path /ws/leaderboard
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws/leaderboard")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  const scenarioId = new URL(req.url, "http://x").searchParams.get("scenarioId");
  ws.scenarioId = scenarioId || null;
  ws.isAlive    = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

// Heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

async function broadcastLeaderboard(scenarioId) {
  const rows = await prisma.scenarioResult.findMany({
    where: scenarioId ? { scenarioId } : {},
    orderBy: { leaderboardScore: "desc" },
    take: 10,
    select: { teamName: true, region: true, scenarioName: true, leaderboardScore: true, createdAt: true },
  });
  const msg = JSON.stringify({ type: "leaderboard", scenarioId, rows });
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && (!ws.scenarioId || ws.scenarioId === scenarioId)) {
      ws.send(msg);
    }
  });
}
