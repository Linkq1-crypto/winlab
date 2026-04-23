import { getLabConfig } from "../config/labCatalog.js";
import { getLevelConfig } from "../config/levels.js";
import { createLabExecutionBridge } from "./labExecutionBridge.js";
import { runLab } from "./labRunner.js";

export async function runLabWithCodex({
  tenantId = "default",
  userId = "anonymous",
  labId,
  mode = "review",
  repoSourcePath,
  verifyCommand = null,
  level: levelInput = "JUNIOR",
}) {
  const startedAt = Date.now();
  const level = getLevelConfig(levelInput?.id || levelInput);

  if (process.env.CODEX_ENABLED !== "true") {
    return {
      ok: false,
      mode,
      labId,
      tenantId,
      userId,
      durationMs: 0,
      error: { message: "Codex is disabled" },
    };
  }

  if (!labId) throw new Error("labId is required");
  if (!repoSourcePath) throw new Error("repoSourcePath is required");
  if (!getLabConfig(labId)) throw new Error(`Unknown labId: ${labId}`);
  if (!["review", "patch"].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);

  if (mode === "review" && !level.ai.allowReview) {
    return {
      ok: false,
      mode,
      labId,
      tenantId,
      userId,
      level: level.id,
      durationMs: Date.now() - startedAt,
      error: { message: "Review not allowed in this level" },
    };
  }

  if (mode === "patch" && !level.ai.allowPatch) {
    return {
      ok: false,
      mode,
      labId,
      tenantId,
      userId,
      level: level.id,
      durationMs: Date.now() - startedAt,
      error: { message: "Patch not allowed in this level" },
    };
  }

  const bridge = await createLabExecutionBridge({
    tenantId,
    userId,
    labId,
    repoSourcePath,
    verifyCommand,
  });

  try {
    const result = await runLab({
      labId,
      mode,
      workspace: bridge.workspace,
      aiRunner: bridge.aiRunner,
      applyPatch: bridge.applyPatch,
      runVerify: bridge.runVerify,
      level,
    });

    return {
      ok: !!result?.ok,
      mode,
      labId,
      tenantId,
      userId,
      level: level.id,
      durationMs: Date.now() - startedAt,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      mode,
      labId,
      tenantId,
      userId,
      level: level.id,
      durationMs: Date.now() - startedAt,
      error: {
        message: error?.message || "Lab execution failed",
        stack: process.env.NODE_ENV !== "production" ? error?.stack || null : undefined,
      },
    };
  } finally {
    await bridge.cleanup();
  }
}

export default runLabWithCodex;
