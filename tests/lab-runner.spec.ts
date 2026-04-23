import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPatch, _test as patcherTest } from "../src/services/patcher.js";
import {
  createWorkspace,
  runLab,
  runLabWithAI,
  _test as labRunnerTest,
} from "../src/services/labRunner.js";
import { buildLabPrompt } from "../src/services/promptBuilder.js";
import { runPatchWithRetry, shouldRetryPatch } from "../src/services/patchRetry.js";
import { scorePatchQuality } from "../src/services/patchScoring.js";

const tmpDirs: string[] = [];

function makeTempDir(prefix = "winlab-lab-runner-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("lab patcher", () => {
  it("extracts touched files and rejects out-of-scope diffs", () => {
    const diff = [
      "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
      "--- a/labs/memory-leak/index.js",
      "+++ b/labs/memory-leak/index.js",
      "+console.log('fixed')",
    ].join("\n");

    expect(patcherTest.extractTouchedFiles(diff)).toEqual(["labs/memory-leak/index.js"]);
    expect(() =>
      patcherTest.assertAllowedScope(["labs/memory-leak/index.js"], ["labs/memory-leak"])
    ).not.toThrow();
    expect(() =>
      patcherTest.assertAllowedScope(["server.js"], ["labs/memory-leak"])
    ).toThrow(/outside allowed scope/i);
  });

  it("rejects path traversal in patch paths", () => {
    expect(() => patcherTest.normalizeRepoPath("../server.js")).toThrow(/traversal/i);
    expect(() => patcherTest.normalizeRepoPath("C:/Windows/win.ini")).toThrow(/absolute/i);
  });

  it("applies a scoped unified diff inside a workspace", async () => {
    const workspace = makeTempDir();
    const labDir = path.join(workspace, "labs", "memory-leak");
    fs.mkdirSync(labDir, { recursive: true });
    fs.writeFileSync(path.join(labDir, "index.js"), "console.log('broken')\n");

    const diff = [
      "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
      "--- a/labs/memory-leak/index.js",
      "+++ b/labs/memory-leak/index.js",
      "@@ -1 +1 @@",
      "-console.log('broken')",
      "+console.log('fixed')",
    ].join("\n");

    const applied = await applyPatch(workspace, diff, { allowedScope: ["labs/memory-leak"] });

    expect(applied).toMatchObject({ ok: true, skipped: false });
    expect(fs.readFileSync(path.join(labDir, "index.js"), "utf8").replace(/\r\n/g, "\n"))
      .toBe("console.log('fixed')\n");
  });
});

