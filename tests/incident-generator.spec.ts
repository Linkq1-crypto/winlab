import { describe, expect, it } from "vitest";
import { getIncidentChain } from "../src/config/incidentChains.js";
import {
  completeCurrentStep,
  createIncidentChainSession,
  getCurrentChainStep,
  startCurrentStep,
} from "../src/services/incidentChainEngine.js";
import { scoreChain } from "../src/services/chainScoring.js";
import { generateIncident } from "../src/services/incidentGenerator.js";

describe("incident generator", () => {
  it("generates reproducible variants from the same seed", () => {
    const first = generateIncident({
      labId: "api-timeout",
      seed: "demo-seed",
      level: "JUNIOR",
    });
    const second = generateIncident({
      labId: "api-timeout",
      seed: "demo-seed",
      level: "JUNIOR",
    });

    expect(first.rootCauseId).toBe(second.rootCauseId);
    expect(first.logs).toEqual(second.logs);
  });

  it("uses multiple root causes for SRE mode when available", () => {
    const incident = generateIncident({
      labId: "api-timeout",
      seed: "sre-seed",
      level: "SRE",
    });

    expect(incident.rootCauseIds.length).toBe(2);
  });
});

describe("incident chains", () => {
  it("advances steps until the chain completes", () => {
    expect(getIncidentChain("web-stack-recovery")).toBeTruthy();

    const session = createIncidentChainSession("web-stack-recovery", {
      seed: "chain-seed",
    });
    startCurrentStep(session);

    expect(getCurrentChainStep(session).id).toBe("port-conflict");
    completeCurrentStep(session);
    expect(getCurrentChainStep(session).id).toBe("upstream-down");
    completeCurrentStep(session);
    completeCurrentStep(session);
    expect(session.completed).toBe(true);
  });

  it("scores incomplete chains lower than completed chains", () => {
    const complete = scoreChain({
      totalSteps: 3,
      completedSteps: 3,
      totalDurationMs: 30_000,
      usedAI: false,
      retries: 0,
    });
    const partial = scoreChain({
      totalSteps: 3,
      completedSteps: 1,
      totalDurationMs: 30_000,
      usedAI: false,
      retries: 0,
    });

    expect(partial.score).toBeLessThan(complete.score);
  });
});
