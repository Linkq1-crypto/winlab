import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { getLabConfig } from "../config/labCatalog.js";
import {
  appendAuditLog,
  createCodexSessionWorkspace,
  extractFilesTouchedFromDiff,
  runCodexPatch,
  runCodexReview,
  validateUnifiedDiffAgainstScope,
} from "./codexBridge.js";
import { runVerifyForLab } from "./verifyRouter.js";

const MAX_PROCESS_OUTPUT_BYTES = Number(process.env.LAB_BRIDGE_MAX_OUTPUT_BYTES || 128_000);

export async function createLabExecutionBridge({
  tenantId = "default",
  userId = "anonymous",
  labId,
  repoSourcePath,
  verifyCommand = null,
}) {
  const lab = getLabConfig(labId);
  if (!lab) throw new Error(`Unknown labId: ${labId}`);
  if (!repoSourcePath) throw new Error("repoSourcePath is required");

  const workspace = await createCodexSessionWorkspace({
    tenantId,
    userId,
    labId,
    repoSourcePath,
  });
  const policyChecks = buildPolicyChecks(lab);

  async function aiRunner(prompt, options = {}) {
    const mode = options.mode || "review";
    const startedAt = Date.now();
    const scope = options.scope || lab.scope;
    const entryPoints = options.entryPoints || lab.entryPoints;

    if (mode === "review") {
      const result = await runCodexReview({
        tenantId,
        userId,
        labId,
        workspace,
        prompt,
        scope,
        entryPoints,
      });

      await appendAuditLog({
        tenant_id: tenantId,
        user_id: userId,
        lab_id: labId,
        action: "review",
        duration_ms: Date.now() - startedAt,
        exit_code: result?.exitCode ?? 0,
        files_touched: [],
        policy_violation: false,
        policy_checks: policyChecks,
      });

      return { text: result?.text || "" };
    }

    if (mode === "patch") {
      const result = await runCodexPatch({
        tenantId,
        userId,
        labId,
        workspace,
        prompt,
        scope,
        entryPoints,
      });
      const diff = result?.diff || "";
      const filesTouched = extractFilesTouchedFromDiff(diff);

      await appendAuditLog({
        tenant_id: tenantId,
        user_id: userId,
        lab_id: labId,
        action: "patch_generate",
        duration_ms: Date.now() - startedAt,
        exit_code: result?.exitCode ?? 0,
        files_touched: filesTouched,
        policy_violation: false,
        policy_checks: policyChecks,
      });

      return { diff, text: diff };
    }

    throw new Error(`Unsupported aiRunner mode: ${mode}`);
  }

  async function applyPatch(currentWorkspace, unifiedDiff, options = {}) {
    const scope = options.scope || lab.scope;
    const startedAt = Date.now();

    if (!unifiedDiff || !String(unifiedDiff).trim()) {
      return {
        applied: false,
        emptyPatch: true,
        filesTouched: [],
        output: "Empty diff",
      };
    }

    const validation = validateUnifiedDiffAgainstScope({
      diffText: unifiedDiff,
      scope,
      workspace: currentWorkspace,
    });

    if (!validation.valid) {
      await appendAuditLog({
        tenant_id: tenantId,
        user_id: userId,
        lab_id: labId,
        action: "patch_apply_rejected",
        duration_ms: Date.now() - startedAt,
        exit_code: 1,
        files_touched: validation.filesTouched || [],
        policy_violation: true,
        policy_checks: policyChecks,
      });

      return {
        applied: false,
        invalidDiff: !!validation.invalidDiff,
        pathViolation: !!validation.pathViolation,
        emptyPatch: !!validation.emptyPatch,
        policyViolation: true,
        filesTouched: validation.filesTouched || [],
        output: validation.reason || "Patch rejected",
      };
    }

    const patchFile = path.join(currentWorkspace, ".winlab.patch");
    await fs.writeFile(patchFile, normalizePatch(unifiedDiff), "utf8");
    const patchResult = await runProcess("git", ["apply", "--whitespace=nowarn", patchFile], {
      cwd: currentWorkspace,
      timeoutMs: 10_000,
    });
    await fs.rm(patchFile, { force: true }).catch(() => {});

    const filesTouched = validation.filesTouched || [];
    if (!patchResult.ok) {
      await appendAuditLog({
        tenant_id: tenantId,
        user_id: userId,
        lab_id: labId,
        action: "patch_apply_failed",
        duration_ms: Date.now() - startedAt,
        exit_code: patchResult.exitCode,
        files_touched: filesTouched,
        policy_violation: false,
        policy_checks: policyChecks,
      });

      return {
        applied: false,
        invalidDiff: true,
        filesTouched,
        output: patchResult.output || "git apply failed",
      };
    }

    await appendAuditLog({
      tenant_id: tenantId,
      user_id: userId,
      lab_id: labId,
      action: "patch_apply_ok",
      duration_ms: Date.now() - startedAt,
      exit_code: 0,
      files_touched: filesTouched,
      policy_violation: false,
      policy_checks: policyChecks,
    });

    return {
      applied: true,
      filesTouched,
      output: patchResult.output || "Patch applied",
    };
  }

  async function runVerify() {
    const startedAt = Date.now();
    let verifyResult;

    if (verifyCommand?.cmd) {
      const proc = await runProcess(verifyCommand.cmd, verifyCommand.args || [], {
        cwd: workspace,
        timeoutMs: verifyCommand.timeoutMs || 15_000,
        env: {
          ...process.env,
          WINLAB_LAB_ID: labId,
        },
      });

      verifyResult = {
        ok: proc.ok,
        output: proc.output,
        timeout: !!proc.timeout,
        metrics: {
          exitCode: proc.exitCode,
          verifyType: "command-override",
        },
      };
    } else {
      verifyResult = await runVerifyForLab({
        labId,
        workspace,
        runProcess,
        env: {
          ...process.env,
          WINLAB_LAB_ID: labId,
        },
      });
    }

    await appendAuditLog({
      tenant_id: tenantId,
      user_id: userId,
      lab_id: labId,
      action: "verify",
      duration_ms: Date.now() - startedAt,
      exit_code: verifyResult.metrics?.exitCode ?? 1,
      files_touched: [],
      policy_violation: false,
      policy_checks: policyChecks,
    });

    return verifyResult;
  }

  async function cleanup() {
    const target = path.basename(workspace) === "workspace"
      ? path.dirname(workspace)
      : workspace;
    await fs.rm(target, { recursive: true, force: true });
  }

  return {
    workspace,
    aiRunner,
    applyPatch,
    runVerify,
    cleanup,
  };
}

