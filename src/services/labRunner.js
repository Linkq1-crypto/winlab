import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { applyPatch } from "./patcher.js";
import { buildPrompt } from "./promptBuilder.js";

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
  return "";
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

  const labPath = resolveLabPath(workspace, labId);
  const lab = {
    id: labId,
    title: labId.replace(/-/g, " "),
    scope: [labPath],
    entryPoints: [labPath],
    repoRoot: workspace,
  };

  const review = await aiRouter.run({
    tenantId,
    userId,
    lab,
    mode: "review",
    context: {
      ...context,
      fileHint: context.fileHint || lab.entryPoints[0],
    },
    customPrompt: buildPrompt({ lab, mode: "review" }),
  });

  const patch = await aiRouter.run({
    tenantId,
    userId,
    lab,
    mode: "patch",
    context: {
      ...context,
      fileHint: context.fileHint || lab.entryPoints[0],
    },
    customPrompt: buildPrompt({ lab, mode: "patch" }),
  });

  const diff = extractPatchDiff(patch);
  const applied = await applyPatch(workspace, diff, { allowedScope: lab.scope });
  const run = await runLabContainer({ labId, workspace });
  const verify = await runVerifyScript({ labId, workspace });

  return {
    labId,
    review,
    patch,
    applied,
    run,
    verify,
  };
}

export const _test = {
  dockerArgs,
  extractPatchDiff,
  isSafeLabId,
  resolveLabPath,
  shouldCopy,
};

export default {
  cleanupWorkspace,
  createWorkspace,
  runLabContainer,
  runLabWithAI,
  runVerifyScript,
};
