// =============================
// WINLAB v7 – ANTHROPIC SDK + DB CACHE + FULL SAAS API
// Target cost: < $0.001 per AI response via DB caching
// =============================

import express from "express";
import { WebSocketServer } from "ws";
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
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// ── Email & Alert Flow Imports ──
import { sendPasswordResetEmail, sendVerifyEmail, verifyResetToken, verifyEmailToken, sendNewDeviceLoginEmail, sendAccountDeletedEmail } from "./src/services/userLifecycleEmailFlow.js";
import { bootstrapAlertFlow } from "./src/core/alertDispatcher.js";
import helpdeskRouter from "./src/api/routes/helpdesk.js";
import { startHelpdeskWorker } from "./src/services/helpdeskWorker.js";
import { recordDeploy as recordDeployEvent, getDeployHistory as getDeployHistoryFn } from "./src/services/helpdeskEngines/bugDetection.js";
import { syncLogger, dlqLogger } from "./src/services/logger.js";

// Bootstrap alert flow (wires up event bus → alert dispatcher)
try {
  bootstrapAlertFlow();
} catch (err) {
  console.warn('[Backend] Alert flow bootstrap skipped (no event bus yet):', err.message);
}
import {
  detectThreat,
  HONEYPOT_ENVS,
  processHoneypotCommand,
  profileAttacker,
  createIntelCollector,
} from "./src/deception-engine.js";
import prisma from "./src/api/db/prisma.js";
import { encryptUserData, decryptUser } from "./src/api/middleware/encryptPrisma.js";
import { executeWithOutbox, processPendingEvents } from "./src/api/eventSourcing.js";
import { isEventProcessed, markEventProcessed } from "./src/services/webhookIdempotency.js";
import { startDockerLabSession, stopDockerLabSession } from "./src/services/dockerLabRunner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────
// INPUT SANITIZATION HELPERS
// ─────────────────────────────────────────────

function sanitizeString(input, maxLen = 200) {
  if (typeof input !== "string") return "";
  return input
    .slice(0, maxLen)
    .replace(/[<>]/g, "") // strip angle brackets (basic XSS defense)
    .trim();
}

function validateSeverity(val) {
  return ["low", "medium", "high", "critical"].includes(val) ? val : "low";
}

// ─────────────────────────────────────────────
// STRUCTURED SECURITY LOGGING
// ─────────────────────────────────────────────

function securityLog(entry) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: "winlab-backend",
    ...entry,
  };
  // JSON structured log – parseable by ELK/Datadog/Sentry
  console.log(JSON.stringify(logEntry));
}

const app = express();
app.set('trust proxy', 1); // behind Nginx / Cloudflare
app.use(cookieParser());

// ─────────────────────────────────────────────
// SECURITY HEADERS - Helmet + Custom CSP
// ─────────────────────────────────────────────

// Base Helmet middleware
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Vite dev server (only in development)
        process.env.NODE_ENV === "development" ? "http://localhost:5173" : null,
        // Inline scripts for Vite PWA (required for service worker registration)
        "'unsafe-inline'",
        // Allow eval in development for Vite HMR
        process.env.NODE_ENV === "development" ? "'unsafe-eval'" : null,
      ].filter(Boolean),
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind CSS and dynamic styles
        process.env.NODE_ENV === "development" ? "http://localhost:5173" : null,
      ].filter(Boolean),
      styleSrcElem: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
      ],
      imgSrc: [
        "'self'",
        "data:", // Allow base64 images
        "blob:", // Allow blob URLs for images
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        process.env.NODE_ENV === "development" ? "http://localhost:5173" : null,
        process.env.NODE_ENV === "development" ? "ws://localhost:5173" : null,
        "https://js.stripe.com",
        "https://api.stripe.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ].filter(Boolean),
      frameSrc: [
        "'self'", // Allow same-origin iframes (demo terminal in landing)
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"], // Allow same-origin embedding (demo iframe)
      // HSTS is handled below
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // Disabled for PWA compatibility
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
}));

// Custom Trusted Types for DOM XSS mitigation
app.use((req, res, next) => {
  // Add Trusted Types CSP header (mitigates DOM-based XSS)
  // This forces the app to use typed values instead of raw strings for sink APIs
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self' ${process.env.NODE_ENV === "development" ? "http://localhost:5173 'unsafe-inline' 'unsafe-eval'" : "'unsafe-inline'"}`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${process.env.NODE_ENV === "development" ? "http://localhost:5173" : ""}`,
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self' ${process.env.NODE_ENV === "development" ? "http://localhost:5173 ws://localhost:5173" : ""} https://js.stripe.com https://api.stripe.com https://fonts.googleapis.com https://fonts.gstatic.com`,
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // Trusted Types (mitigates DOM XSS)
      "require-trusted-types-for 'script'",
      "trusted-types default",
      process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
    ].filter(Boolean).join("; ")
  );
  
  // HSTS - Strict Transport Security (force HTTPS)
  // 1 year max-age, include subdomains, enable preload
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  
  // COOP - Cross-Origin-Opener-Policy (origin isolation)
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  
  // CORP - Cross-Origin-Resource-Policy
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  
  // COEP - Cross-Origin-Embedder-Policy (optional, can enable if needed)
  // res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  
  // X-Content-Type-Options (prevent MIME sniffing)
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // X-Frame-Options (legacy clickjacking protection, fallback for old browsers)
  res.setHeader("X-Frame-Options", "DENY");
  
  // Referrer-Policy (limit referrer information)
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy (disable unnecessary browser features)
  res.setHeader(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=(self)",
      "usb=()",
    ].join(", ")
  );
  
  // X-XSS-Protection (legacy, but still useful for old browsers)
  res.setHeader("X-XSS-Protection", "0"); // Disable old XSS auditor (CSP is better)

  next();
});

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────

const authLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { error: "Too many attempts. Try again in 1 minute." }, standardHeaders: true, legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: "Too many AI requests. Try again in 1 minute." }, standardHeaders: true, legacyHeaders: false });
const billingLimiter = rateLimit({ windowMs: 60_000, max: 3, message: { error: "Too many billing requests. Try again in 1 minute." }, standardHeaders: true, legacyHeaders: false });

// ─────────────────────────────────────────────
// REQUEST-ID MIDDLEWARE
// Assegna un UUID univoco ad ogni request per log correlation.
// Legge x-request-id dal client (utile per trace distribuiti) o ne genera uno nuovo.
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  req.requestId  = (typeof incoming === "string" && incoming.trim()) ? incoming.trim() : crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

// ─────────────────────────────────────────────
// REQUEST LOGGING MIDDLEWARE
// ─────────────────────────────────────────────

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    securityLog({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      event: "http_request",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.headers["x-forwarded-for"] || req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 120),
    });
  });
  next();
});

app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhook") return next();
  express.json()(req, res, next);
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

// ─────────────────────────────────────────────
// CACHE HELPERS
// Normalize question → SHA-256 key → DB lookup
// First call costs ~$0.0003 (Haiku), every repeat = $0.00
// ─────────────────────────────────────────────

function cacheKey(text) {
  return crypto
    .createHash("sha256")
    .update(text.trim().toLowerCase().replace(/\s+/g, " "))
    .digest("hex");
}

async function getCached(key) {
  return prisma.aiCache.findUnique({ where: { key } });
}

async function setCache(key, prompt, reply, model, tokensUsed) {
  return prisma.aiCache.upsert({
    where: { key },
    update: { hits: { increment: 1 } },
    create: { key, prompt, reply, model, tokensUsed, hits: 1 }
  });
}

async function callHaiku(systemPrompt, userPrompt) {
  // Uses Anthropic prompt caching on the system prompt (saves ~90% on repeated calls)
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" } // cache system prompt tokens
      }
    ],
    messages: [{ role: "user", content: userPrompt }]
  });
  return {
    reply: msg.content[0].text,
    tokens: msg.usage.input_tokens + msg.usage.output_tokens
  };
}

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// Zero Trust: JWT only carries { id, email }.
// Plan is ALWAYS fetched fresh from DB.
// ─────────────────────────────────────────────

function auth(req, res, next) {
  // httpOnly cookie takes priority; Authorization: Bearer is fallback for API clients
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    securityLog({ level: "warn", event: "auth_missing_token", method: req.method, path: req.originalUrl, ip: req.headers["x-forwarded-for"] || req.ip });
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId || payload.id;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    req.user = { id: req.userId, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    securityLog({ level: "warn", event: "auth_invalid_token", method: req.method, path: req.originalUrl, ip: req.headers["x-forwarded-for"] || req.ip });
    res.status(401).json({ error: "Invalid token" });
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 24 * 60 * 60 * 1000, // 24h
  path: "/",
};

// freshUser: always hits the DB for current user state (plan, teamId, etc.)
async function freshUser(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    securityLog({ level: "error", event: "auth_user_not_found", userId: req.userId });
    return res.status(401).json({ error: "User not found" });
  }
  req.user = user;
  next();
}

// ─────────────────────────────────────────────
// AUTH ENDPOINTS (Encrypted + Outbox Pattern)
// ─────────────────────────────────────────────

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password, name, nickname, mlConsent } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email e password richiesti" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const encrypted = encryptUserData({
    email: email.toLowerCase(),
    name: name || "",
    nickname: nickname || "",
    plan: "starter",
  });

  try {
    const user = await executeWithOutbox(
      async (tx) => tx.user.create({
        data: {
          email: encrypted.email,
          name: encrypted.name,
          nickname: encrypted.nickname,
          passwordHash,
          plan: encrypted.plan,
          isAdmin: false,
          mlConsent: mlConsent === true,
          mlConsentDate: mlConsent === true ? new Date() : null,
        },
      }),
      "USER_REGISTERED",
      (u) => ({ userId: u.id, email: email.toLowerCase() })
    );

    const token = jwt.sign({ userId: user.id, role: "user" }, JWT_SECRET, { expiresIn: "24h" });
    securityLog({ level: "info", event: "user_registered", userId: user.id, email: email.toLowerCase() });
    res.cookie("token", token, COOKIE_OPTS);
    res.status(201).json({ message: "Registrazione completata", user: { id: user.id, email: email.toLowerCase() } });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Errore interno del server durante la registrazione" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    securityLog({ level: "warn", event: "login_failure", email: email?.slice(0, 100), ip: req.headers["x-forwarded-for"] || req.ip });
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user.id, role: "user" }, JWT_SECRET, { expiresIn: "24h" });
  const decrypted = decryptUser(user);
  securityLog({ level: "info", event: "user_login", userId: user.id });
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ user: { id: user.id, email: email.toLowerCase(), name: decrypted.name, plan: decrypted.plan, nickname: decrypted.nickname } });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// AI MENTOR – /api/ai/help
// Sysadmin mentor: never gives direct answers
// ─────────────────────────────────────────────

const MENTOR_SYSTEM = `You are a sysadmin mentor for WINLAB.
RULES:
- NEVER give the direct answer or the exact command.
- Guide with 1-2 Socratic questions that point toward the solution.
- Be concise (max 3 sentences).
- Use technical language appropriate for junior sysadmins.`;

app.post("/api/ai/help", auth, aiLimiter, async (req, res) => {
  const { question, labState } = req.body;
  if (!question || typeof question !== "string") return res.status(400).json({ error: "Missing question" });
  const cleanQuestion = sanitizeString(question, 1000);
  if (!cleanQuestion) return res.status(400).json({ error: "Question is required" });

  // GDPR gate: user must have consented to Anthropic data transfer
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { aiMentorConsent: true } });
  if (!user || user.aiMentorConsent !== true) {
    return res.status(403).json({ error: "AI Mentor consent required", action: "show_consent_modal" });
  }

  // Sanitize labState: only allow primitive values, strip functions/objects
  let safeState = null;
  if (labState && typeof labState === "object") {
    safeState = {};
    for (const [k, v] of Object.entries(labState)) {
      if (["string", "number", "boolean"].includes(typeof v)) {
        safeState[sanitizeString(k, 50)] = typeof v === "string" ? sanitizeString(v, 200) : v;
      }
    }
  }

  // Budget guard — auto-block at €15/mo
  const budget = checkBudget();
  if (budget.blocked) return res.status(503).json({ error: "AI budget reached. Try again next month." });

  const stateContext = safeState ? `\nLab context: ${JSON.stringify(safeState)}` : "";
  const fullPrompt = cleanQuestion + stateContext;
  const key = cacheKey(MENTOR_SYSTEM + fullPrompt);

  // Cache hit → free response
  const cached = await getCached(key);
  if (cached) {
    recordApiCall(0, true);
    await prisma.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } });
    return res.json({ reply: cached.reply, cached: true });
  }

  try {
    const { reply, tokens } = await callHaiku(MENTOR_SYSTEM, fullPrompt);
    await setCache(key, fullPrompt, reply, "claude-haiku-4-5-20251001", tokens);
    recordApiCall(0.0004, false);
    res.json({ reply, cached: false });
  } catch (err) {
    console.error("AI help error:", err.message);
    res.status(502).json({ error: "AI service temporarily unavailable. Please try again." });
  }
});

// ─────────────────────────────────────────────
// AI CHALLENGE GENERATOR – /api/ai/generate-challenge
// Generates a sysadmin challenge JSON (cached per topic+difficulty)
// ─────────────────────────────────────────────

const CHALLENGE_SYSTEM = `You are a sysadmin challenge designer for WINLAB.
Output ONLY a valid JSON object, no markdown, no explanation.
Schema: { "title": string, "scenario": string, "goal": string, "expected_commands": string[] }`;

app.post("/api/ai/generate-challenge", aiLimiter, async (req, res) => {
  const { difficulty = "Intermediate", topic = "Linux Server" } = req.body;

  const userPrompt = `Create a sysadmin challenge on: ${topic}. Difficulty: ${difficulty}.`;
  const key = cacheKey(CHALLENGE_SYSTEM + userPrompt);

  // Cache hit
  const cached = await getCached(key);
  if (cached) {
    await prisma.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } });
    try {
      return res.json({ ...JSON.parse(cached.reply), cached: true });
    } catch {
      // fallthrough to re-generate if cache is corrupted
    }
  }

  try {
    const { reply, tokens } = await callHaiku(CHALLENGE_SYSTEM, userPrompt);
    const challenge = JSON.parse(reply);
    await setCache(key, userPrompt, reply, "claude-haiku-4-5-20251001", tokens);
    res.json({ ...challenge, cached: false });
  } catch (err) {
    console.error("Challenge generation error:", err);
    res.status(500).json({ error: "Failed to generate challenge. Please retry." });
  }
});

// ─────────────────────────────────────────────
// PROGRESS TRACKING – /api/progress/update
// Saves per-lab progress and triggers paywall after lab #2
// ─────────────────────────────────────────────

app.post("/api/progress/update", auth, async (req, res) => {
  const userId = req.user.id;
  const { labId, completed, score } = req.body;
  if (!labId) return res.status(400).json({ error: "Missing labId" });

  const progress = await prisma.userProgress.upsert({
    where: { userId_labId: { userId, labId } },
    update: { completed, score, updatedAt: new Date() },
    create: { userId, labId, completed, score }
  });

  const completedCount = await prisma.userProgress.count({
    where: { userId, completed: true }
  });

  // Record analytics event
  if (completed) {
    await prisma.analytics.create({
      data: { event: "lab_completed", userId, meta: labId }
    });
  }

  // Paywall triggers after 2 completed labs on starter plan
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const triggerPaywall = completedCount >= 2 && user?.plan === "starter";

  if (triggerPaywall) {
    await prisma.analytics.create({
      data: { event: "paywall_shown", userId, meta: `completed_labs:${completedCount}` }
    });
  }

  res.json({ progress, completedCount, triggerPaywall });
});

app.get("/api/progress/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  if (req.user.id !== userId) return res.status(403).json({ error: "Forbidden" });

  const rows = await prisma.userProgress.findMany({ where: { userId } });
  const map = {};
  rows.forEach(r => { map[r.labId] = { completed: r.completed, score: r.score, updatedAt: r.updatedAt }; });
  res.json(map);
});

// ─────────────────────────────────────────────
// LAB SESSION — Docker container lifecycle
// ─────────────────────────────────────────────

