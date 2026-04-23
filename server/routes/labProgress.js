import express from "express";
import {
  getUserLabAttempts,
  getUserLabProgress,
} from "../../src/services/labProgressService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: { message: "userId is required" },
      });
    }

    const items = await getUserLabProgress(userId);
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: { message: error?.message || "Failed to load progress" },
    });
  }
});

router.get("/attempts", async (req, res) => {
  try {
    const userId = resolveRequestUserId(req);
    const labId = String(req.query.labId || "").trim();

    if (!userId || !labId) {
      return res.status(400).json({
        ok: false,
        error: { message: "userId and labId are required" },
      });
    }

    const items = await getUserLabAttempts(userId, labId);
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: { message: error?.message || "Failed to load attempts" },
    });
  }
});

export default router;

export function resolveRequestUserId(req) {
  return String(req.user?.id || req.user?.userId || req.query.userId || "").trim();
}
