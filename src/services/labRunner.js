import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { getLabConfig } from "../config/labCatalog.js";
import { applyPatch as applyUnifiedPatch } from "./patcher.js";
import { runPatchWithRetry } from "./patchRetry.js";
import { scorePatchQuality } from "./patchScoring.js";
import { buildLabPrompt } from "./promptBuilder.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.LAB_RUN_TIMEOUT_MS || 30_000);
const MAX_OUTPUT_BYTES = Number(process.env.LAB_RUN_MAX_OUTPUT_BYTES || 128_000);
const SKIP_NAMES = new Set([
  ".git",
  ".claude",
  ".aws",
  ".ssh",
  "node_modules",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
]);
const SKIP_EXTS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
]);

function safeSegment(value, fallback = "default") {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || fallback;
}

function isSafeLabId(labId) {
  return /^[a-zA-Z0-9_-]+$/.test(String(labId || ""));
}

function shouldCopy(src) {
  const name = path.basename(src);
  const lower = name.toLowerCase();
  if (lower.startsWith(".env")) return false;
  if (lower.startsWith("id_rsa")) return false;
  if (SKIP_NAMES.has(name)) return false;
  if (SKIP_EXTS.has(path.extname(name).toLowerCase())) return false;
  return true;
}

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function resolveLabPath(workspace, labId) {
  if (!isSafeLabId(labId)) throw new Error("Invalid labId");

  const candidates = [
    path.join(workspace, "labs", labId),
    path.join(workspace, "winlab", "labs", labId),
  ];

  const found = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });

  if (!found) throw new Error("Lab not found");
  return toPosixPath(path.relative(workspace, found));
}

function trimOutput(output) {
  const text = String(output || "");
  if (Buffer.byteLength(text, "utf8") <= MAX_OUTPUT_BYTES) return text;
  return `${text.slice(0, MAX_OUTPUT_BYTES)}\n\n[output truncated]`;
}

function dockerArgs({ workspace, scriptPath }) {
  return [
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--pids-limit=64",
    "--memory=512m",
    "--cpus=1",
    "--security-opt=no-new-privileges",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "-v",
    `${workspace}:/app`,
    "-w",
    "/app",
    "node:20-alpine",
    "node",
    scriptPath,
  ];
}

function runDockerScript({ workspace, scriptPath, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const docker = spawn("docker", dockerArgs({ workspace, scriptPath }), {
      shell: false,
      windowsHide: true,
    });

    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      docker.kill("SIGTERM");
    }, timeoutMs);

    docker.stdout?.on("data", (chunk) => { output = trimOutput(output + chunk.toString("utf8")); });
    docker.stderr?.on("data", (chunk) => { output = trimOutput(output + chunk.toString("utf8")); });
    docker.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        timedOut: false,
        output: `Docker failed to start: ${err.message}`,
      });
    });
    docker.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        exitCode: code,
        timedOut,
        output: trimOutput(output),
      });
    });
  });
}

export function getLabWorkdirRoot() {
  return path.resolve(process.env.LAB_WORKDIR_ROOT || path.join(os.tmpdir(), "winlab-lab-workspaces"));
}

export async function createWorkspace({ sourceRepoRoot, tenantId = "default", labId = "lab" }) {
  const workRoot = getLabWorkdirRoot();
  const sessionId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const sessionRoot = path.join(workRoot, safeSegment(tenantId), `${safeSegment(labId)}-${sessionId}`);
  const workspace = path.join(sessionRoot, "workspace");

  await fsp.mkdir(sessionRoot, { recursive: true });
  await fsp.cp(path.resolve(sourceRepoRoot), workspace, {
    recursive: true,
    filter: shouldCopy,
  });

  return { sessionId, sessionRoot, workspace };
}

export async function cleanupWorkspace(sessionRoot) {
  if (!sessionRoot || process.env.LAB_KEEP_WORKSPACES === "true") return;
  await fsp.rm(sessionRoot, { recursive: true, force: true });
}

export async function runLabContainer({ labId, workspace }) {
  const labPath = resolveLabPath(workspace, labId);
  const indexPath = path.join(workspace, labPath, "index.js");
  if (!fs.existsSync(indexPath)) {
    return {
      ok: false,
      skipped: true,
      exitCode: null,
      output: `Missing ${labPath}/index.js`,
    };
  }

  return runDockerScript({
    workspace,
    scriptPath: `${labPath}/index.js`,
  });
}