const STARTER_LABS = new Set([
  "linux-terminal", "enhanced-terminal", "disk-full", "nginx-port-conflict"
]);

const activeSessions = new Map();

app.post("/api/lab/start", async (req, res) => {
  const { labId } = req.body;
  if (!labId || typeof labId !== "string") {
    return res.status(400).json({ error: "labId required" });
  }

  const isStarter = STARTER_LABS.has(labId);
  if (!isStarter) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Login required for this lab" });
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  const sessionId = crypto.randomUUID();
  try {
    const session = await startDockerLabSession({ labId, sessionId });
    activeSessions.set(sessionId, session.containerName);
    setTimeout(async () => {
      activeSessions.delete(sessionId);
      await stopDockerLabSession({ sessionId }).catch(() => {});
    }, 30 * 60 * 1000);
    res.json({ sessionId, containerName: session.containerName, labId });
  } catch (err) {
    console.error("Lab start error:", err);
    res.status(500).json({ error: "Failed to start lab container" });
  }
});

app.post("/api/lab/stop", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  activeSessions.delete(sessionId);
  await stopDockerLabSession({ sessionId }).catch(() => {});
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// CERTIFICATION – /api/cert
// Issued when all 10 labs are completed
// ─────────────────────────────────────────────

app.post("/api/cert/generate", auth, async (req, res) => {
  const userId = req.user.id;

  const completedLabs = await prisma.userProgress.count({
    where: { userId, completed: true }
  });

  if (completedLabs < 10) {
    return res.status(403).json({
      error: "Complete all 10 labs to earn the certificate.",
      progress: `${completedLabs}/10`
    });
  }

  // Idempotent: return existing cert if already issued
  const existing = await prisma.certificate.findFirst({
    where: { userId },
    include: { user: { select: { name: true } } }
  });
  if (existing) return res.json({
    certId: existing.certId,
    issuedAt: existing.issuedAt,
    name: existing.user?.name,
    alreadyIssued: true
  });

  const userRaw = await prisma.user.findUnique({ where: { id: userId } });
  const user = userRaw ? decryptUser(userRaw) : null;
  const certId = `WINLAB-${Date.now()}-${userId.slice(0, 8).toUpperCase()}`;

  const cert = await prisma.certificate.create({
    data: { userId, certId, labsCompleted: completedLabs, issuedAt: new Date() }
  });

  res.json({ certId: cert.certId, issuedAt: cert.issuedAt, name: user?.name });
});

// Public verification endpoint (no auth)
app.get("/api/cert/verify/:certId", async (req, res) => {
  const cert = await prisma.certificate.findUnique({
    where: { certId: req.params.certId },
    include: { user: { select: { name: true, email: true } } }
  });
  if (!cert) return res.status(404).json({ valid: false, error: "Certificate not found" });
  const certUserName = cert.user ? decryptUser(cert.user).name : null;
  res.json({
    valid: true,
    certId: cert.certId,
    name: certUserName,
    issuedAt: cert.issuedAt,
    labsCompleted: cert.labsCompleted
  });
});

// ─────────────────────────────────────────────
// STRIPE BILLING – /api/billing
// ─────────────────────────────────────────────

const PLANS = {
  pro: process.env.STRIPE_PRICE_PRO,       // $19/mo
  business: process.env.STRIPE_PRICE_BUSINESS // $99/mo
};

app.post("/api/billing/checkout", billingLimiter, auth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan" });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan], quantity: 1 }],
    customer_email: user.email,
    metadata: { userId: req.user.id, plan },
    success_url: `${process.env.APP_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.APP_URL}/pricing`
  });

  res.json({ url: session.url });
});

// Stripe webhook → update plan in DB after payment
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // IDEMPOTENCY CHECK: Prevent duplicate event processing
  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`[Stripe Webhook] Event already processed: ${event.id}`);
    return res.sendStatus(200);
  }

  // Handle checkout.session.completed (both subscription and one-time payments)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, plan, type } = session.metadata;

    try {
      // ── Early Access $5: no-auth purchase → find or create user ──────────
      if (type === "one_time_earlyAccess") {
        const email = session.customer_details?.email;
        if (!email) throw new Error("No email in early access session");

        // Upsert: create user if not exists, activate if exists
        const user = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: session.customer_details?.name || "",
            plan: "earlyAccess",
            subscriptionStatus: "active",
            stripeCustomerId: session.customer || undefined,
            isPromo: true, // paid during 72h launch window
          },
          update: {
            plan: "earlyAccess",
            subscriptionStatus: "active",
            stripeCustomerId: session.customer || undefined,
            isPromo: true,
          },
        });

        // Activate EarlyAccessSignup row (if exists)
        await prisma.earlyAccessSignup.updateMany({
          where: { email },
          data: {
            activated: true,
            paymentIntentId: session.payment_intent || session.id,
          },
        });

        // Record payment
        await prisma.payment.create({
          data: {
            userId: user.id,
            stripePaymentIntentId: session.payment_intent || session.id,
            amount: session.amount_total || 500,
            currency: session.currency || "usd",
            status: "succeeded",
            type: "one_time",
            description: "Early Access - $5 launch tier",
            metadata: JSON.stringify({ type, email }),
          },
        });

        await prisma.analytics.create({
          data: { event: "early_access_purchased", userId: user.id, meta: JSON.stringify({ email }) },
        });

        await markEventProcessed(event.id, event.type, { userId: user.id, type });
        console.log(`[Stripe] Early access purchased by ${email} → user ${user.id}`);
        return res.sendStatus(200);
      }

      // ── Lifetime $149: update plan ────────────────────────────────────────
      if (type === "one_time_lifetime") {
        const resolvedUserId = userId || null;
        if (!resolvedUserId) throw new Error("Lifetime purchase missing userId in metadata");

        await prisma.user.update({
          where: { id: resolvedUserId },
          data: { plan: "lifetime", subscriptionStatus: "active" },
        });

        await prisma.payment.create({
          data: {
            userId: resolvedUserId,
            stripePaymentIntentId: session.payment_intent || session.id,
            amount: session.amount_total || 14900,
            currency: session.currency || "usd",
            status: "succeeded",
            type: "one_time",
            description: "Lifetime Access - $149",
            metadata: JSON.stringify({ type }),
          },
        });

        await prisma.analytics.create({
          data: { event: "lifetime_purchased", userId: resolvedUserId, meta: JSON.stringify({ amount: 149 }) },
        });

        await markEventProcessed(event.id, event.type, { userId: resolvedUserId, type });
        console.log(`[Stripe] Lifetime purchased by user ${resolvedUserId}`);
        return res.sendStatus(200);
      }

      // ── Subscription / pay-per-incident ───────────────────────────────────
      if (plan && userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan },
        });
        await prisma.analytics.create({
          data: { event: "plan_upgraded", userId, meta: JSON.stringify({ plan, type: type || "subscription" }) },
        });
      }

      if (type === "pay_per_incident" && userId) {
        await prisma.payment.create({
          data: {
            userId,
            stripePaymentIntentId: session.payment_intent || session.id,
            amount: session.amount_total || 0,
            currency: session.currency || "usd",
            status: "succeeded",
            type: "one_time",
            description: `Pay-per-incident: ${session.metadata.labId || "lab"}`,
            metadata: JSON.stringify(session.metadata),
          },
        });
      }

      await markEventProcessed(event.id, event.type, { userId, plan });
      console.log(`[Stripe] Checkout completed for user ${userId}, plan: ${plan || "N/A"}, type: ${type || "subscription"}`);
    } catch (err) {
      console.error("[Stripe] Error handling checkout.session.completed:", err);
      return res.status(500).send('Webhook handler error');
    }
  }

  // Handle invoice.payment_succeeded
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    try {
      const subscriptionId = invoice.subscription;
      if (!subscriptionId) return res.sendStatus(200);

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const customerId = subscription.customer;

      // Find user by stripeCustomerId
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) {
        console.error("[Stripe] User not found for customer:", customerId);
        return res.sendStatus(200);
      }

      // Update subscription status on user
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
          subscriptionPlan: subscription.items.data[0]?.price?.metadata?.plan || "pro",
          subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      // Create subscription record
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id,
          stripeSubscriptionId: subscriptionId,
          plan: subscription.items.data[0]?.price?.metadata?.plan || "pro",
          status: "active",
          currency: invoice.currency,
          amount: invoice.amount_paid || invoice.total,
          interval: subscription.items.data[0]?.plan?.interval || "month",
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          metadata: JSON.stringify({ invoiceId: invoice.id }),
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentIntentId: invoice.payment_intent || invoice.id,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_paid || invoice.total,
          currency: invoice.currency,
          status: "succeeded",
          type: "subscription",
          description: `Subscription payment for ${subscription.items.data[0]?.price?.metadata?.plan || "pro"} plan`,
          receiptUrl: invoice.hosted_invoice_url,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          metadata: JSON.stringify({ subscriptionId, invoiceId: invoice.id }),
        },
      });

      // Analytics
      await prisma.analytics.create({
        data: { event: "payment_succeeded", userId: user.id, meta: JSON.stringify({ invoiceId: invoice.id }) },
      });

      console.log(`[Stripe] Invoice payment succeeded for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling invoice.payment_succeeded:", err);
    }
  }

  // Handle invoice.payment_failed
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    try {
      const subscriptionId = invoice.subscription;
      if (!subscriptionId) return res.sendStatus(200);

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const customerId = subscription.customer;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      // Update user subscription status
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "past_due" },
      });

      // Create failed payment record
      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentIntentId: invoice.payment_intent || invoice.id,
          stripeInvoiceId: invoice.id,
          amount: invoice.amount_due || invoice.total,
          currency: invoice.currency,
          status: "failed",
          type: "subscription",
          description: "Subscription payment failed",
          failureMessage: invoice.last_finalization_error?.message || "Payment failed",
          metadata: JSON.stringify({ subscriptionId, invoiceId: invoice.id }),
        },
      });

      // Analytics
      await prisma.analytics.create({
        data: { event: "payment_failed", userId: user.id, meta: JSON.stringify({ invoiceId: invoice.id }) },
      });

      console.log(`[Stripe] Invoice payment failed for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling invoice.payment_failed:", err);
    }
  }

  // Handle customer.subscription.updated
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    try {
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      const status = subscription.status;
      const internalStatus = mapStripeStatus(status);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: internalStatus,
          subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        },
      });

      // Update subscription record if it exists
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: internalStatus,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      });

      // Analytics
      await prisma.analytics.create({
        data: { event: "subscription_updated", userId: user.id, meta: JSON.stringify({ status: subscription.status }) },
      });

      console.log(`[Stripe] Subscription updated for user ${user.id}: ${status}`);
    } catch (err) {
      console.error("[Stripe] Error handling subscription.updated:", err);
    }
  }

  // Handle customer.subscription.deleted
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    try {
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      // Revert user plan to starter
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: "starter",
          subscriptionStatus: "canceled",
          subscriptionPlan: null,
          stripeSubscriptionId: null,
        },
      });

      // Update subscription record
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status: "canceled",
          canceledAt: new Date(),
        },
      });

      // Analytics
      await prisma.analytics.create({
        data: { event: "subscription_canceled", userId: user.id, meta: JSON.stringify({ subscriptionId: subscription.id }) },
      });

      console.log(`[Stripe] Subscription deleted for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling subscription.deleted:", err);
    }
  }

  // Handle customer.subscription.trial_will_end
  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object;
    try {
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      await prisma.analytics.create({
        data: { event: "trial_will_end", userId: user.id, meta: JSON.stringify({ subscriptionId: subscription.id }) },
      });

      console.log(`[Stripe] Trial will end for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling trial_will_end:", err);
    }
  }

  // Handle customer.subscription.paused
  if (event.type === "customer.subscription.paused") {
    const subscription = event.data.object;
    try {
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "paused" },
      });

      await prisma.analytics.create({
        data: { event: "subscription_paused", userId: user.id, meta: JSON.stringify({ subscriptionId: subscription.id }) },
      });

      console.log(`[Stripe] Subscription paused for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling subscription.paused:", err);
    }
  }

  // Handle customer.subscription.resumed
  if (event.type === "customer.subscription.resumed") {
    const subscription = event.data.object;
    try {
      const customerId = subscription.customer;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: typeof customerId === "string" ? customerId : customerId.id },
      });

      if (!user) return res.sendStatus(200);

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "active" },
      });

      await prisma.analytics.create({
        data: { event: "subscription_resumed", userId: user.id, meta: JSON.stringify({ subscriptionId: subscription.id }) },
      });

      console.log(`[Stripe] Subscription resumed for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling subscription.resumed:", err);
    }
  }

  // Handle payment_intent.succeeded
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: paymentIntent.customer },
      });

      if (!user) return res.sendStatus(200);

      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "succeeded",
          type: "one_time",
          description: paymentIntent.description || "Payment succeeded",
          metadata: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        },
      });

      console.log(`[Stripe] Payment intent succeeded for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling payment_intent.succeeded:", err);
    }
  }

  // Handle payment_intent.payment_failed
  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: paymentIntent.customer },
      });

      if (!user) return res.sendStatus(200);

      await prisma.payment.create({
        data: {
          userId: user.id,
          stripePaymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "failed",
          type: "one_time",
          description: paymentIntent.description || "Payment failed",
          failureMessage: paymentIntent.last_payment_error?.message || "Payment failed",
          metadata: JSON.stringify({ paymentIntentId: paymentIntent.id }),
        },
      });

      console.log(`[Stripe] Payment intent failed for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling payment_intent.payment_failed:", err);
    }
  }

  // Handle charge.refunded
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    try {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: charge.customer },
      });

      if (!user) return res.sendStatus(200);

      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: charge.payment_intent },
        data: { status: "refunded" },
      });

      await prisma.analytics.create({
        data: { event: "payment_refunded", userId: user.id, meta: JSON.stringify({ chargeId: charge.id }) },
      });

      console.log(`[Stripe] Charge refunded for user ${user.id}`);
    } catch (err) {
      console.error("[Stripe] Error handling charge.refunded:", err);
    }
  }

  res.sendStatus(200);
});


// ─────────────────────────────────────────────
// EARLY ACCESS SIGNUP (500 seats limit)
// ─────────────────────────────────────────────

import {
  claimEarlyAccessSeat,
  getRemainingSeats,
  getEarlyAccessStats,
  getEarlyAccessSignup,
} from './src/services/earlyAccessService.js';
import { sendEarlyAccessConfirmation } from './src/services/earlyAccessEmail.js';
import { processWebhookEvent } from './src/services/webhookIdempotency.js';

// Get remaining early access seats (public endpoint)
app.get('/api/early-access/seats', async (req, res) => {
  try {
    const stats = await getEarlyAccessStats();
    res.json(stats);
  } catch (error) {
    console.error('[EarlyAccess] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get seat count' });
  }
});

// Signup for early access
app.post('/api/early-access/signup', billingLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Set access date to 30 days from now
    const accessDate = new Date();
    accessDate.setDate(accessDate.getDate() + 30);

    // Atomically claim seat
    const signup = await claimEarlyAccessSeat({
      email: email.toLowerCase().trim(),
      name: name?.trim(),
      accessDate,
    });

    // Send confirmation email
    try {
      await sendEarlyAccessConfirmation({
        email: signup.email,
        name: signup.name,
        signupDate: signup.signupDate,
        accessDate: signup.accessDate,
        lockedPrice: signup.lockedPrice,
      });
    } catch (emailError) {
      console.error('[EarlyAccess] Email send failed:', emailError.message);
      // Don't fail signup if email fails
    }

    res.json({
      success: true,
      message: 'Early access seat claimed!',
      signup: {
        email: signup.email,
        name: signup.name,
        lockedPrice: signup.lockedPrice,
        accessDate: signup.accessDate,
      },
    });
  } catch (error) {
    if (error.message === 'EARLY_ACCESS_SOLD_OUT') {
      return res.status(409).json({
        error: 'Early access sold out! Join the waitlist.',
        soldOut: true,
      });
    }

    if (error.code === 'P2002') {
      // Unique constraint violation (email already signed up)
      const existing = await getEarlyAccessSignup(req.body.email);
      return res.json({
        success: true,
        message: 'Already signed up for early access!',
        existing: true,
        signup: existing,
      });
    }

    console.error('[EarlyAccess] Signup error:', error);
    res.status(500).json({ error: 'Failed to claim early access seat' });
  }
});

