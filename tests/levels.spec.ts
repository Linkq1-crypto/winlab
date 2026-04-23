import { describe, expect, it } from "vitest";
import { getLevelConfig } from "../src/config/levels.js";
import { validateRunLabBody } from "../server/routes/labAi.js";
import { buildLabPrompt } from "../src/services/promptBuilder.js";
import { computeScore } from "../src/services/patchScoring.js";

describe("operator levels", () => {
  it("changes AI permissions by level", () => {
    expect(getLevelConfig("NOVICE").ai).toMatchObject({
      allowReview: true,
      allowPatch: true,
    });
    expect(getLevelConfig("SENIOR").ai).toMatchObject({
      allowReview: true,
      allowPatch: false,
    });
    expect(getLevelConfig("SRE").ai).toMatchObject({
      allowReview: false,
      allowPatch: false,
    });
  });

  it("rejects disallowed AI actions at the API validation layer", () => {
    expect(validateRunLabBody({
      labId: "memory-leak",
      mode: "patch",
      level: "SENIOR",
    })).toMatchObject({ ok: false });

    expect(validateRunLabBody({
      labId: "memory-leak",
      mode: "review",
      level: "SRE",
    })).toMatchObject({ ok: false });
  });

  it("adds level guidance to prompts", () => {
    const prompt = buildLabPrompt({
      labId: "memory-leak",
      mode: "review",
      level: "NOVICE",
    });

    expect(prompt).toContain("Level:");
    expect(prompt).toContain("Novice");
    expect(prompt).toContain("Explain step by step");
  });

  it("scores harder levels with stronger retry and time pressure", () => {
    const junior = computeScore({
      level: getLevelConfig("JUNIOR"),
      attempts: 2,
      durationMs: 30_000,
      usedAI: true,
      success: true,
    });
    const sre = computeScore({
      level: getLevelConfig("SRE"),
      attempts: 2,
      durationMs: 30_000,
      usedAI: true,
      success: true,
    });

    expect(sre.score).toBeLessThan(junior.score);
  });
});
