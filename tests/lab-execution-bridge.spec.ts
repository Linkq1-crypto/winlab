import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractFilesTouchedFromDiff,
  validateUnifiedDiffAgainstScope,
} from "../src/services/codexBridge.js";
import { createLabExecutionBridge } from "../src/services/labExecutionBridge.js";
import runLabWithCodex from "../src/services/runLabWithCodex.js";
import { resolveVerifyDefinition, runVerifyForLab } from "../src/services/verifyRouter.js";

const tmpDirs: string[] = [];

function makeTempDir(prefix = "winlab-bridge-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function writeLabRepo(root: string) {
  const labDir = path.join(root, "labs", "memory-leak");
  fs.mkdirSync(labDir, { recursive: true });
  fs.writeFileSync(path.join(labDir, "index.js"), "console.log('broken')\n");
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Codex bridge diff helpers", () => {
  it("extracts touched files and rejects out-of-scope patches", () => {
    const diff = [
      "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
      "--- a/labs/memory-leak/index.js",
      "+++ b/labs/memory-leak/index.js",
      "@@ -1 +1 @@",
      "-console.log('broken')",
      "+console.log('fixed')",
    ].join("\n");

    expect(extractFilesTouchedFromDiff(diff)).toEqual(["labs/memory-leak/index.js"]);
    expect(validateUnifiedDiffAgainstScope({
      diffText: diff,
      scope: ["labs/memory-leak"],
    })).toMatchObject({
      valid: true,
      filesTouched: ["labs/memory-leak/index.js"],
    });
    expect(validateUnifiedDiffAgainstScope({
      diffText: diff.replaceAll("labs/memory-leak", "server"),
      scope: ["labs/memory-leak"],
    })).toMatchObject({
      valid: false,
      pathViolation: true,
    });

    const unsafeDiff = [
      "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
      "--- a/labs/memory-leak/index.js",
      "+++ b/labs/memory-leak/index.js",
      "@@ -1 +1 @@",
      "-console.log('broken')",
      "+eval('console.log(1)')",
    ].join("\n");

    expect(validateUnifiedDiffAgainstScope({
      diffText: unsafeDiff,
      scope: ["labs/memory-leak"],
    })).toMatchObject({
      valid: false,
      policyViolation: true,
      reason: "Patch violates semantic policy",
    });
  });
});

describe("verify router", () => {
  it("uses catalog verify commands and adapts process results", async () => {
    expect(resolveVerifyDefinition("memory-leak")).toMatchObject({
      type: "command",
      cmd: "npm",
      args: ["run", "verify:memory-leak"],
    });

    const result = await runVerifyForLab({
      labId: "memory-leak",
      workspace: "/tmp/workspace",
      runProcess: async (cmd, args, options) => ({
        ok: cmd === "npm" && args[1] === "verify:memory-leak" && options.cwd === "/tmp/workspace",
        output: "verify passed",
        timeout: false,
        exitCode: 0,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      output: "verify passed",
      metrics: {
        exitCode: 0,
        verifyType: "command",
      },
    });
  });
});

describe("lab execution bridge", () => {
  it("applies scoped patches in a Codex session workspace", async () => {
    const repo = makeTempDir();
    const workRoot = makeTempDir("winlab-bridge-work-");
    const audit = path.join(workRoot, "audit.log");
    writeLabRepo(repo);
    vi.stubEnv("CODEX_ALLOWED_REPO_ROOTS", repo);
    vi.stubEnv("CODEX_WORKDIR_ROOT", workRoot);
    vi.stubEnv("CODEX_AUDIT_LOG", audit);

    const bridge = await createLabExecutionBridge({
      tenantId: "tenant-a",
      userId: "user-a",
      labId: "memory-leak",
      repoSourcePath: repo,
    });

    try {
      const diff = [
        "diff --git a/labs/memory-leak/index.js b/labs/memory-leak/index.js",
        "--- a/labs/memory-leak/index.js",
        "+++ b/labs/memory-leak/index.js",
        "@@ -1 +1 @@",
        "-console.log('broken')",
        "+console.log('fixed')",
      ].join("\n");

      const applied = await bridge.applyPatch(bridge.workspace, diff);

      expect(applied).toMatchObject({
        applied: true,
        filesTouched: ["labs/memory-leak/index.js"],
      });
      expect(fs.readFileSync(path.join(bridge.workspace, "labs", "memory-leak", "index.js"), "utf8").replace(/\r\n/g, "\n"))
        .toBe("console.log('fixed')\n");
      expect(fs.existsSync(audit)).toBe(true);
    } finally {
      await bridge.cleanup();
    }
  });

  it("short-circuits runLabWithCodex when Codex is disabled", async () => {
    vi.stubEnv("CODEX_ENABLED", "false");

    const result = await runLabWithCodex({
      tenantId: "tenant-a",
      userId: "user-a",
      labId: "memory-leak",
      mode: "patch",
      repoSourcePath: "/tmp/unused",
    });

    expect(result).toMatchObject({
      ok: false,
      mode: "patch",
      labId: "memory-leak",
      error: { message: "Codex is disabled" },
    });
  });
});