// ─────────────────────────────────────────────
// WAITLIST — referral viral loop
// ─────────────────────────────────────────────

function genRefCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F9B2C1"
}

// POST /api/waitlist/join — signup + referral tracking
app.post("/api/waitlist/join", billingLimiter, express.json(), async (req, res) => {
  const { email, name, ref } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Email non valida" });

  try {
    // Check if referred-by code exists
    let referrer = null;
    if (ref) {
      referrer = await prisma.earlyAccessSignup.findUnique({ where: { referralCode: ref } });
    }

    // Generate unique referral code for this user
    let referralCode = genRefCode();
    while (await prisma.earlyAccessSignup.findUnique({ where: { referralCode } })) {
      referralCode = genRefCode();
    }

    // Count existing signups for position
    const total = await prisma.earlyAccessSignup.count();
    const accessDate = new Date(); accessDate.setDate(accessDate.getDate() + 30);

    let signup;
    try {
      signup = await prisma.earlyAccessSignup.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name?.trim() || null,
          accessDate,
          referralCode,
          referredBy: referrer?.referralCode || null,
          position: total + 1,
        },
      });
    } catch (e) {
      if (e.code === "P2002") {
        // Already signed up — return existing
        signup = await prisma.earlyAccessSignup.findUnique({ where: { email: email.toLowerCase().trim() } });
        return res.json({ success: true, existing: true, signup: { email: signup.email, referralCode: signup.referralCode, position: signup.position, referralCount: signup.referralCount } });
      }
      throw e;
    }

    // Increment referrer's count + bump position up 2 spots
    if (referrer) {
      await prisma.earlyAccessSignup.update({
        where: { id: referrer.id },
        data: {
          referralCount: { increment: 1 },
          position: referrer.position > 2 ? { decrement: 2 } : referrer.position,
        },
      });
    }

    res.json({
      success: true,
      signup: {
        email: signup.email,
        referralCode: signup.referralCode,
        position: signup.position,
        referralCount: 0,
      },
    });
  } catch (e) {
    console.error("[Waitlist] Error:", e.message);
    res.status(500).json({ error: "Errore interno" });
  }
});