async function runProcess(cmd, args, { cwd, timeoutMs = 15_000, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const append = (current, chunk) => (
      trimProcessOutput(current + String(chunk))
    );
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        resolve({
          ok: false,
          timeout: true,
          exitCode: 124,
          output: `${stdout}\n${stderr}`.trim(),
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        timeout: false,
        exitCode: 1,
        output: `${stdout}\n${stderr}\n${error.message}`.trim(),
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        timeout: false,
        exitCode: code ?? 1,
        output: `${stdout}\n${stderr}`.trim(),
      });
    });
  });
}

function normalizePatch(diff) {
  const text = String(diff || "");
  return text.endsWith("\n") ? text : `${text}\n`;
}

function buildPolicyChecks(lab) {
  return {
    scope_enforced: Array.isArray(lab?.scope) && lab.scope.length > 0,
    denylist_enforced: true,
    network_blocked: process.env.CODEX_RUNNER === "docker",
    semantic_guard: true,
  };
}

function trimProcessOutput(output) {
  const text = String(output || "");
  if (Buffer.byteLength(text, "utf8") <= MAX_PROCESS_OUTPUT_BYTES) return text;
  return `${text.slice(0, MAX_PROCESS_OUTPUT_BYTES)}\n\n[output truncated]`;
}

export const _test = {
  buildPolicyChecks,
  normalizePatch,
  runProcess,
  trimProcessOutput,
};

export default { createLabExecutionBridge };
