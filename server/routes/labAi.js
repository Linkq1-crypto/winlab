import express from "express";
import path from "path";
import { getLabConfig } from "../../src/config/labCatalog.js";
import { getLevelConfig, isKnownLevel } from "../../src/config/levels.js";
import { runQueuedJob } from "../../src/services/jobQueue.js";
import { recordLabAttempt } from "../../src/services/labProgressService.js";
import runLabWithCodex from "../../src/services/runLabWithCodex.js";
import {
  rateLimitByIP,
  rateLimitByTenant,
  rateLimitByUser,
} from "../middleware/labAiRateLimit.js";
import { enforceTenantBudget } from "../middleware/tenantBudget.js";

const router = express.Router();

router.post(
  "/run",
  rateLimitByIP,
  rateLimitByUser,
  rateLimitByTenant,
  enforceTenantBudget({ maxCost: tenantBudgetLimit() }),
  async (req, res) => {
    try {
      const validation = validateRunLabBody(req.body);

      if (!validation.ok) {
        return res.status(400).json({
          ok: false,
          error: {
            message: "Invalid request body",
            details: validation.errors,
          },
        });
      }

      if (process.env.CODEX_ENABLED !== "true") {
        return res.status(503).json({
          ok: false,
          error: { message: "Codex is disabled" },
        });
      }

      const authUserId = req.user?.id || req.user?.userId;
      const authTenantId = req.user?.tenantId || req.headers["x-tenant-id"];
      const data = {
        ...validation.data,
        tenantId: normalizeId(authTenantId || validation.data.tenantId, "default"),
        userId: normalizeId(authUserId || validation.data.userId, "anonymous"),
      };

      const result = await runQueuedJob(data.tenantId, () =>
        runLabWithCodex(data)
      );

      if (shouldPersistProgress(data.userId)) {
        await recordLabAttempt({
          userId: data.userId,
        labId: data.labId,
        mode: data.mode,
        result,
        });
      }

      return res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          message: error?.message || "Unexpected server error",
        },
      });
    }
  }
);

export default router;

export function validateRunLabBody(body) {
  const errors = [];
  const input = body && typeof body === "object" ? body : {};

  const tenantId = normalizeId(input.tenantId, "default");
  const userId = normalizeId(input.userId, "anonymous");
  const labId = typeof input.labId === "string" ? input.labId.trim() : "";
  const mode = typeof input.mode === "string" ? input.mode.trim() : "review";
  const level = typeof input.level === "string" ? input.level.trim().toUpperCase() : "JUNIOR";
  const incidentSeed = normalizeOptionalSeed(input.incidentSeed);
  const variantLabId = typeof input.variantLabId === "string" ? input.variantLabId.trim() : null;

  if (!labId) {
    errors.push("labId is required");
  } else if (!getLabConfig(labId)) {
    errors.push(`Unknown labId: ${labId}`);
  }

  if (!["review", "patch"].includes(mode)) {
    errors.push("mode must be 'review' or 'patch'");
  }

  if (!isKnownLevel(level)) {
    errors.push("level must be NOVICE, JUNIOR, MID, SENIOR, or SRE");
  } else {
    const levelConfig = getLevelConfig(level);
    if (mode === "review" && !levelConfig.ai.allowReview) {
      errors.push("review is not allowed for this level");
    }
    if (mode === "patch" && !levelConfig.ai.allowPatch) {
      errors.push("patch is not allowed for this level");
    }
  }

  let repoSourcePath = "";
  try {
    repoSourcePath = resolveServerRepoSourcePath();
  } catch (error) {
    errors.push(error.message);
  }

  let verifyCommand = null;
  if (input.verifyCommand != null) {
    try {
      verifyCommand = validateVerifyCommand(input.verifyCommand);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      tenantId,
      userId,
      labId,
      mode,
      level,
      incidentSeed,
      variantLabId,
      repoSourcePath,
      verifyCommand,
    },
  };
}

function normalizeOptionalSeed(value) {
  if (value == null || value === "") return null;
  return String(value).replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
}

export function validateRepoSourcePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("repoSourcePath is required");
  }

  const resolved = path.resolve(value.trim());
  const insideAllowedRoot = getAllowedRepoRoots().some((root) => isInsidePath(root, resolved));

  if (!insideAllowedRoot) {
    throw new Error("repoSourcePath is outside allowed roots");
  }

  return resolved;
}

export function validateVerifyCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("verifyCommand must be an object");
  }

  const cmd = typeof value.cmd === "string" ? value.cmd.trim() : "";
  const args = Array.isArray(value.args) ? value.args : [];
  const timeoutMs = Number(value.timeoutMs || 15_000);

  if (!cmd) {
    throw new Error("verifyCommand.cmd is required");
  }

  if (!new Set(["npm", "node"]).has(cmd)) {
    throw new Error("verifyCommand.cmd is not allowed");
  }

  if (!args.every((arg) => typeof arg === "string")) {
    throw new Error("verifyCommand.args must be an array of strings");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error("verifyCommand.timeoutMs must be between 1000 and 60000");
  }

  if (args.some(hasBlockedArgPattern)) {
    throw new Error("verifyCommand.args contains blocked patterns");
  }

  return { cmd, args, timeoutMs };
}

export function normalizeId(value, fallback) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 100);
}

function getAllowedRepoRoots() {
  const raw = process.env.CODEX_ALLOWED_REPO_ROOTS || process.cwd();
  const values = String(raw)
    .split(",")
    .flatMap((chunk) => chunk.split(path.delimiter))
    .map((value) => value.trim())
    .filter(Boolean);

  return values.map((value) => path.resolve(value));
}

function resolveServerRepoSourcePath() {
  return validateRepoSourcePath(
    process.env.CODEX_REPO_SOURCE_PATH ||
    process.env.WINLAB_REPO_SOURCE_PATH ||
    process.cwd()
  );
}

function isInsidePath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function hasBlockedArgPattern(arg) {
  return /(\.\.[/\\])|(^[/\\]$)|(^~)|(;)|(&&)|(\|\|)/.test(arg);
}

function tenantBudgetLimit() {
  const value = Number(process.env.CODEX_TENANT_BUDGET_PER_MINUTE || 25);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

function shouldPersistProgress(userId) {
  const value = String(userId || "").toLowerCase();
  return Boolean(value) &&
    value !== "anonymous" &&
    value !== "guest" &&
    value !== "guest-user" &&
    !value.startsWith("guest_");
}