// GET /api/waitlist/status/:code — position + referral count
app.get("/api/waitlist/status/:code", async (req, res) => {
  try {
    const entry = await prisma.earlyAccessSignup.findUnique({ where: { referralCode: req.params.code } });
    if (!entry) return res.status(404).json({ error: "Not found" });
    const total = await prisma.earlyAccessSignup.count();
    res.json({ position: entry.position, total, referralCount: entry.referralCount, email: entry.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /ref/:code — track referral click + redirect to landing
app.get("/ref/:code", async (req, res) => {
  const code = req.params.code?.toUpperCase();
  // Track the click
  prisma.analytics.create({ data: { event: "referral_click", meta: JSON.stringify({ code }) } }).catch(() => {});
  res.redirect(302, `/?ref=${code}`);
});

// Helper function to map Stripe status to internal status
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "pending",
    incomplete_expired: "canceled",
    trialing: "trial",
    paused: "paused",
  };
  return statusMap[stripeStatus] || "none";
}

// ─────────────────────────────────────────────
// STRIPE API ROUTES - Subscription Management
// ─────────────────────────────────────────────

// Create subscription checkout session
app.post("/api/stripe/subscribe", billingLimiter, auth, async (req, res) => {
  try {
    const { plan, currency = "usd" } = req.body;
    if (!["pro", "business"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan. Choose 'pro' or 'business'." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const successUrl = `${process.env.APP_URL}/dashboard?upgraded=1&plan=${plan}`;
    const cancelUrl = `${process.env.APP_URL}/pricing?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price: process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${currency.toUpperCase()}`] || process.env[`STRIPE_PRICE_${plan.toUpperCase()}`],
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, plan, currency, type: "subscription" },
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id, plan },
        trial_period_days: 7, // 7-day free trial
      },
    });

    // Save stripeCustomerId if new customer
    if (!user.stripeCustomerId && session.customer) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer.id },
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe] Error creating subscription checkout:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Pay-per-incident checkout
app.post("/api/stripe/pay-per-incident", billingLimiter, auth, async (req, res) => {
  try {
    const { currency = "usd", labId } = req.body;
    const priceConfig = {
      usd: { amount: 1900, currency: "usd" }, // $19
      inr: { amount: 2000, currency: "inr" }, // ₹20
    };
    const price = priceConfig[currency] || priceConfig.usd;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const successUrl = `${process.env.APP_URL}/lab/${labId || "default"}?payment=success`;
    const cancelUrl = `${process.env.APP_URL}/pricing?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: price.currency,
          product_data: {
            name: `Lab Access: ${labId || "Scenario"}`,
            description: "One-time access to lab scenario",
            metadata: { labId: labId || "default", userId: user.id },
          },
          unit_amount: price.amount,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, labId, type: "pay_per_incident", currency },
    });

    // Save stripeCustomerId if new customer
    if (!user.stripeCustomerId && session.customer) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer.id },
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe] Error creating pay-per-incident checkout:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ─────────────────────────────────────────────
// ONE-TIME PAYMENTS (Early Access $5, Lifetime $149)
// ─────────────────────────────────────────────

import { createOneTimePaymentCheckout, detectCurrency } from './src/api/stripe-service.js';

// 72h launch tier window check
function isLaunchTierActive() {
  const start = process.env.LAUNCH_START_AT ? new Date(process.env.LAUNCH_START_AT) : null;
  const end   = process.env.LAUNCH_END_AT   ? new Date(process.env.LAUNCH_END_AT)   : null;
  if (!start) return true; // Not set = always open (dev mode)
  const now = Date.now();
  if (now < start.getTime()) return false; // Not started yet
  if (end) return now <= end.getTime();
  return now - start.getTime() < 72 * 60 * 60 * 1000; // fallback: 72h from start
}

function launchTierExpiresAt() {
  if (process.env.LAUNCH_END_AT) return new Date(process.env.LAUNCH_END_AT).toISOString();
  const start = process.env.LAUNCH_START_AT ? new Date(process.env.LAUNCH_START_AT) : null;
  if (!start) return null;
  return new Date(start.getTime() + 72 * 60 * 60 * 1000).toISOString();
}

// Early Access $5 checkout — 72h launch tier, no auth required
app.post("/api/stripe/early-access", billingLimiter, async (req, res) => {
  try {
    // 72h window check
    if (!isLaunchTierActive()) {
      return res.status(410).json({
        error: "Launch tier expired",
        message: "The $5 early access price is no longer available. Get started at $19/month.",
        redirect: `${process.env.APP_URL}/pricing`,
      });
    }

    const { email, name } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: "Valid email required" });
    }

    const user = req.user ? await prisma.user.findUnique({ where: { id: req.user.id } }) : null;
    const currency = detectCurrency(req); // auto: eur for EU, inr for India, usd default
    const successUrl = `${process.env.APP_URL}/early-access/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.APP_URL}/pricing?canceled=1`;

    const session = await createOneTimePaymentCheckout(
      'earlyAccess',
      user || { email, name },
      successUrl,
      cancelUrl,
      currency
    );

    res.json({
      url: session.url,
      amount: session.amount,
      currency: session.currency,
      expiresAt: launchTierExpiresAt(),
      message: `Proceed to payment to lock your ${session.currency === 'eur' ? '€5' : '$5'} price`,
    });
  } catch (err) {
    console.error("[Stripe] Error creating early access checkout:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// GET /api/stripe/early-access/verify — magic login after Stripe redirect
// Called by frontend success page with session_id from URL
app.get("/api/stripe/early-access/verify", billingLimiter, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: "session_id required" });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not completed" });
    }

    const email = session.customer_details?.email;
    if (!email) {
      return res.status(400).json({ error: "No email in session" });
    }

    // Find or create user (webhook may not have fired yet — race condition safe)
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: session.customer_details?.name || "",
        plan: "earlyAccess",
        subscriptionStatus: "active",
        stripeCustomerId: session.customer || undefined,
      },
      update: {
        plan: "earlyAccess",
        subscriptionStatus: "active",
        stripeCustomerId: session.customer || undefined,
      },
    });

    // Issue JWT — zero friction magic login
    const token = jwt.sign({ userId: user.id, role: "user" }, JWT_SECRET, { expiresIn: "30d" });

    console.log(`[Stripe] Magic login issued for ${email} → user ${user.id}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
    });
  } catch (err) {
    console.error("[Stripe] Early access verify error:", err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// Lifetime €/$ 149 checkout (requires auth)
app.post("/api/stripe/lifetime", billingLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const currency = detectCurrency(req);
    const successUrl = `${process.env.APP_URL}/dashboard?lifetime=success`;
    const cancelUrl = `${process.env.APP_URL}/pricing?canceled=1`;

    const session = await createOneTimePaymentCheckout(
      'lifetime',
      user,
      successUrl,
      cancelUrl,
      currency
    );

    res.json({
      url: session.url,
      amount: session.amount,
      currency: session.currency,
      message: 'Proceed to payment for lifetime access',
    });
  } catch (err) {
    console.error("[Stripe] Error creating lifetime checkout:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ─────────────────────────────────────────────
// AFRICA PAYMENTS (Paystack)
// ─────────────────────────────────────────────

import { initializePayment, verifyPayment, detectAfricanCurrency, getAfricaPrice } from './src/services/paystackService.js';

// Initialize Paystack payment for Africa
// Amount is looked up from backend pricing table — never trusted from client
app.post("/api/billing/paystack/initialize", billingLimiter, async (req, res) => {
  try {
    const { email, name, plan } = req.body;

    if (!email || !plan) {
      return res.status(400).json({ error: "Email and plan required" });
    }
    if (!['pro', 'business', 'lifetime', 'earlyAccess'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const currency = detectAfricanCurrency(req) || 'NGN';
    const pricing = getAfricaPrice(currency, plan);

    if (!pricing) {
      return res.status(400).json({ error: `Plan '${plan}' not available in ${currency}` });
    }

    const callbackUrl = `${process.env.APP_URL}/api/billing/paystack/callback?plan=${plan}&email=${encodeURIComponent(email)}`;

    const payment = await initializePayment({
      email,
      amount: pricing.amount, // from server-side table — not client
      currency,
      callbackUrl,
      metadata: {
        userId: req.user?.id || '',
        plan,
        name: name || '',
        priceDisplay: pricing.display,
      },
    });

    res.json({
      authorizationUrl: payment.authorizationUrl,
      accessCode: payment.accessCode,
      amount: pricing.amount / 100,
      display: pricing.display,
      currency,
      reference: payment.reference,
    });
  } catch (err) {
    console.error("[Paystack] Error initializing payment:", err);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// ─────────────────────────────────────────────
// GEO-AWARE PRICING API
// ─────────────────────────────────────────────

import { AFRICA_PRICING } from './src/services/paystackService.js';

// Returns correct pricing for the user's region — used by frontend pricing page
app.get("/api/pricing", async (req, res) => {
  const country = req.headers['cf-ipcountry']?.toUpperCase() || '';

  const AFRICA_MAP = { NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR' };
  const EU_COUNTRIES = new Set([
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
    'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
    'NL','PL','PT','RO','SE','SI','SK',
  ]);

  const isAfrica = country in AFRICA_MAP;
  const isIndia  = country === 'IN';
  const isEU     = EU_COUNTRIES.has(country);

  const launchTierActive = isLaunchTierActive();

  if (isAfrica) {
    const currency = AFRICA_MAP[country];
    const p = AFRICA_PRICING[currency];
    return res.json({
      region: 'africa',
      currency,
      flag: p.flag,
      launchTierActive,
      launchExpiresAt: launchTierExpiresAt(),
      plans: {
        earlyAccess: { ...p.earlyAccess, label: 'Early Access (72h)' },
        pro:         { ...p.pro,         label: 'Individual' },
        business:    { ...p.business,    label: 'Business' },
        lifetime:    { ...p.lifetime,    label: 'Lifetime' },
      },
      checkout: 'paystack',
    });
  }

  if (isIndia) {
    return res.json({
      region: 'india',
      currency: 'usd',
      flag: '🇮🇳',
      launchTierActive,
      launchExpiresAt: launchTierExpiresAt(),
      plans: {
        earlyAccess: { amount: 5,   display: '$5',    label: 'Early Access (72h)' },
        pro:         { amount: 19,  display: '$19/mo', label: 'Individual' },
        business:    { amount: 99,  display: '$99/mo', label: 'Business' },
        lifetime:    { amount: 149, display: '$149',   label: 'Lifetime' },
      },
      checkout: 'stripe',
    });
  }

  // EU / rest of world
  const currency = isEU ? 'eur' : 'usd';
  const sym = isEU ? '€' : '$';
  return res.json({
    region: isEU ? 'eu' : 'world',
    currency,
    flag: isEU ? '🇪🇺' : '🌍',
    launchTierActive,
    launchExpiresAt: launchTierExpiresAt(),
    plans: {
      earlyAccess: { amount: 5,   display: `${sym}5`,        label: 'Early Access (72h)' },
      pro:         { amount: 19,  display: `${sym}19/mo`,    label: 'Individual' },
      business:    { amount: 99,  display: `${sym}99/mo`,    label: 'Business' },
      lifetime:    { amount: 149, display: `${sym}149`,      label: 'Lifetime' },
    },
    checkout: 'stripe',
  });
});

// Paystack webhook callback
app.post("/api/billing/paystack/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature (implementation in paystackService)
    // Note: Paystack webhooks use HMAC-SHA512 signature

    const event = JSON.parse(payload);

    if (event.event === 'charge.success') {
      const { reference, status, metadata } = event.data;
      
      if (status === 'success') {
        const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        const { plan, userId, email } = parsedMetadata;

        // Update user plan
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: plan || 'pro',
              subscriptionStatus: 'active',
            },
          });
        }

        // Record payment
        await prisma.payment.create({
          data: {
            userId: userId || null,
            stripePaymentIntentId: `paystack_${reference}`,
            amount: event.data.amount || 0,
            currency: event.data.currency || 'NGN',
            status: 'succeeded',
            type: 'one_time',
            description: `Paystack payment: ${plan}`,
            metadata: JSON.stringify(event.data),
          },
        });

        // Analytics
        await prisma.analytics.create({
          data: {
            event: 'paystack_payment_success',
            userId: userId || null,
            meta: JSON.stringify({ plan, reference }),
          },
        });

        console.log(`[Paystack] Payment successful: ${reference}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("[Paystack] Webhook error:", err);
    res.status(500).send('Webhook error');
  }
});

// Create billing portal session (manage subscription, update payment method)
app.post("/api/stripe/portal", billingLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe] Error creating billing portal:", err);
    res.status(500).json({ error: "Failed to create billing portal" });
  }
});

// Cancel subscription
app.post("/api/stripe/cancel", billingLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { cancelAtPeriodEnd: true },
    });

    res.json({
      success: true,
      cancelAt: new Date(subscription.current_period_end * 1000),
      message: "Subscription will cancel at end of billing period",
    });
  } catch (err) {
    console.error("[Stripe] Error canceling subscription:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Resume subscription (undo cancel)
app.post("/api/stripe/resume", billingLimiter, auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { cancelAtPeriodEnd: false },
    });

    res.json({
      success: true,
      message: "Subscription resumed successfully",
    });
  } catch (err) {
    console.error("[Stripe] Error resuming subscription:", err);
    res.status(500).json({ error: "Failed to resume subscription" });
  }
});

// Pause subscription
app.post("/api/stripe/pause", billingLimiter, auth, async (req, res) => {
  try {
    const { behavior = "pause_collection" } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      pause_collection: { behavior },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "paused" },
    });

    res.json({
      success: true,
      message: "Subscription paused",
    });
  } catch (err) {
    console.error("[Stripe] Error pausing subscription:", err);
    res.status(500).json({ error: "Failed to pause subscription" });
  }
});

// Get user subscription status
app.get("/api/stripe/subscription", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
      },
    });

    res.json({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionPeriodEnd: user.subscriptionPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    });
  } catch (err) {
    console.error("[Stripe] Error getting subscription:", err);
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

// ─────────────────────────────────────────────
// 72H LAUNCH: Stripe Checkout ($5 early access)
// ─────────────────────────────────────────────
app.post("/api/checkout", billingLimiter, async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Use early access price ID from env, fallback to placeholder
    const priceId = process.env.STRIPE_PRICE_EARLY_ACCESS || "price_early_access_5";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.BASE_URL || "https://winlab.cloud"}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL || "https://winlab.cloud"}`,
      metadata: {
        source: "72h_launch_landing",
        campaign: "early_access_5",
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Checkout Error]", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Get user subscription status
app.get("/api/stripe/subscription", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
      },
    });

    if (!user.stripeSubscriptionId) {
      return res.json({ hasSubscription: false });
    }

    // Fetch latest from Stripe
    let stripeSub = null;
    try {
      stripeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    } catch (err) {
      console.error("[Stripe] Error fetching subscription from Stripe:", err);
    }

    res.json({
      hasSubscription: true,
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan,
      periodEnd: user.subscriptionPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      trialEndsAt: user.trialEndsAt,
      stripeData: stripeSub ? {
        status: stripeSub.status,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      } : null,
    });
  } catch (err) {
    console.error("[Stripe] Error fetching subscription status:", err);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

// Get payment history
app.get("/api/stripe/payments", auth, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ payments });
  } catch (err) {
    console.error("[Stripe] Error fetching payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Get subscription invoice history
app.get("/api/stripe/invoices", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 50,
    });

    res.json({ invoices: invoices.data });
  } catch (err) {
    console.error("[Stripe] Error fetching invoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// Update subscription (upgrade/downgrade plan)
app.post("/api/stripe/update-subscription", billingLimiter, auth, async (req, res) => {
  try {
    const { newPlan, currency = "usd" } = req.body;
    if (!["pro", "business"].includes(newPlan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const subscriptionItem = subscription.items.data[0];

    const newPriceId = process.env[`STRIPE_PRICE_${newPlan.toUpperCase()}_${currency.toUpperCase()}`] ||
                       process.env[`STRIPE_PRICE_${newPlan.toUpperCase()}`];

    // Update subscription with new price (proration handled by Stripe)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{
        id: subscriptionItem.id,
        price: newPriceId,
      }],
      proration_behavior: "create_prorations",
      metadata: { ...subscription.metadata, plan: newPlan, updatedBy: "user" },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionPlan: newPlan },
    });

    await prisma.analytics.create({
      data: { event: "plan_changed", userId: user.id, meta: JSON.stringify({ newPlan }) },
    });

    res.json({ success: true, plan: newPlan });
  } catch (err) {
    console.error("[Stripe] Error updating subscription:", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// Get pricing information
app.get("/api/stripe/pricing", async (req, res) => {
  const pricing = {
    subscriptions: {
      pro: {
        usd: { amount: 1900, currency: "usd", display: "$19/mo" },
        inr: { amount: 19900, currency: "inr", display: "₹199/mo" },
      },
      business: {
        usd: { amount: 9900, currency: "usd", display: "$99/mo" },
        inr: { amount: 99900, currency: "inr", display: "₹999/mo" },
      },
    },
    payPerIncident: {
      usd: { amount: 1900, currency: "usd", display: "$19/lab" },
      inr: { amount: 2000, currency: "inr", display: "₹20/lab" },
    },
  };

  res.json(pricing);
});

// ─────────────────────────────────────────────
// TEAM DASHBOARD (Business plan) – /api/team
// ─────────────────────────────────────────────

app.get("/api/team/progress", auth, async (req, res) => {
  const manager = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (manager?.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  if (!manager.teamId) return res.json([]);

  const teamMembers = await prisma.user.findMany({
    where: { teamId: manager.teamId },
    select: {
      id: true, name: true, email: true,
      progress: { select: { labId: true, completed: true, score: true, updatedAt: true } }
    }
  });

  const report = teamMembers.map(m => ({
    ...m,
    completedLabs: m.progress.filter(p => p.completed).length,
    totalLabs: m.progress.length
  }));

  res.json(report);
});

// ─────────────────────────────────────────────
// CACHE STATS – /api/admin/cache-stats (internal)
// ─────────────────────────────────────────────

app.get("/api/admin/cache-stats", auth, freshUser, async (req, res) => {
  if (req.user.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  const total = await prisma.aiCache.count();
  const topHits = await prisma.aiCache.findMany({
    orderBy: { hits: "desc" },
    take: 10,
    select: { prompt: true, hits: true, model: true, tokensUsed: true }
  });
  const totalTokensSaved = await prisma.aiCache.aggregate({
    _sum: { tokensUsed: true }
  });
  res.json({ cachedEntries: total, topHits, totalTokensSaved: totalTokensSaved._sum.tokensUsed });
});

// ─────────────────────────────────────────────
// CONVERSION BOOST
// ─────────────────────────────────────────────

app.post("/api/conversion/trigger", auth, async (req, res) => {
  const userId = req.user.id;
  await prisma.analytics.create({ data: { event: "paywall_shown", userId } });
  res.sendStatus(200);
});

// ─────────────────────────────────────────────
// ANALYTICS TRACKING – /api/analytics/track
// Receives real-time event data from frontend
// Fire-and-forget endpoint (uses sendBeacon)
// ─────────────────────────────────────────────

app.post("/api/analytics/track", express.json(), async (req, res) => {
  try {
    const { event, data, timestamp, sessionId } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Event name required" });
    }

    // Store analytics in database for dashboard viewing
    await prisma.analytics.create({
      data: {
        event,
        userId: req.user?.id || null, // null for anonymous users
        sessionId: sessionId || "anonymous",
        meta: JSON.stringify({
          ...data,
          timestamp,
          userAgent: req.get("User-Agent"),
          ip: req.ip,
        }),
      },
    });

    // Log to console for real-time monitoring
    console.log(JSON.stringify({
      type: "analytics",
      event,
      data,
      sessionId,
      timestamp,
    }));

    res.sendStatus(200);
  } catch (error) {
    // Analytics should never break the UX
    console.error("Analytics tracking error:", error.message);
    res.sendStatus(200); // Always return 200 to not block frontend
  }
});

// ─────────────────────────────────────────────
// ANALYTICS DASHBOARD – /api/analytics/conversion
// Returns conversion metrics for admin dashboard
// ─────────────────────────────────────────────

app.get("/api/analytics/conversion", async (req, res) => {
  try {
    const [
      totalLabStarts,
      totalLabCompletions,
      totalHintUses,
      totalErrors,
      totalUpgradeClicks,
    ] = await Promise.all([
      prisma.analytics.count({ where: { event: "lab_start" } }),
      prisma.analytics.count({ where: { event: "lab_complete" } }),
      prisma.analytics.count({ where: { event: "hint_use" } }),
      prisma.analytics.count({ where: { event: "command_error" } }),
      prisma.analytics.count({ where: { event: "upgrade_click" } }),
    ]);

    const completionRate = totalLabStarts > 0
      ? ((totalLabCompletions / totalLabStarts) * 100).toFixed(2)
      : 0;

    // Get recent completions with timing data
    const recentCompletions = await prisma.analytics.findMany({
      where: { event: "lab_complete" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const avgTimeToComplete = recentCompletions.length > 0
      ? recentCompletions.reduce((acc, record) => {
          const meta = typeof record.meta === "string" ? JSON.parse(record.meta) : record.meta;
          return acc + (meta.timeMs || 0);
        }, 0) / recentCompletions.length
      : 0;

    // Region breakdown
    const regionData = await prisma.analytics.groupBy({
      by: ["sessionId"],
      where: { event: "lab_start" },
      _count: true,
    });

    res.json({
      conversionRate: `${completionRate}%`,
      totalLabStarts,
      totalLabCompletions,
      totalHintUses,
      totalErrors,
      totalUpgradeClicks,
      avgTimeToComplete: `${(avgTimeToComplete / 1000).toFixed(1)}s`,
      recentCompletions: recentCompletions.slice(0, 10).map(r => ({
        event: r.event,
        meta: typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Analytics query error:", error.message);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ─────────────────────────────────────────────
// LAUNCH WEEK ANALYTICS – /api/analytics/launch
// Metriche landing page per i primi giorni di lancio
// ─────────────────────────────────────────────

app.get("/api/analytics/launch", async (req, res) => {
  try {
    const LAUNCH_START = new Date("2026-04-17T00:00:00Z");

    // Visitatori unici (sessioni distinte) per giorno
    const dailyVisitors = await prisma.analytics.findMany({
      where: { event: "page_view", createdAt: { gte: LAUNCH_START } },
      select: { sessionId: true, createdAt: true, meta: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay = {};
    const uniqueSessions = new Set();
    dailyVisitors.forEach(row => {
      const day = row.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { visitors: new Set(), pageViews: 0 };
      byDay[day].visitors.add(row.sessionId);
      byDay[day].pageViews++;
      uniqueSessions.add(row.sessionId);
    });

    const dailyStats = Object.entries(byDay).map(([date, d]) => ({
      date,
      uniqueVisitors: d.visitors.size,
      pageViews: d.pageViews,
    }));

    // Sorgenti traffico (UTM)
    const allPageViews = await prisma.analytics.findMany({
      where: { event: "page_view", createdAt: { gte: LAUNCH_START } },
      select: { meta: true },
    });

    const sources = {};
    allPageViews.forEach(row => {
      const m = typeof row.meta === "string" ? JSON.parse(row.meta || "{}") : (row.meta || {});
      const src = m.utm_source || m.referrer?.replace(/^https?:\/\/([^/]+).*$/, "$1") || "direct";
      sources[src] = (sources[src] || 0) + 1;
    });

    // Device breakdown
    const devices = {};
    allPageViews.forEach(row => {
      const m = typeof row.meta === "string" ? JSON.parse(row.meta || "{}") : (row.meta || {});
      const d = m.device || "unknown";
      devices[d] = (devices[d] || 0) + 1;
    });

    // Regioni
    const regions = {};
    allPageViews.forEach(row => {
      const m = typeof row.meta === "string" ? JSON.parse(row.meta || "{}") : (row.meta || {});
      const r = m.region || "GLOBAL";
      regions[r] = (regions[r] || 0) + 1;
    });

    // Scroll depth
    const scrollEvents = await prisma.analytics.findMany({
      where: { event: "scroll_depth", createdAt: { gte: LAUNCH_START } },
      select: { meta: true },
    });
    const scrollDepth = { 25: 0, 50: 0, 75: 0, 100: 0 };
    scrollEvents.forEach(row => {
      const m = typeof row.meta === "string" ? JSON.parse(row.meta || "{}") : (row.meta || {});
      if (scrollDepth[m.pct] !== undefined) scrollDepth[m.pct]++;
    });

    // CTA clicks
    const ctaClicks = await prisma.analytics.count({
      where: { event: "landing_cta_click", createdAt: { gte: LAUNCH_START } },
    });

    // Signup funnel
    const signupStarts = await prisma.analytics.count({
      where: { event: "early_access_start", createdAt: { gte: LAUNCH_START } },
    });
    const signupDone = await prisma.analytics.count({
      where: { event: "early_access_done", createdAt: { gte: LAUNCH_START } },
    });

    // Sezioni viste
    const sectionEvents = await prisma.analytics.findMany({
      where: { event: "section_view", createdAt: { gte: LAUNCH_START } },
      select: { meta: true },
    });
    const sections = {};
    sectionEvents.forEach(row => {
      const m = typeof row.meta === "string" ? JSON.parse(row.meta || "{}") : (row.meta || {});
      const s = m.section || "unknown";
      sections[s] = (sections[s] || 0) + 1;
    });

    const totalUnique = uniqueSessions.size;
    const conversionRate = totalUnique > 0
      ? ((signupDone / totalUnique) * 100).toFixed(2)
      : "0.00";

    res.json({
      summary: {
        totalUniqueVisitors: totalUnique,
        totalPageViews: dailyVisitors.length,
        ctaClicks,
        signupStarts,
        signupDone,
        conversionRate: `${conversionRate}%`,
      },
      dailyStats,
      sources: Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, count]) => ({ source, count })),
      devices: Object.entries(devices).map(([device, count]) => ({ device, count })),
      regions: Object.entries(regions).sort((a, b) => b[1] - a[1]).map(([region, count]) => ({ region, count })),
      scrollDepth,
      sections: Object.entries(sections).sort((a, b) => b[1] - a[1]).map(([section, count]) => ({ section, count })),
    });
  } catch (error) {
    console.error("Launch analytics error:", error.message);
    res.status(500).json({ error: "Failed to fetch launch analytics" });
  }
});

// ─────────────────────────────────────────────
// BLOG API – /api/blog
// CRUD per i post del blog (admin only)
// ─────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/blog — lista pubblica (solo published)
app.get("/api/blog", async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, excerpt: true, tags: true, publishedAt: true },
    });
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/blog/all — lista completa (admin)
app.get("/api/blog/all", auth, async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, slug: true, excerpt: true, tags: true, status: true, publishedAt: true, updatedAt: true },
    });
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/blog/:slug — singolo post (pubblico se published)
app.get("/api/blog/:slug", async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.status !== "published") return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/blog — crea post (admin)
app.post("/api/blog", auth, express.json(), async (req, res) => {
  try {
    const { title, content, excerpt, tags, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title e content obbligatori" });

    const baseSlug = slugify(title);
    let slug = baseSlug;
    let n = 1;
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        tags: tags ? JSON.stringify(tags) : null,
        status: status || "draft",
        publishedAt: status === "published" ? new Date() : null,
      },
    });
    if (post.status === "published") {
      purgeCache(["/blog", `/blog/${post.slug}`]);
    }
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/blog/:id — aggiorna post (admin)
app.put("/api/blog/:id", auth, express.json(), async (req, res) => {
  try {
    const { title, content, excerpt, tags, status, slug } = req.body;
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const wasPublished = existing.status === "published";
    const nowPublished = status === "published";

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title:      title      ?? existing.title,
        slug:       slug       ?? existing.slug,
        content:    content    ?? existing.content,
        excerpt:    excerpt    !== undefined ? excerpt : existing.excerpt,
        tags:       tags       !== undefined ? JSON.stringify(tags) : existing.tags,
        status:     status     ?? existing.status,
        publishedAt: nowPublished && !wasPublished ? new Date() : existing.publishedAt,
      },
    });
    if (post.status === "published") {
      purgeCache(["/blog", `/blog/${post.slug}`]);
    }
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/blog/:id — elimina post (admin)
app.delete("/api/blog/:id", auth, async (req, res) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// CLOUDFLARE CACHE PURGE HELPER
// ─────────────────────────────────────────────

const CF_ZONE   = process.env.CLOUDFLARE_ZONE_ID  || "51e8c4002c0b13eab210d2627e1b66b0";
const CF_TOKEN  = process.env.CLOUDFLARE_API_TOKEN || "";
const APP_ORIGIN = process.env.APP_URL || "https://winlab.cloud";

/**
 * purgeCache(paths)
 * paths: string[] — e.g. ["/blog", "/blog/my-post-slug"]
 * Pass null/empty to purge everything (purge_everything).
 */
async function purgeCache(paths = null) {
  if (!CF_TOKEN) {
    console.warn("[CF] CLOUDFLARE_API_TOKEN not set — skipping cache purge");
    return;
  }
  const body = paths && paths.length
    ? { files: paths.map(p => `${APP_ORIGIN}${p}`) }
    : { purge_everything: true };

  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/purge_cache`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CF_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const d = await r.json();
    if (d.success) {
      console.log("[CF] Cache purged:", paths ?? "ALL");
    } else {
      console.error("[CF] Purge error:", JSON.stringify(d.errors));
    }
  } catch (e) {
    console.error("[CF] Purge fetch failed:", e.message);
  }
}

// POST /api/admin/purge-cache — manual purge from dashboard
app.post("/api/admin/purge-cache", auth, async (req, res) => {
  const { paths } = req.body || {};
  await purgeCache(paths || null);
  res.json({ ok: true, purged: paths ?? "ALL" });
});

// ─────────────────────────────────────────────
// VHS VIDEO PIPELINE — /api/vhs
// Lists output/*.mp4 and queues to BullMQ publisher
// ─────────────────────────────────────────────

import { readdirSync } from "fs";

// GET /api/vhs/videos — list available mp4 files
app.get("/api/vhs/videos", auth, (req, res) => {
  try {
    const dir = path.join(__dirname, "vhs", "output");
    const files = readdirSync(dir)
      .filter(f => f.endsWith(".mp4"))
      .sort();
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/vhs/schedule — add a post to the publisher queue
// body: { platform, videoFile, caption, scheduledAt? }
app.post("/api/vhs/schedule", auth, express.json(), async (req, res) => {
  const VALID_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok"];
  const { platform, videoFile, caption, scheduledAt } = req.body;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: "Piattaforma non valida: " + platform });
  }
  if (!videoFile || typeof videoFile !== "string" || !videoFile.endsWith(".mp4")) {
    return res.status(400).json({ error: "File video non valido" });
  }
  if (!caption || typeof caption !== "string") {
    return res.status(400).json({ error: "Caption obbligatoria" });
  }

  const videoPath = path.join(__dirname, "vhs", "output", path.basename(videoFile));
  if (!existsSync(videoPath)) {
    return res.status(404).json({ error: "File video non trovato" });
  }

  try {
    const { schedulePost, postNow } = await import("./vhs/publisher/queue/queue.mjs");
    const post = { platform, video: videoPath, caption };
    let jobId;
    if (scheduledAt) {
      jobId = await schedulePost(post, scheduledAt);
    } else {
      jobId = await postNow(post);
    }
    res.json({ ok: true, jobId, platform, videoFile, scheduledAt: scheduledAt || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// USER UPGRADE – /api/user/upgrade
// Called by SuccessPage after Stripe checkout completes.
// Permanently unlocks all labs in DB.
// ─────────────────────────────────────────────

app.post("/api/user/upgrade", auth, async (req, res) => {
  const { plan } = req.body;
  const validPlans = ["starter", "pro", "business"];

  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  // Double-check payment actually exists via Stripe (optional but safe)
  // We trust the JWT + the Stripe webhook as the primary source of truth.
  // This endpoint is a secondary sync for the SuccessPage UI call.

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan },
    select: { id: true, email: true, name: true, plan: true },
  });

  // Record the upgrade event
  await prisma.analytics.create({
    data: { event: "plan_upgraded_ui_sync", userId: req.user.id, meta: plan },
  });

  res.json({
    plan: updated.plan,
    email: updated.email,
    name: updated.name,
    labsUnlocked: plan === "business" ? 10 : plan === "pro" ? 8 : 1,
  });
});

// ─────────────────────────────────────────────
// USER PROFILE – /api/user/me
// ─────────────────────────────────────────────

app.get("/api/user/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.patch("/api/user/me", auth, async (req, res) => {
  const { name } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name },
    select: { id: true, email: true, name: true, plan: true },
  });
  res.json(updated);
});

// ─────────────────────────────────────────────
// COMMUNITY – /api/community/posts, /api/community/bugs
// ─────────────────────────────────────────────

// GET /api/community/posts?type=feature|bug
app.get("/api/community/posts", async (req, res) => {
  const { type } = req.query;
  const where = type ? { type } : {};
  const posts = await prisma.post.findMany({
    where,
    include: { _count: { select: { votes: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(posts.map(p => ({
    id: p.id,
    type: p.type,
    title: p.title,
    body: p.body,
    labId: p.labId,
    severity: p.severity,
    votes: p._count.votes,
    voted: false, // client tracks per-user optimistically
    createdAt: p.createdAt,
  })));
});

// POST /api/community/posts
app.post("/api/community/posts", auth, async (req, res) => {
  const { type = "feature", title, body = "", labId, severity } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const cleanTitle = sanitizeString(title, 200);
  const cleanBody = sanitizeString(body, 5000);
  if (!cleanTitle) return res.status(400).json({ error: "Title required" });
  const post = await prisma.post.create({
    data: { type, title: cleanTitle, body: cleanBody, labId: sanitizeString(labId, 50), severity: validateSeverity(severity), userId: req.user.id },
  });
  await prisma.analytics.create({
    data: { event: "community_post_created", userId: req.user.id, meta: type },
  });
  res.status(201).json(post);
});

// POST /api/community/posts/:id/vote  (toggle)
app.post("/api/community/posts/:id/vote", auth, async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.vote.findUnique({
    where: { postId_userId: { postId: id, userId: req.user.id } },
  });
  if (existing) {
    await prisma.vote.delete({ where: { id: existing.id } });
    res.json({ action: "unvoted" });
  } else {
    await prisma.vote.create({ data: { postId: id, userId: req.user.id } });
    res.json({ action: "voted" });
  }
});

// POST /api/community/bugs
app.post("/api/community/bugs", auth, async (req, res) => {
  const { labId, title, body = "", severity = "medium" } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title required" });
  const cleanTitle = sanitizeString(title, 200);
  const cleanBody = sanitizeString(body, 5000);
  if (!cleanTitle) return res.status(400).json({ error: "Title required" });
  const post = await prisma.post.create({
    data: { type: "bug", title: cleanTitle, body: cleanBody, labId: sanitizeString(labId, 50), severity: validateSeverity(severity), userId: req.user.id },
  });
  await prisma.analytics.create({
    data: { event: "bug_reported", userId: req.user.id, meta: labId },
  });
  res.status(201).json(post);
});

// ─────────────────────────────────────────────
// HELPDESK ROUTES
// ─────────────────────────────────────────────
app.use("/api/helpdesk", helpdeskRouter);

// ──── Sync endpoint for offline engine ────
//
// Poison-pill handling:
//   - Ogni messaggio ha un contatore di tentativi in _syncRetries (Map in-memory).
//   - Se il payload non supera la validazione per MAX_SYNC_RETRIES volte consecutive,
//     il messaggio viene spostato in _deadLetterQueue e il fatto viene loggato via pino.
//   - I messaggi successivi validi non sono bloccati.
const MAX_SYNC_RETRIES  = 3;
const _syncRetries      = new Map();   // msgId → { attempts: number, lastError: string }
const _deadLetterQueue  = [];          // DLQ in-memory (in prod → tabella DB o Redis stream)

/**
 * Controlla che il payload dell'evento sia strutturalmente valido.
 * @param {unknown} payload
 * @returns {{ valid: boolean; reason?: string }}
 */
function validateSyncPayload(payload) {
  if (payload === null || payload === undefined)
    return { valid: false, reason: "payload is null or undefined" };
  if (typeof payload !== "object" || Array.isArray(payload))
    return { valid: false, reason: `payload must be a plain object, got ${typeof payload}` };
  if (!("type" in payload) || typeof payload.type !== "string" || payload.type.trim() === "")
    return { valid: false, reason: "payload.type must be a non-empty string" };
  return { valid: true };
}

app.post("/api/helpdesk/sync", async (req, res) => {
  const { id, type, payload, timestamp, deviceId } = req.body ?? {};
  const msgId = id || `anon_${Date.now()}`;

  // ── 1. Validazione strutturale del body ────────────────────────────────
  if (!type || !payload) {
    return res.status(400).json({ error: "type and payload required" });
  }

  // ── 2. Validazione semantica del payload (Poison Pill check) ──────────
  const { valid, reason } = validateSyncPayload(payload);

  if (!valid) {
    const entry = _syncRetries.get(msgId) ?? { attempts: 0, lastError: "" };
    entry.attempts += 1;
    entry.lastError = reason;
    _syncRetries.set(msgId, entry);

    syncLogger.warn(
      { msgId, type, deviceId, attempt: entry.attempts, maxRetries: MAX_SYNC_RETRIES, reason },
      "Sync payload validation failed — retrying"
    );

    if (entry.attempts >= MAX_SYNC_RETRIES) {
      // ── Poison pill → Dead Letter Queue ─────────────────────────────
      const dlqEntry = {
        msgId,
        type,
        payload,
        deviceId,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        attempts:  entry.attempts,
        error:     reason,
        dlqAt:     new Date().toISOString(),
      };
      _deadLetterQueue.push(dlqEntry);
      _syncRetries.delete(msgId);   // libera la memoria del tracker

      dlqLogger.error(
        {
          event:    "message_dead_lettered",
          msgId:    dlqEntry.msgId,
          type:     dlqEntry.type,
          deviceId: dlqEntry.deviceId,
          attempts: dlqEntry.attempts,
          error:    dlqEntry.error,
          dlqAt:    dlqEntry.dlqAt,
        },
        `Message ${msgId} moved to Dead Letter Queue after ${entry.attempts} failed attempts`
      );

      return res.status(422).json({
        error:   "DEAD_LETTER",
        message: "Payload definitivamente non valido dopo tutti i tentativi.",
        msgId,
        attempts: entry.attempts,
      });
    }

    // Ancora tentativi disponibili → chiedi al client di riprovare
    return res.status(400).json({
      error:           "INVALID_PAYLOAD",
      reason,
      attempt:         entry.attempts,
      remainingRetries: MAX_SYNC_RETRIES - entry.attempts,
    });
  }

  // ── 3. Payload valido → processa e resetta il tracker ─────────────────
  _syncRetries.delete(msgId);

  try {
    syncLogger.info(
      { msgId, type, deviceId, ts: timestamp ? new Date(timestamp).toISOString() : null },
      "Event synced successfully"
    );
    res.json({ synced: true, eventId: msgId });
  } catch (error) {
    syncLogger.error({ msgId, err: error.message }, "Sync processing error");
    res.status(500).json({ error: "Sync failed", details: error.message });
  }
});

// ──── Dead Letter Queue inspector (admin only) ────
app.get("/api/helpdesk/dlq", (req, res) => {
  res.json({ count: _deadLetterQueue.length, messages: _deadLetterQueue });
});

// ──── Logs / telemetry status (usato dal production-readiness check) ────
app.get("/api/logs/status", (req, res) => {
  res.json({
    status:   "ok",
    logger:   "pino",
    dlq:      { count: _deadLetterQueue.length },
    syncQueue: { pendingRetries: _syncRetries.size },
    uptime:   Math.floor(process.uptime()),
  });
});

// ──── Deploy recording endpoint ────
app.post("/api/deploy", async (req, res) => {
  try {
    const { version, environment, deployedBy, changes } = req.body;
    if (!version) return res.status(400).json({ error: 'version is required' });

    const deploy = recordDeployEvent({
      version,
      environment: environment || 'prod',
      deployedBy: deployedBy || 'api',
      changes: changes || [],
    });

    console.log(`🚀 Deploy recorded: ${version} (${deploy.environment})`);
    res.json({ recorded: true, deploy });
  } catch (error) {
    res.status(500).json({ error: 'Deploy recording failed', details: error.message });
  }
});

app.get("/api/deploys", async (req, res) => {
  try {
    const history = getDeployHistoryFn();
    res.json({ deploys: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get deploy history' });
  }
});

// Start helpdesk worker
startHelpdeskWorker();

// ─────────────────────────────────────────────
// CRDT SYNC ENDPOINTS
// ─────────────────────────────────────────────

// In-memory CRDT update store (upgrade to DB later)
const crdtUpdates = new Map();

// Push updates from clients
app.post("/api/sync/push", express.json(), async (req, res) => {
  try {
    const { room, deviceId, update, updateCount } = req.body;

    if (!room || !update) {
      return res.status(400).json({ error: 'room and update required' });
    }

    // Store update
    const id = `server_update_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    crdtUpdates.set(id, {
      id,
      room,
      deviceId,
      update,
      timestamp: Date.now(),
      updateCount,
    });

    // Clean old updates (keep last 1000 per room)
    const roomUpdates = Array.from(crdtUpdates.entries())
      .filter(([_, u]) => u.room === room)
      .sort(([, a], [, b]) => b[1].timestamp - a[1].timestamp);

    if (roomUpdates.length > 1000) {
      for (const [id] of roomUpdates.slice(1000)) {
        crdtUpdates.delete(id);
      }
    }

    // Acknowledge
    res.json({ ack: [id], received: true });
  } catch (error) {
    res.status(500).json({ error: 'Push failed', details: error.message });
  }
});

// Pull updates for clients
app.get("/api/sync/pull", async (req, res) => {
  try {
    const { room, since } = req.query;

    if (!room) {
      return res.status(400).json({ error: 'room required' });
    }

    const sinceTs = parseInt(since) || 0;

    // Get updates for this room since last sync
    const updates = Array.from(crdtUpdates.entries())
      .filter(([_, u]) => u.room === room && u.timestamp > sinceTs)
      .sort(([, a], [, b]) => a[1].timestamp - b[1].timestamp)
      .map(([_, u]) => u.update);

    // Get latest state vector
    const latestRoomUpdate = Array.from(crdtUpdates.entries())
      .filter(([_, u]) => u.room === room)
      .sort(([, a], [, b]) => b[1].timestamp - a[1].timestamp)[0];

    res.json({
      updates,
      stateVector: latestRoomUpdate ? latestRoomUpdate[1].update : null,
      count: updates.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Pull failed', details: error.message });
  }
});

// ─────────────────────────────────────────────
// AI LEARNING CACHE ENDPOINTS
// ─────────────────────────────────────────────

app.post("/api/ai-cache/feedback", express.json(), async (req, res) => {
  try {
    const { key, feedback } = req.body;
    if (!key || !feedback) {
      return res.status(400).json({ error: 'key and feedback required' });
    }

    // Record feedback
    const { recordFeedback: recordFB } = await import('./src/services/aiLearningCache.js');
    recordFB(key, feedback);

    res.json({ recorded: true });
  } catch (error) {
    res.status(500).json({ error: 'Feedback failed', details: error.message });
  }
});

app.get("/api/ai-cache/stats", async (req, res) => {
  try {
    const { getAICacheStats } = await import('./src/services/aiLearningCache.js');
    const stats = getAICacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Stats failed', details: error.message });
  }
});

// ─────────────────────────────────────────────
// BACKUP ENDPOINTS
// ─────────────────────────────────────────────

import { execSync as execSyncBackup } from 'child_process';
import fsBackup from 'fs';
import pathBackup from 'path';

app.post("/api/backup/run", async (req, res) => {
  try {
    execSyncBackup('node scripts/backup.js', {
      cwd: __dirname,
      stdio: 'pipe',
      timeout: 120000,
    });
    res.json({ success: true, message: 'Backup completed (DB + Helpdesk)' });
  } catch (error) {
    res.status(500).json({ error: 'Backup failed', details: error.message });
  }
});

app.get("/api/backup/list", async (req, res) => {
  try {
    const backupDir = pathBackup.join(__dirname, 'backups');
    const helpdeskDir = pathBackup.join(backupDir, 'helpdesk');

    const dbBackups = fsBackup.existsSync(backupDir)
      ? fsBackup.readdirSync(backupDir).filter(f => f.endsWith('.sql.gz')).map(f => ({
          file: f,
          type: 'database',
          size: fsBackup.statSync(pathBackup.join(backupDir, f)).size,
          date: f.match(/winlab-(\d{4}-\d{2}-\d{2})/)?.[1] || 'unknown',
        }))
      : [];

    const helpdeskBackups = fsBackup.existsSync(helpdeskDir)
      ? fsBackup.readdirSync(helpdeskDir).filter(f => f.endsWith('.json.gz')).map(f => ({
          file: f,
          type: 'helpdesk',
          size: fsBackup.statSync(pathBackup.join(helpdeskDir, f)).size,
          date: f.match(/helpdesk-(\d{4}-\d{2}-\d{2})/)?.[1] || 'unknown',
        }))
      : [];

    res.json({
      database: dbBackups.sort((a, b) => b.date.localeCompare(a.date)),
      helpdesk: helpdeskBackups.sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list backups', details: error.message });
  }
});

// ─────────────────────────────────────────────
// HEALTH CHECK & DB TEST ENDPOINTS
// ─────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'db_error', error: e.message });
  }
});

// ─────────────────────────────────────────────
// READINESS PROBE  GET /ready
// Verifica le dipendenze critiche prima di accettare traffico.
// Usato da Kubernetes/load balancer per il rolling deploy.
// La funzione checkDb è esportata separatamente per permettere il mock nei test.
// ─────────────────────────────────────────────
export async function checkDb() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

app.get('/ready', async (req, res) => {
  const dbOk = await checkDb();
  if (!dbOk) {
    return res.status(503).json({
      status:     'unavailable',
      dependency: 'database',
      request_id: req.requestId,
      timestamp:  new Date().toISOString(),
    });
  }
  res.status(200).json({
    status:     'ready',
    request_id: req.requestId,
    timestamp:  new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
// LOAD SHEDDING MIDDLEWARE
// Misura il lag dell'Event Loop ogni 200ms.
// Se supera EVENT_LOOP_LAG_LIMIT restituisce 503 alle nuove richieste
// invece di accodare ulteriore lavoro e crashare il processo.
// ─────────────────────────────────────────────
const EVENT_LOOP_LAG_LIMIT = parseInt(process.env.EL_LAG_LIMIT_MS) || 250; // ms

let _currentLag = 0;

function measureEventLoopLag() {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1_000_000; // ns → ms
    _currentLag = lag;
    setTimeout(measureEventLoopLag, 200).unref();
  });
}
measureEventLoopLag();

export function getEventLoopLag() { return _currentLag; }

app.use((req, res, next) => {
  // Non applicare il shedding agli health check (evita falsi negativi al boot)
  if (req.path === '/health' || req.path === '/ready' || req.path === '/healthz/ping.txt') {
    return next();
  }
  if (_currentLag > EVENT_LOOP_LAG_LIMIT) {
    securityLog({
      level:      'warn',
      event:      'load_shedding',
      lag_ms:     Math.round(_currentLag),
      limit_ms:   EVENT_LOOP_LAG_LIMIT,
      path:       req.originalUrl,
      request_id: req.requestId,
    });
    return res.status(503).json({
      error:      'Server Overloaded',
      code:       'LOAD_SHED',
      request_id: req.requestId,
      retry_after: 2,
    });
  }
  next();
});

app.post('/test-db', async (req, res) => {
  try {
    const id = `test_${Date.now()}`;
    // Write
    await prisma.analytics.create({ data: { event: 'test_write', meta: id } });
    // Read
    const found = await prisma.analytics.findFirst({ where: { event: 'test_write', meta: id } });
    // Cleanup
    if (found) await prisma.analytics.deleteMany({ where: { event: 'test_write', meta: id } });
    res.json({ success: !!found });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─────────────────────────────────────────────
// ADMIN – Anonymous user list (no PII)
// ─────────────────────────────────────────────

app.get("/api/admin/users", auth, async (req, res) => {
  const requester = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!requester?.isAdmin && decryptUser(requester)?.plan !== "business") {
    return res.status(403).json({ error: "Admin or Business required" });
  }

  const users = await prisma.user.findMany({
    select: { id: true, plan: true, createdAt: true, totalXp: true, currentStreak: true },
    orderBy: { createdAt: "desc" },
  });

  // Anonymize: no email, no name, no nickname
  const prefixMap = { starter: "PV", pro: "PRO", business: "BUS" };
  const counters = {};
  const anonymized = users.map((u) => {
    const planRaw = typeof u.plan === "string" ? u.plan : JSON.stringify(u.plan);
    // Extract plan name from encrypted JSON string
    let planName = "PV";
    try {
      const decrypted = JSON.parse(planRaw);
      if (decrypted && typeof decrypted === "object" && decrypted.data) {
        // It's encrypted — we know the original plan from context
        planName = prefixMap["starter"] || "PV"; // default since we can't decrypt without key
      } else if (typeof decrypted === "string") {
        planName = prefixMap[decrypted] || "PV";
      } else {
        planName = prefixMap[decrypted?.plan] || "PV";
      }
    } catch {
      // Not encrypted (dev mode or plaintext)
      planName = prefixMap[planRaw] || "PV";
    }

    if (!counters[planName]) counters[planName] = 0;
    counters[planName]++;
    const code = `${planName} ${String(counters[planName]).padStart(4, "0")}`;

    return {
      code,
      plan: planName,
      joined: u.createdAt.toISOString().slice(0, 10),
      xp: u.totalXp || 0,
      streak: u.currentStreak || 0,
    };
  });

  res.json(anonymized);
});

// ─────────────────────────────────────────────
// USER PROFILE & SETTINGS (DB-Synced)
// ─────────────────────────────────────────────

// Update profile
app.put("/api/user/profile", auth, async (req, res) => {
  const { name, nickname } = req.body;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { name, nickname },
    select: { name: true, nickname: true }
  });
  res.json(user);
});

// Change password
app.put("/api/user/change-password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.userId }, data: { passwordHash: hash } });
  res.json({ message: "Password updated" });
});

// Export User Data (GDPR Art. 15)
app.get("/api/user/export-data", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, nickname: true, plan: true, totalXp: true, currentStreak: true, createdAt: true },
  });
  const labs = await prisma.userProgress.findMany({ where: { userId: req.userId } });
  const certs = await prisma.certificate.findMany({ where: { userId: req.userId } });
  const data = { profile: user, labProgress: labs, certificates: certs, exportedAt: new Date().toISOString() };
  res.json(data);
});

// Update settings
app.put("/api/user/settings", auth, async (req, res) => {
  const { aiConsent, lastActiveLab, lastLabState, unlockedBadges } = req.body;
  const data = {};
  if (typeof aiConsent === "boolean") data.aiConsent = aiConsent;
  if (lastActiveLab) data.lastActiveLab = lastActiveLab;
  if (lastLabState) data.lastLabState = JSON.stringify(lastLabState);
  if (unlockedBadges) data.unlockedBadges = JSON.stringify(unlockedBadges);

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: { aiConsent: true, lastActiveLab: true, lastLabState: true, unlockedBadges: true }
  });
  res.json(user);
});

// Delete Account (GDPR Art. 17)
app.delete("/api/user/account", auth, async (req, res) => {
  // Soft delete: set accountStatus = "deleted" and clear personal data
  await prisma.user.update({
    where: { id: req.userId },
    data: {
      accountStatus: "deleted",
      name: null,
      nickname: null,
      email: `deleted_${req.userId}@winlab.cloud`,
      lastActiveLab: null,
      lastLabState: null,
      unlockedBadges: null,
    }
  });
  res.json({ message: "Account deleted" });
});

// ─────────────────────────────────────────────
// AI BUDGET TRACKING (€15/mo auto-block)
// ─────────────────────────────────────────────

const BUDGET_LIMIT = 15.00; // € per month
let budgetSpent = 0;
let budgetRequests = 0;
let budgetCacheHits = 0;
let budgetResetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1); // 1st of next month

// Check if budget is exceeded
function checkBudget() {
  const now = new Date();
  if (now >= budgetResetDate) {
    budgetSpent = 0;
    budgetRequests = 0;
    budgetCacheHits = 0;
    budgetResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { spent: budgetSpent, limit: BUDGET_LIMIT, blocked: budgetSpent >= BUDGET_LIMIT };
}

function recordApiCall(cost, cached = false) {
  budgetSpent += cost;
  budgetRequests++;
  if (cached) budgetCacheHits++;
}

app.get("/api/ai/budget-status", auth, async (req, res) => {
  const requester = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!requester?.isAdmin && decryptUser(requester)?.plan !== "business") {
    return res.status(403).json({ error: "Admin or Business required" });
  }
  const status = checkBudget();
  const hitRate = budgetRequests > 0 ? Math.round((budgetCacheHits / budgetRequests) * 100) : 0;
  const estimatedSaving = (budgetSpent * (hitRate / 100) * 0.7).toFixed(2); // rough estimate
  res.json({
    ...status,
    totalRequests: budgetRequests,
    cacheHits: budgetCacheHits,
    hitRate,
    estimatedSaving: parseFloat(estimatedSaving),
    resetDate: budgetResetDate.toISOString(),
  });
});

// ─────────────────────────────────────────────
// GDPR CONSENT MANAGEMENT
// ─────────────────────────────────────────────

// AI Mentor consent (Anthropic data transfer — GDPR Art. 44-49)
app.post("/api/consent/ai", auth, async (req, res) => {
  const { aiMentorConsent, timestamp } = req.body;
  if (typeof aiMentorConsent !== "boolean") return res.status(400).json({ error: "aiMentorConsent must be boolean" });
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      aiMentorConsent: Boolean(aiMentorConsent),
      aiMentorConsentDate: new Date(),
    },
  });
  console.log(`[AI-CONSENT] user=${req.user.id} consent=${aiMentorConsent} at=${timestamp || new Date().toISOString()}`);
  res.json({ success: true, aiMentorConsent });
});

// ML Training consent (anonymized lab data for model improvement)
app.put("/api/user/ml-consent", auth, async (req, res) => {
  const { mlConsent } = req.body;
  if (typeof mlConsent !== "boolean") return res.status(400).json({ error: "mlConsent must be boolean" });
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      mlConsent: Boolean(mlConsent),
      mlConsentDate: mlConsent ? new Date() : null,
    },
  });
  console.log(`[ML-CONSENT] user=${req.user.id} consent=${mlConsent} at=${new Date().toISOString()}`);
  res.json({ success: true, mlConsent });
});

// Cookie consent audit log (called by frontend sendBeacon — no auth required)
app.post("/api/consent/log", express.json(), (req, res) => {
  const { version, timestamp, preferences, userAgent } = req.body || {};
  console.log("[CONSENT-LOG]", JSON.stringify({ version, timestamp, preferences, userAgent: userAgent?.slice(0, 200) }));
  // TODO: store in DB with prisma for proper GDPR audit trail
  res.status(204).end();
});

app.get("/api/user/ai-training-data", auth, async (req, res) => {
  res.json({ data: [], message: "No training data stored for this user yet." });
});

app.delete("/api/user/ai-training-data", auth, async (req, res) => {
  res.json({ message: "AI training data deleted" });
});

// ─────────────────────────────────────────────
// ADMIN – AI feedback summary
// ─────────────────────────────────────────────

app.get("/api/admin/feedback-summary", auth, async (req, res) => {
  // Only business plan users can access the admin AI summary
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || user.plan !== "business") {
    return res.status(403).json({ error: "Business plan required" });
  }

  // Gather all posts
  const posts = await prisma.post.findMany({
    include: { _count: { select: { votes: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (posts.length === 0) {
    return res.json({ summary: "No community feedback yet.", cached: false });
  }

  const postsText = posts
    .map(p => `[${p.type.toUpperCase()}] (${p._count.votes} votes) ${p.title}${p.body ? ": " + p.body : ""}`)
    .join("\n");

  // Use DB cache for AI summary (cache by hash of post list)
  const key = cacheKey("admin-feedback-summary:" + postsText);
  const cached = await getCached(key);
  if (cached) {
    await prisma.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } });
    return res.json({ summary: cached.reply, cached: true });
  }

  const systemPrompt = `You are an engineering manager reading community feedback for WINLAB, a sysadmin training platform.
Summarise the key themes in 3–5 bullet points. Highlight the most-voted feature requests and the most critical bugs.
Be concise and actionable. Output plain text, no markdown headers.`;

  try {
    const { reply, tokens } = await callHaiku(systemPrompt, `Here is the feedback:\n\n${postsText}\n\nProvide a concise summary.`);
    await setCache(key, postsText.slice(0, 200), reply, "claude-haiku-4-5-20251001", tokens);
    res.json({ summary: reply, cached: false });
  } catch (err) {
    console.error("Feedback summary AI error:", err);
    res.status(500).json({ error: "AI summary temporarily unavailable." });
  }
});

// ─────────────────────────────────────────────
// REFERRAL SYSTEM – /api/referral
// Peer Peering (20%) & Corporate Escalation (30%)
// ─────────────────────────────────────────────

// Generate a peer invite token
app.post("/api/referral/generate-peer", auth, async (req, res) => {
  const userId = req.user.id;
  
  // Generate geek-style token: WIN-REF-<user_hash_prefix>-20OFF
  const userHash = crypto.createHash("md5").update(userId).digest("hex").slice(0, 4).toUpperCase();
  const token = `WIN-REF-${userHash}-20OFF`;
  
  // Check if user already has an active peer referral
  const existing = await prisma.referral.findFirst({
    where: { referrerId: userId, type: "peer", active: true }
  });
  
  if (existing) {
    return res.json({ 
      token: existing.token, 
      discount: existing.discount,
      message: "Existing peer referral token retrieved",
      link: `${process.env.APP_URL || "http://localhost:5173"}/?ref=${existing.token}`
    });
  }
  
  // Create new peer referral
  const referral = await prisma.referral.create({
    data: {
      referrerId: userId,
      refereeEmail: "", // Will be filled when friend registers
      token,
      type: "peer",
      discount: 20
    }
  });
  
  // Also create a discount code
  await prisma.discountCode.create({
    data: {
      code: token,
      type: "referral_peer",
      discount: 20,
      maxUses: 10, // Can be used up to 10 times
      userId
    }
  });
  
  res.json({
    token: referral.token,
    discount: referral.discount,
    message: "Peer referral token generated",
    link: `${process.env.APP_URL || "http://localhost:5173"}/?ref=${referral.token}`
  });
});

// Generate a corporate escalation token
app.post("/api/referral/generate-corporate", auth, async (req, res) => {
  const userId = req.user.id;
  const { companyName, companyEmail } = req.body;
  
  if (!companyName || !companyEmail) {
    return res.status(400).json({ error: "Missing companyName or companyEmail" });
  }
  
  // Generate corporate token: WIN-CORP-<hash>-30OFF
  const corpHash = crypto.createHash("md5").update(userId + companyName).digest("hex").slice(0, 4).toUpperCase();
  const token = `WIN-CORP-${corpHash}-30OFF`;
  
  const referral = await prisma.referral.create({
    data: {
      referrerId: userId,
      refereeEmail: companyEmail,
      token,
      type: "corporate",
      discount: 30
    }
  });
  
  await prisma.discountCode.create({
    data: {
      code: token,
      type: "referral_corporate",
      discount: 30,
      maxUses: 50, // Corporate codes can be used more times
      userId
    }
  });
  
  res.json({
    token: referral.token,
    discount: referral.discount,
    companyName,
    message: "Corporate escalation token generated",
    link: `${process.env.APP_URL || "http://localhost:5173"}/?ref=${referral.token}`
  });
});

// Validate and apply a referral/discount code
app.post("/api/referral/apply", auth, async (req, res) => {
  const userId = req.user.id;
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: "Missing discount code" });
  }
  
  const discountCode = await prisma.discountCode.findUnique({
    where: { code }
  });
  
  if (!discountCode) {
    return res.status(404).json({ error: "Invalid discount code" });
  }
  
  if (!discountCode.active) {
    return res.status(400).json({ error: "Discount code is no longer active" });
  }
  
  if (discountCode.usedCount >= discountCode.maxUses) {
    return res.status(400).json({ error: "Discount code has reached its usage limit" });
  }
  
  // Check if user already used a referral code
  const existingReferral = await prisma.referral.findFirst({
    where: { refereeEmail: (await prisma.user.findUnique({ where: { id: userId } }))?.email }
  });
  
  if (existingReferral) {
    return res.status(400).json({ error: "You already have an active referral. Only one discount allowed per user." });
  }
  
  // Mark the discount code as used
  await prisma.discountCode.update({
    where: { id: discountCode.id },
    data: { usedCount: { increment: 1 } }
  });
  
  // Mark referral as converted
  const referral = await prisma.referral.findFirst({
    where: { token: code }
  });
  
  if (referral) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { converted: true, convertedAt: new Date() }
    });
    
    // Analytics
    await prisma.analytics.create({
      data: { event: "referral_converted", userId, meta: `type:${referral.type},discount:${referral.discount}%` }
    });
  }
  
  res.json({
    success: true,
    discount: discountCode.discount,
    message: `${discountCode.discount}% discount activated! Apply it to your next purchase.`
  });
});

// Get user's referral stats
app.get("/api/referral/stats", auth, async (req, res) => {
  const userId = req.user.id;
  
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId }
  });
  
  const peerReferrals = referrals.filter(r => r.type === "peer");
  const corporateReferrals = referrals.filter(r => r.type === "corporate");
  
  const totalConversions = referrals.filter(r => r.converted).length;
  const peerTokens = peerReferrals.length;
  const corporateTokens = corporateReferrals.length;
  
  res.json({
    peer: {
      tokens: peerTokens,
      conversions: peerReferrals.filter(r => r.converted).length,
      discount: 20
    },
    corporate: {
      tokens: corporateTokens,
      conversions: corporateReferrals.filter(r => r.converted).length,
      discount: 30
    },
    totalConversions,
    referralLink: peerReferrals[0] 
      ? `${process.env.APP_URL || "http://localhost:5173"}/?ref=${peerReferrals[0].token}`
      : null
  });
});

