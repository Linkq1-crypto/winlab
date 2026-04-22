import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPatch, _test as patcherTest } from "../src/services/patcher.js";
import {
  createWorkspace,
  runLabWithAI,
  _test as labRunnerTest,
} from "../src/services/labRunner.js";

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
