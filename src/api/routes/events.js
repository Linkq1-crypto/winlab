import express from "express";
import jwt from "jsonwebtoken";
import {
  isAllowedRevenueEvent,
  recordRevenueEvent,
} from "../../services/revenueEventEngine.js";

const SESSION_COOKIE = "winlab_session_id";

function normalizeSessionId(value) {
  const sessionId = String(value || "").trim().slice(0, 160);
  return sessionId || null;
}

function resolveUserId(req, jwtSecret) {
  if (req.user?.id) return req.user.id;

  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return decoded?.userId || decoded?.id || null;
  } catch {
    return null;
  }
}

function parseOccurredAt(ts) {
  if (!ts) return new Date();
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function createEventsRouter({ prisma, jwtSecret = process.env.JWT_SECRET } = {}) {
  const router = express.Router();

  router.post("/events", express.json({ limit: "32kb" }), async (req, res) => {
    const eventType = String(req.body?.event || "").trim();
    if (!isAllowedRevenueEvent(eventType)) {
      return res.status(400).json({ error: "Invalid event type" });
    }

    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};
    const sessionId = normalizeSessionId(
      req.cookies?.[SESSION_COOKIE] ||
      req.body?.sessionId ||
      payload.sessionId
    );
    const userId = resolveUserId(req, jwtSecret);
    const occurredAt = parseOccurredAt(req.body?.ts);

    if (sessionId && req.cookies?.[SESSION_COOKIE] !== sessionId) {
      res.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
    }

    res.status(202).json({ ok: true });

    void recordRevenueEvent({
      prisma,
      eventType,
      payload,
      userId,
      sessionId,
      occurredAt,
    }).catch((error) => {
      console.error("[RevenueEvents] Failed to record event:", error.message);
    });
  });

  return router;
}