describe("lab runner", () => {
  it("builds Docker args with isolation controls", () => {
    const args = labRunnerTest.dockerArgs({
      workspace: "/tmp/workspace",
      scriptPath: "labs/memory-leak/index.js",
    });

    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--pids-limit=64");
    expect(args).toContain("--memory=512m");
    expect(args).toContain("--cpus=1");
    expect(args).toContain("--security-opt=no-new-privileges");
    expect(args).toContain("/tmp:rw,noexec,nosuid,size=64m");
  });

  it("creates a filtered workspace without secrets or node_modules", async () => {
    const sourceRepoRoot = makeTempDir();
    const workRoot = makeTempDir("winlab-lab-workroot-");
    vi.stubEnv("LAB_WORKDIR_ROOT", workRoot);
    fs.mkdirSync(path.join(sourceRepoRoot, "labs", "memory-leak"), { recursive: true });
    fs.mkdirSync(path.join(sourceRepoRoot, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(sourceRepoRoot, ".env"), "SECRET=1\n");
    fs.writeFileSync(path.join(sourceRepoRoot, "labs", "memory-leak", "index.js"), "console.log('x')\n");

    const workspace = await createWorkspace({
      sourceRepoRoot,
      tenantId: "tenant-a",
      labId: "memory-leak",
    });

    expect(fs.existsSync(path.join(workspace.workspace, "labs", "memory-leak", "index.js"))).toBe(true);
    expect(fs.existsSync(path.join(workspace.workspace, ".env"))).toBe(false);
    expect(fs.existsSync(path.join(workspace.workspace, "node_modules"))).toBe(false);
  });

  it("runs AI patch flow against a workspace and applies returned diff", async () => {
    const workspace = makeTempDir();
    const labDir = path.join(workspace, "labs", "memory-leak");
    fs.mkdirSync(labDir, { recursive: true });
    fs.writeFileSync(path.join(labDir, "index.js"), "console.log('broken')\n");

    const diff = [
      "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
      "--- a/labs/memory-leak/index.js",
      "+++ b/labs/memory-leak/index.js",
      "@@ -1 +1 @@",
      "-console.log('broken')",
      "+console.log('fixed')",
    ].join("\n");
    const aiRouter = {
      run: vi.fn(async (input) => (
        input.mode === "review"
          ? { result: { configured: true, result: "root cause" } }
          : { result: { configured: true, diff, result: "patched" } }
      )),
    };

    const result = await runLabWithAI({
      labId: "memory-leak",
      workspace,
      aiRouter,
      tenantId: "tenant-a",
      userId: "user-a",
    });

    expect(result.review.result).toMatchObject({ result: "root cause" });
    expect(result.applied).toMatchObject({ ok: true, skipped: false });
    expect(result.verify).toMatchObject({ ok: false, skipped: true });
    expect(fs.readFileSync(path.join(labDir, "index.js"), "utf8").replace(/\r\n/g, "\n"))
      .toBe("console.log('fixed')\n");
    expect(aiRouter.run).toHaveBeenCalledTimes(2);
    expect(aiRouter.run.mock.calls[0][0]).toMatchObject({ mode: "review" });
    expect(aiRouter.run.mock.calls[0][0].customPrompt).toContain("Explain what this lab does");
    expect(aiRouter.run.mock.calls[1][0]).toMatchObject({ mode: "patch" });
    expect(aiRouter.run.mock.calls[1][0].customPrompt).toContain("Fix the issue with a minimal patch");
    expect(aiRouter.run.mock.calls[1][0].lab).toMatchObject({
      id: "memory-leak",
      scope: ["labs/memory-leak"],
      repoRoot: workspace,
    });
  });
});

describe("lab prompt, retry, and scoring", () => {
  it("builds catalog-aware prompts with issue guidance and retry context", () => {
    const reviewPrompt = buildLabPrompt({ labId: "memory-leak", mode: "review" });
    const retryPrompt = buildLabPrompt({
      labId: "memory-leak",
      mode: "patch",
      failureContext: {
        verifyOk: false,
        timeout: false,
        outputSnippet: "heap still grows",
      },
    });

    expect(reviewPrompt).toContain("Focus on retained references");
    expect(reviewPrompt).toContain("Stop unbounded memory growth");
    expect(retryPrompt).toContain("Previous attempt failed verification");
    expect(retryPrompt).toContain("heap still grows");
    expect(retryPrompt).toContain("Return ONLY a unified diff");
  });

  it("retries once after a failed verification and stops on success", async () => {
    const calls: string[] = [];
    const result = await runPatchWithRetry({
      labId: "memory-leak",
      workspace: "/tmp/workspace",
      lab: {
        id: "memory-leak",
        scope: ["labs/memory-leak"],
        entryPoints: ["labs/memory-leak/index.js"],
        issueType: "performance-memory",
      },
      aiRunner: async (prompt) => {
        calls.push(prompt);
        return calls.length === 1 ? "diff-one" : "diff-two";
      },
      applyPatch: async (_workspace, diff) => ({
        ok: true,
        applied: true,
        filesTouched: [`${diff}.js`],
      }),
      runVerify: async () => (
        calls.length === 1
          ? { ok: false, output: "verify failed" }
          : { ok: true, output: "verify passed" }
      ),
    });

    expect(result.ok).toBe(true);
    expect(result.finalAttempt).toBe(2);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[1].prompt).toContain("Previous attempt failed verification");
  });

  it("does not retry unsafe or non-actionable patch failures", () => {
    expect(shouldRetryPatch({
      patchApplied: true,
      verifyResult: { ok: false, output: "bad" },
      patchMeta: {},
    })).toBe(true);
    expect(shouldRetryPatch({
      patchApplied: false,
      verifyResult: { ok: false, output: "bad" },
      patchMeta: {},
    })).toBe(false);
    expect(shouldRetryPatch({
      patchApplied: true,
      verifyResult: { ok: false, skipped: true, output: "missing verify" },
      patchMeta: {},
    })).toBe(false);
    expect(shouldRetryPatch({
      patchApplied: true,
      verifyResult: { ok: false, output: "bad" },
      patchMeta: { pathViolation: true },
    })).toBe(false);
  });

  it("scores patch quality with retry and file-count penalties", () => {
    expect(scorePatchQuality({
      verifyOk: true,
      attempts: 1,
      filesTouched: ["labs/memory-leak/index.js"],
      patchBytes: 100,
    })).toMatchObject({
      score: 100,
      grade: "A",
      reasons: ["single_file_bonus", "first_try_bonus"],
    });

    const weak = scorePatchQuality({
      verifyOk: false,
      attempts: 2,
      filesTouched: ["a.js", "b.js"],
      patchBytes: 10 * 1024,
      timeout: true,
      warningLikeOutput: true,
    });
    expect(weak.grade).toBe("F");
    expect(weak.reasons).toContain("verification_failed");
    expect(weak.reasons).toContain("needed_retry");
  });

  it("supports the generic runLab patch wrapper", async () => {
    const result = await runLab({
      labId: "memory-leak",
      mode: "patch",
      workspace: "/tmp/workspace",
      aiRunner: async () => ({ diff: "diff --git a/x b/x" }),
      applyPatch: async () => ({ applied: true, filesTouched: ["winlab/labs/memory-leak/index.js"] }),
      runVerify: async () => ({ ok: true, output: "verify passed" }),
    });

    expect(result).toMatchObject({
      ok: true,
      mode: "patch",
      labId: "memory-leak",
      finalAttempt: 1,
      quality: { grade: "A" },
    });
  });
});