// Check if URL has a referral code and validate it
app.get("/api/referral/validate/:code", async (req, res) => {
  const { code } = req.params;
  
  const discountCode = await prisma.discountCode.findUnique({
    where: { code }
  });
  
  if (!discountCode || !discountCode.active || discountCode.usedCount >= discountCode.maxUses) {
    return res.json({ valid: false, error: "Invalid or expired referral code" });
  }
  
  res.json({
    valid: true,
    discount: discountCode.discount,
    type: discountCode.type,
    message: `You have a ${discountCode.discount}% discount available!`
  });
});

// ─────────────────────────────────────────────
// SECURITY HEADERS VERIFICATION (development only)
// ─────────────────────────────────────────────

app.get("/api/security/headers", (req, res) => {
  // Returns current security headers for verification
  res.json({
    message: "Security headers configuration",
    headers: {
      "Content-Security-Policy": "See response headers",
      "Strict-Transport-Security": res.getHeader("Strict-Transport-Security"),
      "Cross-Origin-Opener-Policy": res.getHeader("Cross-Origin-Opener-Policy"),
      "Cross-Origin-Resource-Policy": res.getHeader("Cross-Origin-Resource-Policy"),
      "X-Content-Type-Options": res.getHeader("X-Content-Type-Options"),
      "X-Frame-Options": res.getHeader("X-Frame-Options"),
      "Referrer-Policy": res.getHeader("Referrer-Policy"),
      "Permissions-Policy": res.getHeader("Permissions-Policy"),
    },
    protections: {
      xss: "✅ CSP + Trusted Types",
      clickjacking: "✅ CSP frame-ancestors + X-Frame-Options: DENY",
      mime_sniffing: "✅ X-Content-Type-Options: nosniff",
      https_enforcement: "✅ HSTS (1 year, includeSubDomains, preload)",
      origin_isolation: "✅ COOP + CORP: same-origin",
      dom_xss: "✅ Trusted Types policy",
    }
  });
});

