import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  validateRepoSourcePath,
  validateRunLabBody,
  validateVerifyCommand,
} from "../server/routes/labAi.js";
import {
  clearRateLimitBuckets,
  createRateLimiter,
} from "../server/middleware/rateLimit.js";
import {
  clearTenantBudgetUsage,
  enforceTenantBudget,
} from "../server/middleware/tenantBudget.js";

const tmpDirs: string[] = [];

function makeTempDir(prefix = "winlab-lab-ai-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return res;
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearRateLimitBuckets();
  clearTenantBudgetUsage();

  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("lab AI route validation", () => {
  it("accepts a known lab inside the configured repo allowlist", () => {
    const root = makeTempDir();
    const repo = path.join(root, "repo");
    fs.mkdirSync(repo);
    vi.stubEnv("CODEX_ALLOWED_REPO_ROOTS", root);
    vi.stubEnv("CODEX_REPO_SOURCE_PATH", repo);

    const validation = validateRunLabBody({
      tenantId: "tenant-a",
      userId: "user-a",
      labId: "memory-leak",
      mode: "patch",
    });

    expect(validation).toMatchObject({
      ok: true,
      data: {
        tenantId: "tenant-a",
        userId: "user-a",
        labId: "memory-leak",
        mode: "patch",
        repoSourcePath: path.resolve(repo),
      },
    });
  });

  it("rejects unknown labs and repo paths outside the allowlist", () => {
    const allowed = makeTempDir();
    const outside = makeTempDir();
    vi.stubEnv("CODEX_ALLOWED_REPO_ROOTS", allowed);
    vi.stubEnv("CODEX_REPO_SOURCE_PATH", outside);

    const validation = validateRunLabBody({
      labId: "not-a-lab",
      mode: "review",
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      "Unknown labId: not-a-lab",
      "repoSourcePath is outside allowed roots",
    ]));
  });

  it("uses path boundaries instead of string prefixes for repo allowlists", () => {
    const allowed = makeTempDir("winlab-allowed-");
    const sibling = `${allowed}-evil`;
    fs.mkdirSync(sibling);
    tmpDirs.push(sibling);
    vi.stubEnv("CODEX_ALLOWED_REPO_ROOTS", allowed);

    expect(() => validateRepoSourcePath(sibling)).toThrow("repoSourcePath is outside allowed roots");
  });

  it("allows only constrained verify commands", () => {
    expect(validateVerifyCommand({
      cmd: "npm",
      args: ["run", "verify:memory-leak"],
      timeoutMs: 15_000,
    })).toEqual({
      cmd: "npm",
      args: ["run", "verify:memory-leak"],
      timeoutMs: 15_000,
    });

    expect(() => validateVerifyCommand({
      cmd: "bash",
      args: ["-lc", "cat /etc/passwd"],
    })).toThrow("verifyCommand.cmd is not allowed");

    expect(() => validateVerifyCommand({
      cmd: "node",
      args: ["../../escape.js"],
    })).toThrow("verifyCommand.args contains blocked patterns");
  });
});

describe("lab AI abuse controls", () => {
  it("rate limits repeated requests for the same key", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyFn: (req) => req.body.userId,
    });
    const req = { body: { userId: "user-a" } };
    const firstRes = makeRes();
    const secondRes = makeRes();
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    limiter(req as any, firstRes, firstNext);
    limiter(req as any, secondRes, secondNext);

    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).not.toHaveBeenCalled();
    expect(secondRes.statusCode).toBe(429);
    expect(secondRes.body).toMatchObject({
      ok: false,
      error: { message: "Rate limit exceeded" },
    });
  });

  it("enforces tenant budgets using patch cost", () => {
    const budget = enforceTenantBudget({ windowMs: 60_000, maxCost: 2 });
    const req = { body: { tenantId: "tenant-a", mode: "patch" } };
    const res = makeRes();
    const next = vi.fn();

    budget(req as any, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      ok: false,
      error: {
        message: "Tenant budget exceeded",
        currentCost: 0,
        limit: 2,
      },
    });
  });
});
