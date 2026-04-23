import { spawn } from "child_process";
import path from "path";

const MAX_PATCH_BYTES = Number(process.env.LAB_MAX_PATCH_BYTES || 256_000);

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeRepoPath(value) {
  const raw = toPosixPath(value).replace(/^[ab]\//, "");
  if (!raw || raw === "/dev/null") return "";
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith("/")) {
    throw new Error("Patch contains an absolute path");
  }

  const normalized = path.posix.normalize(raw);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error("Patch contains path traversal");
  }
  return normalized;
}

function extractTouchedFiles(diff) {
  const files = new Set();
  for (const line of String(diff || "").split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) {
        files.add(normalizeRepoPath(match[1]));
        files.add(normalizeRepoPath(match[2]));
      }
    } else if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      const file = line.slice(4).trim().split(/\s+/)[0];
      const normalized = normalizeRepoPath(file);
      if (normalized) files.add(normalized);
    }
  }
  return Array.from(files).filter(Boolean).sort();
}

function assertAllowedScope(filesTouched, allowedScope = []) {
  const normalizedScope = allowedScope
    .map((scope) => normalizeRepoPath(scope))
    .filter(Boolean);

  if (!normalizedScope.length) {
    throw new Error("Patch allowed scope is required");
  }

  const outOfScope = filesTouched.filter((file) => (
    !normalizedScope.some((scope) => file === scope || file.startsWith(`${scope}/`))
  ));

  if (outOfScope.length) {
    const err = new Error("Patch touches files outside allowed scope");
    err.code = "SCOPE_VIOLATION";
    err.files = outOfScope;
    throw err;
  }
}

function runGitApply(workspace, diff, args) {
  return new Promise((resolve, reject) => {
    const git = spawn("git", ["apply", ...args, "-"], {
      cwd: workspace,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    git.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    git.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    git.on("error", reject);
    git.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `git apply exited with ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    git.stdin.end(diff);
  });
}

export async function applyPatch(workspace, diff, { allowedScope = [] } = {}) {
  const rawPatch = String(diff || "");
  if (!rawPatch.trim()) {
    return { ok: true, skipped: true, filesTouched: [], output: "No patch returned." };
  }
  const patch = rawPatch.endsWith("\n") ? rawPatch : `${rawPatch}\n`;

  if (Buffer.byteLength(patch, "utf8") > MAX_PATCH_BYTES) {
    const err = new Error("Patch diff too large");
    err.code = "PATCH_TOO_LARGE";
    throw err;
  }

  const filesTouched = extractTouchedFiles(patch);
  assertAllowedScope(filesTouched, allowedScope);

  await runGitApply(workspace, patch, ["--check"]);
  await runGitApply(workspace, patch, ["--whitespace=nowarn"]);

  return { ok: true, skipped: false, filesTouched };
}

export const _test = {
  assertAllowedScope,
  extractTouchedFiles,
  normalizeRepoPath,
};

export default { applyPatch };