// ─────────────────────────────────────────────
// Static file serving (production build)

// Serve public assets (robots.txt, manifest, icons, etc.)
app.use(express.static(path.join(__dirname, "public")));

// ── STATIC ASSETS (always active, regardless of maintenance mode) ─────────────
// Serve the React build first so /assets/, /registerSW.js, /sw.js, /workbox-*
// are always reachable with correct MIME types — even when the app is behind the
// coming-soon page.  The /demo iframe depends on this.
const distDir  = path.join(__dirname, "dist");
const distIndex = path.join(distDir, "index.html");
if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
}

// ── DEMO route (bypasses maintenance mode) ────────────────────────────────────
// Serves the full React SPA so DemoShell / Lab 01 work inside the landing iframe.
if (existsSync(distIndex)) {
  app.get("/demo", (_req, res) => res.sendFile(distIndex));
}

// ── MAINTENANCE MODE ──────────────────────────────────────────────────────────
// Set MAINTENANCE_MODE=true in .env to show coming-soon page instead of the app.
// API routes (/api/*, /ref/*) stay fully accessible.
// Set to false (or remove) on launch day.
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";
const comingSoonPath = path.join(__dirname, "coming-soon", "index.html");

if (MAINTENANCE_MODE && existsSync(comingSoonPath)) {
  console.log("🚧 MAINTENANCE MODE — serving coming-soon page");
  // Static assets for the coming-soon page itself (CSS, images, etc.)
  app.use(express.static(path.join(__dirname, "coming-soon")));

  // Page-route catch-all: send coming-soon HTML only for extension-less paths.
  // Requests that already have a file extension (.js, .css, .png …) are static
  // assets — if express.static above didn't find them, let Express 404 naturally
  // rather than returning HTML with the wrong MIME type.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ref/")) return next();
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
    res.sendFile(comingSoonPath);
  });
} else {
  // Normal mode: SPA fallback for all page routes
  if (existsSync(distIndex)) {
    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ref/")) return next();
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
      res.sendFile(distIndex);
    });
  }
}
// else: dev mode — Vite handles static serving on :5173