export async function runVerifyScript({ labId, workspace }) {
  const labPath = resolveLabPath(workspace, labId);
  const verifyPath = path.join(workspace, labPath, "verify.js");
  if (!fs.existsSync(verifyPath)) {
    return {
      ok: false,
      skipped: true,
      exitCode: null,
      output: `Missing ${labPath}/verify.js`,
    };
  }

  return runDockerScript({
    workspace,
    scriptPath: `${labPath}/verify.js`,
  });
}

function extractPatchDiff(patchResult) {
  if (typeof patchResult?.result?.diff === "string") return patchResult.result.diff;
  if (typeof patchResult?.diff === "string") return patchResult.diff;
  if (typeof patchResult?.result === "string") return patchResult.result;
  if (typeof patchResult === "string") return patchResult;
  return "";
}

function bytesOf(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

function normalizeAiText(result) {
  if (typeof result === "string") return result.trim();
  if (!result) return "";
  if (typeof result.text === "string") return result.text.trim();
  if (typeof result.diff === "string") return result.diff.trim();
  if (typeof result.result === "string") return result.result.trim();
  return String(result).trim();
}

function buildRuntimeLab({ labId, workspace }) {
  const labPath = resolveLabPath(workspace, labId);
  const catalogLab = getLabConfig(labId) || {};
  const indexPath = path.join(workspace, labPath, "index.js");
  const entryPoint = fs.existsSync(indexPath) ? `${labPath}/index.js` : labPath;

  return {
    ...catalogLab,
    id: labId,
    title: catalogLab.title || labId.replace(/-/g, " "),
    scope: [labPath],
    entryPoints: [entryPoint],
    repoRoot: workspace,
  };
}

async function applyPatchForLab(workspace, unifiedDiff, lab) {
  try {
    const result = await applyUnifiedPatch(workspace, unifiedDiff, { allowedScope: lab.scope });
    return {
      ...result,
      applied: result.ok && !result.skipped,
      emptyPatch: !!result.skipped,
    };
  } catch (err) {
    return {
      ok: false,
      applied: false,
      filesTouched: err.files || [],
      invalidDiff: /git apply|corrupt patch|patch failed/i.test(err.message),
      pathViolation: err.code === "SCOPE_VIOLATION" || /outside allowed scope|path traversal|absolute path/i.test(err.message),
      policyViolation: /policy|semantic/i.test(err.message),
      output: err.message,
    };
  }
}

async function runVerifyWithContainer({ labId, workspace }) {
  const run = await runLabContainer({ labId, workspace });
  const verify = await runVerifyScript({ labId, workspace });

  return {
    ...verify,
    timeout: verify.timeout ?? verify.timedOut ?? run.timedOut ?? false,
    run,
  };
}

export async function runLabWithAI({
  labId,
  workspace,
  aiRouter,
  tenantId,
  userId,
  context = {},
}) {
  if (!aiRouter || typeof aiRouter.run !== "function") {
    throw new Error("aiRouter.run is required");
  }

  const lab = buildRuntimeLab({ labId, workspace });

  const review = await aiRouter.run({
    tenantId,
    userId,
    lab,
    mode: "review",
    context: {
      ...context,
      fileHint: context.fileHint || lab.entryPoints[0],
    },
    customPrompt: buildLabPrompt({ labId, lab, mode: "review" }),
  });

  const patchFlow = await runPatchWithRetry({
    labId,
    lab,
    workspace,
    aiRunner: async (prompt) => aiRouter.run({
      tenantId,
      userId,
      lab,
      mode: "patch",
      context: {
        ...context,
        fileHint: context.fileHint || lab.entryPoints[0],
      },
      customPrompt: prompt,
    }),
    applyPatch: async (currentWorkspace, unifiedDiff) => applyPatchForLab(currentWorkspace, unifiedDiff, lab),
    runVerify: async () => runVerifyWithContainer({ labId, workspace }),
  });

  const finalAttempt = patchFlow.attempts[patchFlow.attempts.length - 1] || null;
  const finalPatch = extractPatchDiff(finalAttempt?.patch);
  const filesTouched = finalAttempt?.apply?.filesTouched || [];
  const finalVerify = finalAttempt?.verify || null;
  const quality = scorePatchQuality({
    verifyOk: !!finalVerify?.ok,
    attempts: patchFlow.finalAttempt,
    filesTouched,
    patchBytes: bytesOf(finalPatch),
    timeout: !!(finalVerify?.timeout || finalVerify?.timedOut),
    touchedOutsideEntrypointZone: false,
    warningLikeOutput: /warn|deprecated|partial/i.test(finalVerify?.output || ""),
  });

  return {
    labId,
    review,
    patch: finalAttempt?.patch || null,
    applied: finalAttempt?.apply || null,
    run: finalVerify?.run || null,
    verify: finalVerify,
    quality,
    patchFlow: {
      ok: patchFlow.ok,
      finalAttempt: patchFlow.finalAttempt,
      attempts: patchFlow.attempts.map((attempt) => ({
        attempt: attempt.attempt,
        prompt: attempt.prompt,
        diff: extractPatchDiff(attempt.patch),
        apply: attempt.apply,
        verify: attempt.verify,
      })),
    },
  };
}

function buildScopeOptions(lab) {
  return {
    scope: lab?.scope || [],
    entryPoints: lab?.entryPoints || [],
  };
}

export async function reviewLab({ labId, workspace, aiRunner }) {
  const lab = getLabConfig(labId);
  if (!lab) throw new Error(`Unknown labId: ${labId}`);
  if (typeof aiRunner !== "function") {
    throw new Error("reviewLab requires aiRunner(prompt, options)");
  }

  const prompt = buildLabPrompt({ labId, mode: "review" });
  const startedAt = Date.now();
  const result = await aiRunner(prompt, {
    workspace,
    mode: "review",
    ...buildScopeOptions(lab),
  });

  return {
    ok: true,
    mode: "review",
    labId,
    prompt,
    text: normalizeAiText(result),
    durationMs: Date.now() - startedAt,
  };
}

export async function patchLab({ labId, workspace, aiRunner, applyPatch, runVerify }) {
  const lab = getLabConfig(labId);
  if (!lab) throw new Error(`Unknown labId: ${labId}`);
  if (typeof aiRunner !== "function") throw new Error("patchLab requires aiRunner(prompt, options)");
  if (typeof applyPatch !== "function") throw new Error("patchLab requires applyPatch(workspace, diff, options)");
  if (typeof runVerify !== "function") throw new Error("patchLab requires runVerify(options)");

  const startedAt = Date.now();
  const retryResult = await runPatchWithRetry({
    labId,
    workspace,
    aiRunner: async (prompt) => aiRunner(prompt, {
      workspace,
      mode: "patch",
      ...buildScopeOptions(lab),
    }),
    applyPatch: async (currentWorkspace, unifiedDiff) => applyPatch(currentWorkspace, unifiedDiff, {
      labId,
      ...buildScopeOptions(lab),
    }),
    runVerify: async () => runVerify({
      labId,
      workspace,
      ...buildScopeOptions(lab),
    }),
  });

  const finalAttemptData = retryResult.attempts[retryResult.attempts.length - 1] || null;
  const finalPatch = extractPatchDiff(finalAttemptData?.patch);
  const filesTouched = finalAttemptData?.apply?.filesTouched || [];
  const verifyOutput = finalAttemptData?.verify?.output || "";
  const quality = scorePatchQuality({
    verifyOk: !!finalAttemptData?.verify?.ok,
    attempts: retryResult.finalAttempt,
    filesTouched,
    patchBytes: bytesOf(finalPatch),
    timeout: !!(finalAttemptData?.verify?.timeout || finalAttemptData?.verify?.timedOut),
    touchedOutsideEntrypointZone: false,
    warningLikeOutput: /warn|deprecated|partial/i.test(verifyOutput),
  });

  return {
    ok: retryResult.ok,
    mode: "patch",
    labId,
    durationMs: Date.now() - startedAt,
    finalAttempt: retryResult.finalAttempt,
    attempts: retryResult.attempts.map((item) => ({
      attempt: item.attempt,
      prompt: item.prompt,
      diff: extractPatchDiff(item.patch),
      apply: item.apply,
      verify: item.verify,
    })),
    final: finalAttemptData
      ? {
          attempt: finalAttemptData.attempt,
          diff: finalPatch,
          filesTouched,
          verify: finalAttemptData.verify,
        }
      : null,
    quality,
  };
}

export async function runLab({ labId, mode = "review", workspace, aiRunner, applyPatch, runVerify }) {
  if (mode === "review") {
    return reviewLab({ labId, workspace, aiRunner });
  }

  if (mode === "patch") {
    return patchLab({ labId, workspace, aiRunner, applyPatch, runVerify });
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

export const _test = {
  dockerArgs,
  applyPatchForLab,
  buildRuntimeLab,
  extractPatchDiff,
  isSafeLabId,
  resolveLabPath,
  runVerifyWithContainer,
  shouldCopy,
};

export default {
  cleanupWorkspace,
  createWorkspace,
  patchLab,
  reviewLab,
  runLab,
  runLabContainer,
  runLabWithAI,
  runVerifyScript,
};
