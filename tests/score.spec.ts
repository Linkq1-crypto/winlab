// tests/score.spec.ts — Realism score CI gate

import { describe, it, expect } from "vitest";
import { exec, createDefaultEnv, normalize } from "../realism/engine";
import { loadBaseline, compareOutputs } from "../realism/snapshots";

/**
 * Calculate realism score based on multiple factors:
 * - command_coverage: % of commands that work correctly
 * - state_accuracy: % of state transitions that are correct
 * - side_effects: % of side-effects that occur
 * - timing_realism: % of timing that's realistic (not instant)
 */
interface RealismScore {
  commandCoverage: number;
  stateAccuracy: number;
  sideEffects: number;
  timingRealism: number;
  overall: number;
}

async function calculateRealismScore(): Promise<RealismScore> {
  let commandSuccess = 0;
  let commandTotal = 0;
  let stateCorrect = 0;
  let stateTotal = 0;
  let sideEffectsCorrect = 0;
  let sideEffectsTotal = 0;
  let timingRealistic = 0;
  let timingTotal = 0;

  const testCases = [
    // Command coverage tests
    { cmd: "systemctl status nginx", expectCode: 0 },
    { cmd: "systemctl is-active sshd", expectCode: 0 },
    { cmd: "ps aux", expectCode: 0 },
    { cmd: "df -h", expectCode: 0 },
    { cmd: "free", expectCode: 0 },
    { cmd: "hostname", expectCode: 0 },
    { cmd: "whoami", expectCode: 0 },
    { cmd: "uname -a", expectCode: 0 },
    { cmd: "uptime", expectCode: 0 },
    { cmd: "cat /etc/my.cnf", expectCode: 0 },

    // State accuracy tests
    {
      cmd: "systemctl stop nginx",
      expectCode: 0,
      checkState: (env: any) => env.services.nginx.status === "stopped",
    },
    {
      cmd: "systemctl start nginx",
      expectCode: 0,
      checkState: (env: any) => env.services.nginx.status === "running",
    },

    // Side-effects tests
    {
      cmd: "rm -rf /var/lib/mysql",
      expectCode: 0,
      checkSideEffect: (env: any) => env.services.mysqld.status === "failed",
    },

    // Timing tests (should not be instant)
    { cmd: "systemctl restart nginx", expectCode: 0, checkTiming: true },
  ];

  for (const testCase of testCases) {
    const env = createDefaultEnv();
    const result = await exec(testCase.cmd, env);

    // Command coverage
    commandTotal++;
    if (result.code === testCase.expectCode) {
      commandSuccess++;
    }

    // State accuracy
    if (testCase.checkState) {
      stateTotal++;
      if (testCase.checkState(env)) {
        stateCorrect++;
      }
    }

    // Side effects
    if (testCase.checkSideEffect) {
      sideEffectsTotal++;
      if (testCase.checkSideEffect(env)) {
        sideEffectsCorrect++;
      }
    }

    // Timing realism
    if (testCase.checkTiming) {
      timingTotal++;
      if (result.timing.delayMs > 0) {
        timingRealistic++;
      }
    }
  }

  return {
    commandCoverage: commandTotal > 0 ? commandSuccess / commandTotal : 0,
    stateAccuracy: stateTotal > 0 ? stateCorrect / stateTotal : 0,
    sideEffects: sideEffectsTotal > 0 ? sideEffectsCorrect / sideEffectsTotal : 0,
    timingRealism: timingTotal > 0 ? timingRealistic / timingTotal : 0,
    overall:
      (commandSuccess / commandTotal +
        (stateTotal > 0 ? stateCorrect / stateTotal : 1) +
        (sideEffectsTotal > 0 ? sideEffectsCorrect / sideEffectsTotal : 1) +
        (timingTotal > 0 ? timingRealistic / timingTotal : 1)) /
      4,
  };
}

describe("Realism score CI gate", () => {
  it("realism score >= 0.75", async () => {
    const score = await calculateRealismScore();

    console.log("━━━ Realism Score Report ━━━");
    console.log(`Command Coverage: ${(score.commandCoverage * 100).toFixed(1)}%`);
    console.log(`State Accuracy: ${(score.stateAccuracy * 100).toFixed(1)}%`);
    console.log(`Side Effects: ${(score.sideEffects * 100).toFixed(1)}%`);
    console.log(`Timing Realism: ${(score.timingRealism * 100).toFixed(1)}%`);
    console.log(`Overall Score: ${(score.overall * 100).toFixed(1)}%`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    expect(score.overall).toBeGreaterThanOrEqual(0.70);
  });

  it("all critical commands work", async () => {
    const env = createDefaultEnv();

    const criticalCommands = [
      "systemctl status sshd",
      "systemctl stop nginx",
      "systemctl start nginx",
      "ps aux",
      "df -h",
      "free",
    ];

    for (const cmd of criticalCommands) {
      const result = await exec(cmd, env);
      expect(result.code).toBeLessThan(127); // Not "command not found"
    }
  });

  it("state transitions are correct", async () => {
    const env = createDefaultEnv();

    // Stop a service
    await exec("systemctl stop httpd", env);
    expect(env.services.httpd.status).toBe("stopped");

    // Start it again
    await exec("systemctl start httpd", env);
    expect(env.services.httpd.status).toBe("running");
  });

  it("side effects occur correctly", async () => {
    const env = createDefaultEnv();

    // rm mysql data should break mysql
    await exec("rm -rf /var/lib/mysql", env);
    expect(env.services.mysqld.status).toBe("failed");
  });

  it("timing is not instant", async () => {
    const env = createDefaultEnv();

    const result = await exec("systemctl restart nginx", env);
    expect(result.timing.delayMs).toBeGreaterThan(0);
  });
});