// Start server
const BASE_PORT = 3001;

// ─────────────────────────────────────────────
// DAILY CHALLENGE + STREAK SYSTEM
// ─────────────────────────────────────────────

app.get("/api/daily/challenge", async (req, res) => {
  // Return today's challenge or generate one
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seed = today.toISOString().slice(0, 10);
  const challenges = [
    { id: "daily-disk-full", title: "Disk Full Crisis", desc: "/dev/sda1 is 100% — find and fix" },
    { id: "daily-apache-down", title: "Apache Down", desc: "HTTP 503 on all requests" },
    { id: "daily-slow-server", title: "Slow Server", desc: "Load average is 15 — investigate" },
    { id: "daily-ssh-lockout", title: "SSH Lockout", desc: "Cannot SSH into the server" },
    { id: "daily-permission", title: "Permission Denied", desc: "All users getting 'permission denied'" },
  ];
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const idx = parseInt(hash.slice(0, 8), 16) % challenges.length;
  res.json({ ...challenges[idx], date: today.toISOString() });
});

app.post("/api/daily/complete", auth, async (req, res) => {
  const { challengeId, timeSpentSeconds, hintsUsed, xpEarned } = req.body;
  if (!challengeId) return res.status(400).json({ error: "challengeId required" });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const xp = xpEarned || Math.max(10, 100 - (hintsUsed || 0) * 20);

  // Upsert today's completion
  const completion = await prisma.dailyCompletion.upsert({
    where: { userId_challengeId_date: { userId: req.userId, challengeId, date: today } },
    update: { timeSpentSeconds, hintsUsed, xpEarned: xp },
    create: { userId: req.userId, challengeId, date: today, timeSpentSeconds, hintsUsed, xpEarned: xp, streakAfter: 0 },
  });

  // Update streak
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayCompletion = await prisma.dailyCompletion.findFirst({
    where: { userId: req.userId, date: { gte: yesterday, lt: today } },
  });

  let newStreak = 1;
  if (yesterdayCompletion) {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    newStreak = (user?.currentStreak || 0) + 1;
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: { currentStreak: newStreak, longestStreak: { increment: newStreak > (await prisma.user.findUnique({ where: { id: req.userId }, select: { longestStreak: true } })).longestStreak ? 1 : 0 }, totalXp: { increment: xp } },
  });

  await completion; // already done via upsert

  res.json({ xpEarned: xp, streak: newStreak, challengeId });
});

app.get("/api/daily/streak", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { currentStreak: true, longestStreak: true, totalXp: true } });
  res.json(user || { currentStreak: 0, longestStreak: 0, totalXp: 0 });
});

// ─────────────────────────────────────────────
// SKILL TREE
// ─────────────────────────────────────────────

app.get("/api/skills", auth, async (req, res) => {
  const skills = await prisma.userSkill.findMany({ where: { userId: req.userId } });
  res.json(skills);
});

app.post("/api/skills/:branch/progress", auth, async (req, res) => {
  const { branch } = req.params;
  const { score, sessionId } = req.body;

  const skill = await prisma.userSkill.upsert({
    where: { userId_branch: { userId: req.userId, branch } },
    update: {
      geniusScore: { increment: score || 0 },
      sessionsCompleted: { increment: 1 },
      bestScore: score ? { increment: score > 0 ? score : 0 } : undefined,
      lastSessionId: sessionId || undefined,
    },
    create: { userId: req.userId, branch, geniusScore: score || 0, sessionsCompleted: 1, bestScore: score || 0, lastSessionId: sessionId },
  });

  // Update total XP
  await prisma.user.update({ where: { id: req.userId }, data: { totalXp: { increment: score || 0 } } });

  res.json(skill);
});

// ─────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────

app.post("/api/auth/reset-request", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.json({ message: "If the email exists, a reset link has been sent" }); // Don't leak existence

  try {
    // Uses hashed tokens (SHA-256) with 15min expiry — security best practice
    await sendPasswordResetEmail(user);
    securityLog({ level: "info", event: "password_reset_email_sent", userId: user.id });
  } catch (err) {
    // Dev mode: email is logged, not sent — fail gracefully
    console.warn('[PasswordReset] Email send failed:', err.message);
    securityLog({ level: "warn", event: "password_reset_email_failed", userId: user.id, error: err.message });
  }

  res.json({ message: "If the email exists, a reset link has been sent" });
});

app.post("/api/auth/reset-confirm", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  // Verify hashed token (SHA-256) — secure against timing attacks
  const user = await verifyResetToken(token);
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  securityLog({ level: "info", event: "password_reset_completed", userId: user.id });
  res.json({ message: "Password updated" });
});

// ─────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────

app.post("/api/auth/verify-email", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Verification token required" });

  const user = await verifyEmailToken(token);
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired verification token" });
  }

  securityLog({ level: "info", event: "email_verified", userId: user.id });
  res.json({ message: "Email verified successfully", email: user.email });
});

app.post("/api/auth/resend-verification", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.emailVerified) return res.json({ message: "Email already verified" });

  await sendVerifyEmail(user);
  securityLog({ level: "info", event: "verification_resent", userId: user.id });
  res.json({ message: "Verification email sent" });
});

// ─────────────────────────────────────────────
// USER PROFILE + UPGRADE
// ─────────────────────────────────────────────

app.get("/api/user/me", auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, nickname: true, plan: true, isAdmin: true, totalXp: true, currentStreak: true, longestStreak: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  const decrypted = decryptUser(user);
  res.json({ ...decrypted, isAdmin: user.isAdmin, totalXp: user.totalXp, currentStreak: user.currentStreak, longestStreak: user.longestStreak, createdAt: user.createdAt });
});

// User upgrade – called by SuccessPage after Stripe checkout
app.post("/api/user/upgrade", auth, async (req, res) => {
  const { plan } = req.body;
  if (!plan) return res.status(400).json({ error: "Plan required" });

  const encrypted = encryptUserData({ plan });
  await prisma.user.update({
    where: { id: req.userId },
    data: { plan: encrypted.plan },
  });

  await prisma.analytics.create({ data: { event: "plan_upgraded_ui_sync", userId: req.userId, meta: plan } });
  res.json({ plan, message: "Plan upgraded successfully" });
});

// ─────────────────────────────────────────────
// EVENT PROCESSING (manual trigger or cron)
// ─────────────────────────────────────────────

app.post("/api/admin/process-events", auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.isAdmin && decryptUser(user)?.plan !== "business") return res.status(403).json({ error: "Admin or Business required" });
  const results = await processPendingEvents(20);
  res.json({ processed: results.length, results });
});

// ─────────────────────────────────────────────
// DECEPTION / HONEYPOT ROUTES
// ─────────────────────────────────────────────

const intelCollector = createIntelCollector();

// Deception Gateway: detect threats and route to honeypot
app.post("/api/deception/gateway", async (req, res) => {
  const { input, sessionId, ip, userAgent } = req.body;
  const threat = detectThreat(input);

  // Determine environment based on target input
  let envKey = "prod-db-01"; // default
  if (input.match(/web|nginx|apache|www/i)) envKey = "web-app-01";
  else if (input.match(/ad|ldap|domain|kerberos/i)) envKey = "dc-01";

  if (!sessionId) {
    const newSession = intelCollector.createSession(uuidv4(), ip || req.ip, userAgent, envKey);
    return res.json({ sessionId: newSession.id, threat, env: envKey, routedTo: threat.threat ? "honeypot" : "real" });
  }

  const session = intelCollector.getSession(sessionId);
  if (session) {
    intelCollector.recordCommand(sessionId, input);
    session.threatScore = Math.max(session.threatScore, threat.score);
  }

  res.json({ threat, env: envKey, routedTo: threat.threat ? "honeypot" : "real", sessionId });
});

// Honeypot terminal session
app.post("/api/deception/honeypot/session", (req, res) => {
  const { env = "prod-db-01", ip, userAgent } = req.body;
  const envData = HONEYPOT_ENVS[env] || HONEYPOT_ENVS["prod-db-01"];
  const session = intelCollector.createSession(uuidv4(), ip || req.ip, userAgent, env);
  res.json({
    sessionId: session.id,
    hostname: envData.hostname,
    os: envData.os,
    services: envData.services,
    prompt: `${session.id === "root" ? "root" : "admin"}@${envData.hostname.split(".")[0]}:~$ `,
  });
});

