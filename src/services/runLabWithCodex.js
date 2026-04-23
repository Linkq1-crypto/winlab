import { getLabConfig } from "../config/labCatalog.js";
import { createLabExecutionBridge } from "./labExecutionBridge.js";
import { runLab } from "./labRunner.js";

export async function runLabWithCodex({
  tenantId = "default",
  userId = "anonymous",
  labId,
  mode = "review",
  repoSourcePath,
  verifyCommand = null,
}) {
  const startedAt = Date.now();

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
    });

    return {
      ok: !!result?.ok,
      mode,
      labId,
      tenantId,
      userId,
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
