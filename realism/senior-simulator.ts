/**
 * Senior SysAdmin Incident Simulator
 *
 * Simulates how a senior sysadmin would diagnose and fix incidents
 * across multiple profiles (fast, paranoid, methodical).
 *
 * Browser-compatible — no Node.js fs usage.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface SimulationResult {
  diagnosis: string;
  confidence: number; // 0..1
  timeMs: number;
  steps: string[];
  success: boolean;
  wrongPaths: string[]; // diagnostic paths that led nowhere
}

export type Profile = "fast" | "paranoid" | "methodical";

export interface ProfileConfig {
  checkLogsFirst: boolean;
  skipLowSignal: boolean;
  retryCount: number;
  maxSteps: number;
}

// ── Profile Defaults ───────────────────────────────────────────────────────

const PROFILE_CONFIGS: Record<Profile, ProfileConfig> = {
  fast: {
    checkLogsFirst: false,
    skipLowSignal: true,
    retryCount: 1,
    maxSteps: 8,
  },
  paranoid: {
    checkLogsFirst: true,
    skipLowSignal: false,
    retryCount: 3,
    maxSteps: 20,
  },
  methodical: {
    checkLogsFirst: true,
    skipLowSignal: false,
    retryCount: 1,
    maxSteps: 15,
  },
};

// ── Signal-to-hypothesis mapping ──────────────────────────────────────────

const HYPOTHESIS_RULES: Array<{ test: (env: any) => boolean; hypothesis: string }> = [
  { test: (env) => env.logs?.some((l: string) => /502/.test(l)), hypothesis: "upstream_down" },
  { test: (env) => env.db?.lag > 2000, hypothesis: "db_latency" },
  { test: (env) => env.network?.latencyMs > 800, hypothesis: "network_issue" },
  { test: (env) => env.storage?.full === true, hypothesis: "disk_full" },
  {
    test: (env) => env.services?.nginx?.status === "failed",
    hypothesis: "service_crash",
  },
];

// ── Action plans per hypothesis ───────────────────────────────────────────

const ACTION_PLANS: Record<string, string[]> = {
  network_issue: [
    "ping db",
    "ip a",
    "ss -tuln",
    "traceroute db-host",
  ],
  db_latency: [
    "mysqladmin processlist",
    "SHOW SLAVE STATUS",
    "check slow queries",
  ],
  upstream_down: [
    "systemctl status nginx",
    "curl localhost",
    "check upstream",
  ],
  disk_full: [
    "df -h",
    "du -sh /var",
    "find large files",
  ],
  service_crash: [
    "systemctl status nginx",
    "journalctl -u nginx --no-pager",
    "nginx -t",
  ],
};

// ── Evidence validators ───────────────────────────────────────────────────

const EVIDENCE_VALIDATORS: Record<string, (hypothesis: string, result: any, env: any) => boolean> = {
  network_issue: (_h, _r, env) => (env.network?.latencyMs ?? 0) > 800,
  db_latency: (_h, _r, env) => (env.db?.lag ?? 0) > 2000,
  disk_full: (_h, _r, env) => env.storage?.full === true,
  upstream_down: (_h, _r, env) =>
    env.logs?.some((l: string) => /502/.test(l)) ?? false,
  service_crash: (_h, _r, env) =>
    env.services?.nginx?.status === "failed",
};

// ── Class ──────────────────────────────────────────────────────────────────

export class SeniorSimulator {
  private profile: Profile;
  private profileConfig: ProfileConfig;

  constructor(profile: Profile = "methodical") {
    this.profile = profile;
    this.profileConfig = { ...PROFILE_CONFIGS[profile] };
  }

  /** Swap the behavioural profile at runtime. */
  setProfile(profile: Profile): void {
    this.profile = profile;
    this.profileConfig = { ...PROFILE_CONFIGS[profile] };
  }

  /**
   * Run the full diagnostic simulation against the given environment.
   */
  async simulate(env: any): Promise<SimulationResult> {
    const t0 = performance.now();
    const hypotheses = this.generateHypotheses(env);
    const wrongPaths: string[] = [];

    let diagnosis = "";
    let confidence = 0;
    const steps: string[] = [];
    let success = false;

    for (const hypothesis of hypotheses) {
      if (steps.length >= this.profileConfig.maxSteps) break;

      const actions = this.planActions(hypothesis);

      for (const action of actions) {
        if (steps.length >= this.profileConfig.maxSteps) break;

        steps.push(action);
        const result = await this.executeCommand(action, env);

        const valid = this.validateEvidence(hypothesis, result, env);
        if (!valid && this.profileConfig.skipLowSignal) {
          wrongPaths.push(action);
          continue;
        }

        if (valid) {
          diagnosis = hypothesis;
          confidence = this._computeConfidence(steps.length, valid);
          success = true;
          break;
        }

        // Retry for paranoid profile
        for (let r = 0; r < this.profileConfig.retryCount - 1; r++) {
          if (steps.length >= this.profileConfig.maxSteps) break;
          steps.push(`${action} (retry ${r + 1})`);
          const retryResult = await this.executeCommand(action, env);
          if (this.validateEvidence(hypothesis, retryResult, env)) {
            diagnosis = hypothesis;
            confidence = this._computeConfidence(steps.length, true);
            success = true;
            break;
          }
        }

        if (success) break;
        wrongPaths.push(action);
      }

      if (success) break;
    }

    // Fallback diagnosis
    if (!diagnosis) {
      diagnosis = "unknown";
      confidence = 0.1;
    }

    const timeMs = Math.round(performance.now() - t0);

    return {
      diagnosis,
      confidence,
      timeMs,
      steps,
      success,
      wrongPaths,
    };
  }

  /**
   * Generate a list of candidate hypotheses from env signals.
   */
  private generateHypotheses(env: any): string[] {
    return HYPOTHESIS_RULES.filter((rule) => rule.test(env)).map(
      (rule) => rule.hypothesis,
    );
  }

  /**
   * Return the ordered action list for a given hypothesis.
   */
  private planActions(hypothesis: string): string[] {
    return ACTION_PLANS[hypothesis] ?? ["investigate"];
  }

  /**
   * Simulate executing a diagnostic command. In a real system this would
   * call a subprocess; here it resolves immediately with a synthetic result.
   */
  private async executeCommand(cmd: string, env: any): Promise<any> {
    // Simulated latency (1–8 ms)
    const latency = 1 + Math.random() * 7;
    await new Promise((r) => setTimeout(r, latency));

    // Synthetic result — in production this could hook into a real runner
    return { command: cmd, env, timestamp: Date.now() };
  }

  /**
   * Check whether the hypothesis is supported by the evidence.
   */
  private validateEvidence(
    hypothesis: string,
    result: any,
    env: any,
  ): boolean {
    const validator = EVIDENCE_VALIDATORS[hypothesis];
    if (!validator) return false;
    return validator(hypothesis, result, env);
  }

  /**
   * Compute a confidence score based on how quickly the diagnosis was made.
   */
  private _computeConfidence(stepCount: number, valid: boolean): number {
    if (!valid) return 0.2;
    // Fewer steps → higher confidence
    return Math.min(1, 1 - stepCount * 0.03);
  }

  /**
   * Score how "human" the diagnostic path looks (0–1).
   */
  calculateHumanScore(result: SimulationResult): number {
    let score = 0;
    if (result.success) score += 0.4;
    if (result.confidence > 0.8) score += 0.2;
    if (result.timeMs < 120_000) score += 0.2;
    if (result.steps.length < 15) score += 0.2;
    return score;
  }

  /**
   * Run the simulation with multiple profiles and return all results.
   */
  static async runMultipleProfiles(
    env: any,
    profiles: Profile[],
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];
    for (const p of profiles) {
      const sim = new SeniorSimulator(p);
      results.push(await sim.simulate(env));
    }
    return results;
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a SeniorSimulator with the default "methodical" profile.
 */
export function createSeniorSimulator(profile: Profile = "methodical"): SeniorSimulator {
  return new SeniorSimulator(profile);
}
