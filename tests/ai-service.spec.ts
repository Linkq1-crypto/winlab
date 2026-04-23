import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverLabs } from "../src/services/labDiscovery.js";
import { enhanceScope } from "../src/services/labScope.js";
import { buildPrompt } from "../src/services/promptBuilder.js";
import { createAIService } from "../src/services/aiService.js";
import { createAIRouter } from "../src/services/aiRouter.js";

const tmpDirs: string[] = [];

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "winlab-ai-service-"));
  tmpDirs.push(root);
  return root;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AI lab discovery service", () => {
  it("discovers labs from a repo-root labs directory", () => {
    const repoRoot = makeRepo();
    fs.mkdirSync(path.join(repoRoot, "labs", "memory-leak"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, "labs", "nginx-port-conflict"), { recursive: true });

    const labs = discoverLabs(repoRoot);

    expect(labs.map((lab) => lab.id)).toEqual(["memory-leak", "nginx-port-conflict"]);
    expect(labs[0]).toMatchObject({
      id: "memory-leak",
      title: "Memory Leak",
      scope: ["labs/memory-leak"],
      entryPoints: ["labs/memory-leak"],
      type: "performance",
    });
  });

  it("discovers labs from a nested winlab/labs directory", () => {
    const repoRoot = makeRepo();
    fs.mkdirSync(path.join(repoRoot, "winlab", "labs", "disk-full"), { recursive: true });

    const labs = discoverLabs(repoRoot);

    expect(labs).toHaveLength(1);
    expect(labs[0].scope).toEqual(["winlab/labs/disk-full"]);
  });

  it("enhances backend scope only for backend-relevant labs", () => {
    const repoRoot = makeRepo();

    expect(enhanceScope({ id: "memory-leak", scope: ["labs/memory-leak"] }, { repoRoot }).scope)
      .toEqual(["labs/memory-leak", "winlab/backend"]);
    expect(enhanceScope({ id: "nginx-port-conflict", scope: ["labs/nginx-port-conflict"] }, { repoRoot }).scope)
      .toEqual(["labs/nginx-port-conflict"]);
  });

  it("builds bounded prompts without embedding repository code", () => {
    const prompt = buildPrompt({
      mode: "review",
      lab: {
        id: "disk-full",
        scope: ["labs/disk-full"],
        entryPoints: ["labs/disk-full"],
      },
    });

    expect(prompt).toContain("Work only on:");
    expect(prompt).toContain("- labs/disk-full");
    expect(prompt).toContain("do not scan the entire repository");
    expect(prompt).toContain("1. short explanation");
    expect(prompt).toContain("2. root cause");
  });

  it("routes discovered labs through aiRouter with a custom prompt", async () => {
    const repoRoot = makeRepo();
    fs.mkdirSync(path.join(repoRoot, "labs", "memory-leak"), { recursive: true });
    const aiRouter = { run: vi.fn(async (input) => ({ ok: true, input })) };
    const service = createAIService({ repoRoot, aiRouter });

    await service.run({
      tenantId: "tenant-a",
      userId: "user-a",
      labId: "memory-leak",
      mode: "review",
      context: { error: "heap growth" },
    });

    const routed = aiRouter.run.mock.calls[0][0];
    expect(routed.customPrompt).toContain("Work only on:");
    expect(routed.customPrompt).toContain("- labs/memory-leak");
    expect(routed.context.fileHint).toBe("labs/memory-leak");
    expect(routed.lab.scope).toContain("winlab/backend");
  });
});

describe("AI router custom prompt support", () => {
  it("uses customPrompt and forwards repoRoot to Codex adapters", async () => {
    const repoRoot = makeRepo();
    const seen: unknown[] = [];
    const router = createAIRouter({
      getRepoCommit: async () => "abc123",
      runCodexReview: async (input) => {
        seen.push(input);
        return { result: "ok" };
      },
      runCodexPatch: async () => ({ result: "unused" }),
    });

    const out = await router.run({
      tenantId: "tenant-custom",
      userId: "user-custom",
      mode: "review",
      lab: {
        id: "custom-lab",
        scope: ["labs/custom-lab"],
        repoRoot,
      },
      context: { error: "boom" },
      customPrompt: "CUSTOM PROMPT",
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      prompt: "CUSTOM PROMPT",
      repoRoot,
      scope: ["labs/custom-lab"],
    });
    expect(out.result).toEqual({ result: "ok" });
  });
});