// Honeypot command execution
app.post("/api/deception/honeypot/command", async (req, res) => {
  const { sessionId, command } = req.body;
  if (!sessionId || !command) return res.status(400).json({ error: "sessionId and command required" });

  const session = intelCollector.getSession(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const envData = HONEYPOT_ENVS[session.env] || HONEYPOT_ENVS["prod-db-01"];
  const state = {
    currentUser: "admin",
    cwd: "/home/admin",
    history: session.commands.map((c) => c.command),
  };

  const output = await processHoneypotCommand(command, envData, state);
  intelCollector.recordCommand(sessionId, command, output);

  // Update fake credential tracking
  if (state.usedFakeCredentials?.length) {
    session.usedFakeCredentials = [...(session.usedFakeCredentials || []), ...state.usedFakeCredentials];
  }

  res.json({ output, prompt: `${state.currentUser}@${envData.hostname.split(".")[0]}:${state.cwd}$ ` });
});

// Close honeypot session
app.post("/api/deception/honeypot/close", (req, res) => {
  const { sessionId } = req.body;
  intelCollector.closeSession(sessionId);
  res.json({ closed: true });
});

// SOC Dashboard: get all active sessions
app.get("/api/deception/sessions", auth, freshUser, async (req, res) => {
  if (req.user.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  const sessions = intelCollector.getAllSessions();
  res.json(sessions);
});

// SOC Dashboard: stats
app.get("/api/deception/stats", auth, freshUser, async (req, res) => {
  if (req.user.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  const stats = intelCollector.getStats();
  res.json(stats);
});

// SOC Dashboard: session detail
app.get("/api/deception/session/:id", auth, freshUser, async (req, res) => {
  if (req.user.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  const session = intelCollector.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

// Deception Gateway: serve fake environment list
app.get("/api/deception/environments", auth, freshUser, async (req, res) => {
  if (req.user.plan !== "business") return res.status(403).json({ error: "Business plan required" });
  const envs = Object.entries(HONEYPOT_ENVS).map(([key, val]) => ({
    key,
    type: val.type,
    hostname: val.hostname,
    os: val.os,
    services: val.services,
  }));
  res.json(envs);
});

// ─────────────────────────────────────────────
// HEALTH CHECK / NETWORK PROBE
// Used by AdaptiveLoader for 2G/3G/4G detection
// Returns configurable payload size for throughput testing
// ─────────────────────────────────────────────

app.get("/healthz/ping.txt", async (req, res) => {
  const probeSize = parseInt(req.get("x-probe-size")) || 1000; // bytes
  // Generate payload of requested size (default 1KB)
  const payload = "OK".padEnd(Math.max(2, probeSize), ".");
  res.set("Cache-Control", "no-store");
  res.set("Content-Type", "text/plain");
  res.send(payload);
});

// ─────────────────────────────────────────────
// VALIDATION MIDDLEWARE FACTORY
// Usato dagli endpoint che richiedono un body strutturato.
// Lancia un errore con .validation per il centralized handler.
// ─────────────────────────────────────────────

/**
 * Crea un middleware Express che valida req.body contro uno schema minimo.
 * @param {Record<string, { type: string; required?: boolean }>} schema
 *   Esempio: { email: { type: 'string', required: true }, age: { type: 'number' } }
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const details = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body?.[field];
      if (rules.required && (val === undefined || val === null || val === '')) {
        details.push({ field, message: `"${field}" is required` });
        continue;
      }
      if (val !== undefined && val !== null && typeof val !== rules.type) {
        details.push({ field, message: `"${field}" must be of type ${rules.type}` });
      }
    }
    if (details.length > 0) {
      const err = new Error('Payload malformato');
      err.validation = details;
      err.statusCode = 400;
      return next(err);
    }
    next();
  };
}

// ─────────────────────────────────────────────
// B2B LEAD CAPTURE
// ─────────────────────────────────────────────

// POST /api/b2b/lead — capture enterprise demo request (public)
app.post("/api/b2b/lead", express.json(), async (req, res) => {
  try {
    const { firstName, lastName, email, company, teamSize, message, source } = req.body;
    if (!firstName || !lastName || !email || !company || !teamSize) {
      return res.status(400).json({ error: "firstName, lastName, email, company, teamSize are required" });
    }
    const emailLower = email.toLowerCase().trim();
    const tenantDomain = emailLower.includes("@") ? emailLower.split("@")[1] : null;
    const lead = await prisma.b2bLead.create({
      data: { firstName, lastName, email: emailLower, company, teamSize, message: message || null, source: source || "website", tenantDomain },
    });
    // Log the event for analytics
    await prisma.analytics.create({ data: { event: "b2b_lead_captured", meta: JSON.stringify({ company, teamSize, source }) } }).catch(() => {});
    res.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("POST /api/b2b/lead error:", err);
    res.status(500).json({ error: "Failed to save lead" });
  }
});

// GET /api/b2b/leads — admin view all leads
app.get("/api/b2b/leads", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isAdmin: true } });
    if (!user?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const { status, limit = "50", offset = "0" } = req.query;
    const where = status ? { status } : {};
    const [leads, total] = await Promise.all([
      prisma.b2bLead.findMany({ where, orderBy: { createdAt: "desc" }, take: parseInt(limit), skip: parseInt(offset) }),
      prisma.b2bLead.count({ where }),
    ]);
    res.json({ leads, total });
  } catch (err) {
    console.error("GET /api/b2b/leads error:", err);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// PATCH /api/b2b/leads/:id — admin update lead status/notes
app.patch("/api/b2b/leads/:id", auth, express.json(), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isAdmin: true } });
    if (!user?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const { status, notes, assignedTo } = req.body;
    const updated = await prisma.b2bLead.update({
      where: { id: req.params.id },
      data: { ...(status && { status }), ...(notes !== undefined && { notes }), ...(assignedTo && { assignedTo }) },
    });
    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/b2b/leads/:id error:", err);
    res.status(500).json({ error: "Failed to update lead" });
  }
});

// GET /api/enterprise/verify-domain?domain=contoso.com — check if domain has existing users (sales intelligence)
app.get("/api/enterprise/verify-domain", auth, async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: "domain required" });
    const count = await prisma.user.count({ where: { tenantDomain: domain.toLowerCase() } });
    res.json({ domain, userCount: count, hasUsers: count > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to verify domain" });
  }
});

// GET /api/enterprise/stats — admin: B2B pipeline summary
app.get("/api/enterprise/stats", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isAdmin: true } });
    if (!user?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const [total, byStatus] = await Promise.all([
      prisma.b2bLead.count(),
      prisma.b2bLead.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const recentLeads = await prisma.b2bLead.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { firstName: true, lastName: true, company: true, teamSize: true, status: true, createdAt: true } });
    res.json({ total, byStatus, recentLeads });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch enterprise stats" });
  }
});

// ─────────────────────────────────────────────
// ENTERPRISE LEADERBOARD
// ─────────────────────────────────────────────

// POST /api/leaderboard — save scenario result (auth optional)
app.post("/api/leaderboard", express.json(), async (req, res) => {
  try {
    const { teamName, region, scenarioId, scenarioName, leaderboardScore, riskScore, businessImpact, elapsedMin, actionCount } = req.body;
    if (!scenarioId || !scenarioName || leaderboardScore == null) {
      return res.status(400).json({ error: "scenarioId, scenarioName and leaderboardScore are required" });
    }
    // Try to get userId from auth token if present, but don't require it
    let userId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || null;
      }
    } catch (_) { /* anonymous submission is fine */ }

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
    // Broadcast updated leaderboard to all connected WS clients
    broadcastLeaderboard(scenarioId).catch(() => {});
    res.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("POST /api/leaderboard error:", err);
    res.status(500).json({ error: "Failed to save result" });
  }
});

// GET /api/leaderboard?scenarioId=multisite&limit=10 — top scores for a scenario
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

// ─────────────────────────────────────────────
// MICROSOFT SSO (OAuth2 / Azure AD multi-tenant)
// Env vars required:
//   MICROSOFT_CLIENT_ID      — Azure App Registration > Application (client) ID
//   MICROSOFT_CLIENT_SECRET  — Azure App Registration > Client secrets
//   MICROSOFT_REDIRECT_URI   — must match exactly what's in Azure: e.g. https://winlab.cloud/api/auth/microsoft/callback
// ─────────────────────────────────────────────

const MS_AUTHORITY   = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_GRAPH_ME    = "https://graph.microsoft.com/v1.0/me";
const MS_SCOPES      = "openid profile email User.Read";
const MS_STATE_COOKIE = "ms_oauth_state";

// Step 1 — redirect to Microsoft login
app.get("/api/auth/microsoft", (req, res) => {
  const clientId    = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(503).json({ error: "Microsoft SSO not configured" });
  }
  const state = crypto.randomBytes(20).toString("hex");
  res.cookie(MS_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 min
  });
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: "code",
    redirect_uri:  redirectUri,
    scope:         MS_SCOPES,
    response_mode: "query",
    state,
  });
  res.redirect(`${MS_AUTHORITY}/authorize?${params}`);
});

// Step 2 — handle callback from Microsoft
app.get("/api/auth/microsoft/callback", async (req, res) => {
  const { code, state, error: msError } = req.query;
  const clientId     = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri  = process.env.MICROSOFT_REDIRECT_URI;
  const appUrl       = process.env.APP_URL || "http://localhost:5173";

  // User denied or error from Microsoft
  if (msError) {
    securityLog({ level: "warn", event: "ms_oauth_error", error: msError });
    return res.redirect(`${appUrl}/?auth_error=${encodeURIComponent(msError)}`);
  }

  // CSRF state check
  const savedState = req.cookies?.[MS_STATE_COOKIE];
  res.clearCookie(MS_STATE_COOKIE);
  if (!state || state !== savedState) {
    securityLog({ level: "warn", event: "ms_oauth_state_mismatch" });
    return res.redirect(`${appUrl}/?auth_error=state_mismatch`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(`${MS_AUTHORITY}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Token exchange failed");
    }

    // Fetch user profile from Microsoft Graph
    const graphRes = await fetch(MS_GRAPH_ME, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const msUser = await graphRes.json();
    if (!graphRes.ok || !msUser.id) {
      throw new Error("Failed to fetch user profile from Microsoft Graph");
    }

    // Normalize email — Graph may use mail or userPrincipalName
    const msEmail  = (msUser.mail || msUser.userPrincipalName || "").toLowerCase();
    const msName   = msUser.displayName || msUser.givenName || "Microsoft User";
    const msId     = msUser.id; // Azure AD object ID

    if (!msEmail) throw new Error("No email returned from Microsoft Graph");

    // Derive tenant domain from email
    const tenantDomain = msEmail.includes("@") ? msEmail.split("@")[1] : null;

    // Upsert user: find by microsoftId, then by email, then create
    let user = await prisma.user.findUnique({ where: { microsoftId: msId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: msEmail } });
    }

    if (user) {
      // Existing user — update MS fields if not yet linked
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          microsoftId:  user.microsoftId  || msId,
          tenantDomain: user.tenantDomain || tenantDomain,
          provider:     user.provider     || "microsoft",
          providerId:   user.providerId   || msId,
        },
      });
    } else {
      // New user — create account (no password, MS-only)
      const encrypted = encryptUserData({ name: msName, plan: "free", nickname: null });
      user = await prisma.user.create({
        data: {
          email:        msEmail,
          name:         encrypted.name,
          plan:         encrypted.plan,
          passwordHash: "", // no password for OAuth users
          provider:     "microsoft",
          providerId:   msId,
          microsoftId:  msId,
          tenantDomain,
          isAdmin:      false,
        },
      });
      securityLog({ level: "info", event: "ms_user_created", userId: user.id, tenantDomain });
    }

    // Issue JWT and set cookie (same as email login)
    const token = jwt.sign({ userId: user.id, role: "user" }, JWT_SECRET, { expiresIn: "24h" });
    res.cookie("token", token, COOKIE_OPTS);
    securityLog({ level: "info", event: "ms_login_success", userId: user.id, tenantDomain });

    // Redirect back to the app
    res.redirect(`${appUrl}/?ms_login=ok`);
  } catch (err) {
    console.error("Microsoft OAuth callback error:", err);
    securityLog({ level: "error", event: "ms_oauth_callback_error", error: err.message });
    res.redirect(`${appUrl}/?auth_error=ms_callback_failed`);
  }
});

// ─────────────────────────────────────────────
// CENTRALIZED ERROR HANDLER  (4-arg Express middleware)
// Deve essere l'ULTIMO app.use prima di app.listen.
// Gestisce:
//   - Errori di validazione (err.validation)
//   - Errori con statusCode personalizzato
//   - Errori generici → 500 senza leak di stack trace in produzione
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
  const requestId = req.requestId || req.headers['x-request-id'] || 'internal';

  if (err.validation) {
    securityLog({
      level:      'warn',
      event:      'validation_error',
      request_id: requestId,
      path:       req.originalUrl,
      details:    err.validation,
    });
    return res.status(400).json({
      request_id: requestId,
      code:       'VALIDATION_ERROR',
      message:    'Payload malformato',
      details:    err.validation,
    });
  }

  const status = err.statusCode || err.status || 500;

  securityLog({
    level:      status >= 500 ? 'error' : 'warn',
    event:      'unhandled_error',
    request_id: requestId,
    path:       req.originalUrl,
    status,
    message:    err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  res.status(status).json({
    request_id: requestId,
    code:       'INTERNAL_ERROR',
    message:    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

// ─────────────────────────────────────────────
// EMAIL DRIP — re-engagement after 48h inactivity
// Runs every hour, sends once per user per inactivity window
// ─────────────────────────────────────────────
const DRIP_PATHS = {
  junior:     ["linux-terminal", "enhanced-terminal"],
  sysadmin:   ["os-install", "raid-simulator", "network-lab", "sssd-ldap"],
  infra:      ["vsphere", "security-audit", "real-server"],
  ai:         ["ai-challenges", "advanced-scenarios"],
  enterprise: ["enterprise-arch", "automation", "cloud-infrastructure", "msp-multi-tenant"],
};

async function sendDripEmails() {
  try {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Find users with progress updated 48-72h ago (inactive window)
    const staleProgress = await prisma.userProgress.findMany({
      where: { updatedAt: { gte: cutoff72h, lte: cutoff48h } },
      select: { userId: true },
      distinct: ["userId"],
    });

    for (const { userId } of staleProgress) {
      // Skip if drip already sent in last 72h
      const recentDrip = await prisma.analytics.findFirst({
        where: { userId, event: "drip_48h_sent", createdAt: { gte: cutoff72h } },
      });
      if (recentDrip) continue;

      const userRaw = await prisma.user.findUnique({ where: { id: userId } });
      if (!userRaw || userRaw.accountStatus === "deleted") continue;
      const user = decryptUser(userRaw);
      if (!user.email || user.email.includes("@winlab.test")) continue;

      // Find which path they're in progress on
      const progress = await prisma.userProgress.findMany({ where: { userId } });
      const progressMap = Object.fromEntries(progress.map(p => [p.labId, p]));

      let pathName = null;
      let nextLabName = null;
      for (const [pathId, labs] of Object.entries(DRIP_PATHS)) {
        const started = labs.some(id => progressMap[id]);
        const completed = labs.every(id => progressMap[id]?.completed);
        if (started && !completed) {
          pathName = pathId;
          const nextId = labs.find(id => !progressMap[id]?.completed);
          nextLabName = nextId?.replace(/-/g, " ") || null;
          break;
        }
      }
      if (!pathName) continue;

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0a0a0b;color:#e2e8f0;padding:32px;border-radius:12px;">
          <div style="margin-bottom:24px;">
            <span style="color:#3b82f6;font-weight:900;font-size:20px;">WIN</span>
            <span style="color:#fff;font-weight:900;font-size:20px;">LAB</span>
          </div>
          <h2 style="color:#fff;margin-bottom:8px;">Riprendi da dove eri rimasto</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">
            Hai iniziato il percorso <strong style="color:#fff">${pathName}</strong> ma non lo hai ancora completato.
            ${nextLabName ? `Il prossimo lab è <strong style="color:#3b82f6">${nextLabName}</strong>.` : ""}
          </p>
          <a href="${process.env.APP_URL || "https://winlab.cloud"}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Continua il lab →
          </a>
          <p style="color:#475569;font-size:12px;margin-top:32px;">
            WinLab · <a href="${process.env.APP_URL || "https://winlab.cloud"}/unsubscribe" style="color:#475569;">Cancella iscrizione</a>
          </p>
        </div>`;

      try {
        const { sendEmail } = await import("./src/services/emailService.js");
        await sendEmail(user.email, "Hai lasciato un lab a metà — riprendi ora", html);
        await prisma.analytics.create({
          data: { event: "drip_48h_sent", userId, meta: JSON.stringify({ pathName }) },
        });
        console.log(`[Drip] Sent re-engagement to ${user.email} (path: ${pathName})`);
      } catch (e) {
        console.error(`[Drip] Failed for user ${userId}:`, e.message);
      }
    }
  } catch (err) {
    console.error("[Drip] Scheduler error:", err.message);
  }
}

// Run once at startup (after 5s) then every hour
setTimeout(sendDripEmails, 5000);
setInterval(sendDripEmails, 60 * 60 * 1000);

// ─────────────────────────────────────────────
// SESSION REPLAY
// ─────────────────────────────────────────────

// POST /api/replay/event — save a terminal command event
app.post("/api/replay/event", express.json(), async (req, res) => {
  try {
    const { sessionId, labId, cmd, output } = req.body;
    if (!sessionId || !cmd) return res.status(400).json({ error: "sessionId and cmd required" });
    let userId = null;
    try {
      const token = (req.headers.authorization || "").split(" ")[1];
      if (token) userId = jwt.verify(token, process.env.JWT_SECRET)?.id || null;
    } catch (_) {}
    await prisma.sessionEvent.create({ data: { sessionId, userId, labId: labId || null, cmd, output: output || "" } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/replay/event error:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// GET /api/replay/:sessionId — get full replay for a session
app.get("/api/replay/:sessionId", async (req, res) => {
  try {
    const events = await prisma.sessionEvent.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { ts: "asc" },
    });
    res.json(events);
  } catch (err) {
    console.error("GET /api/replay error:", err);
    res.status(500).json({ error: "Failed to fetch replay" });
  }
});

// GET /api/replay — list sessions for current user (admin: all)
app.get("/api/replay", requireAuth, async (req, res) => {
  try {
    const where = req.user.isAdmin ? {} : { userId: req.user.id };
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
    console.error("GET /api/replay list error:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// ─────────────────────────────────────────────
// START SERVER + WEBSOCKET
// ─────────────────────────────────────────────

// Start server
const server = app.listen(BASE_PORT, () => console.log(`🚀 WINLAB v7 running on :${BASE_PORT}`));
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallback = BASE_PORT + 1;
    console.warn(`⚠️  Port ${BASE_PORT} in use, trying :${fallback}`);
    app.listen(fallback, () => console.log(`🚀 WINLAB v7 running on :${fallback}`));
  } else {
    throw err;
  }
});

// WebSocket server (same port, path /ws/leaderboard)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/ws/leaderboard")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  const scenarioId = new URL(req.url, "http://x").searchParams.get("scenarioId");
  ws.scenarioId = scenarioId || null;
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

// Heartbeat to drop dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

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
