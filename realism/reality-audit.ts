/**
 * Reality Audit — Shadow Validation, Drift Detection, Entropy Control
 *
 * Provides invariants, reality-gap scoring, and cross-scenario validation
 * to ensure simulated environments remain plausible.
 *
 * Browser-compatible — no Node.js fs usage.
 */

import type { SimulationResult } from "./senior-simulator";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RealityCheck {
  invariant: string;
  test: (env: any) => boolean;
  result: boolean;
}

export interface DriftReport {
  realityGap: number; // 0..1, lower = more realistic
  entropy: number; // system diversity
  predictability: number; // how deterministic the system is
  failureRate: number; // % of operations that fail
  logDiversity: number; // unique log sources / total
  trend: "improving" | "stable" | "degrading";
  flags: string[]; // warning flags
}

export interface AuditResult {
  passed: boolean;
  drift: DriftReport;
  realityChecks: RealityCheck[];
  recommendations: string[];
  metaScore: number; // combined score: realism - predictability - overfitting
}

// ── Class ──────────────────────────────────────────────────────────────────

export class RealityAuditor {
  private history: number[] = [];

  /**
   * Run a full audit on the environment, optionally incorporating
   * a senior simulator result for contextual analysis.
   */
  audit(env: any, seniorResult?: SimulationResult): AuditResult {
    const checks = this.checkInvariants(env);
    const gap = this.calculateRealityGap(env);
    const entropy = this.calculateEntropy(env);
    const predictability = this.calculatePredictability(env);
    const failureRate = this.calculateFailureRate(env);
    const logDiversity = this.calculateLogDiversity(env);

    // Track drift trend
    this.history.push(gap);
    if (this.history.length > 10) this.history.shift();
    const trend = this._computeTrend();

    const flags = this._collectFlags({
      realityGap: gap,
      entropy,
      predictability,
      failureRate,
      logDiversity,
    } as DriftReport);

    const drift: DriftReport = {
      realityGap: gap,
      entropy,
      predictability,
      failureRate,
      logDiversity,
      trend,
      flags,
    };

    const recommendations = this.generateRecommendations(drift, checks);
    const metaScore = this.calculateMetaScore(drift, checks);

    return {
      passed: gap < 0.25 && checks.every((c) => c.result),
      drift,
      realityChecks: checks,
      recommendations,
      metaScore,
    };
  }

  // ── Metric Calculations ───────────────────────────────────────────────

  /**
   * How far the environment deviates from realistic baselines (0–1).
   */
  private calculateRealityGap(env: any): number {
    let gap = 0;

    // Penalise missing expected structures
    if (!env.services) gap += 0.15;
    if (!env.logs) gap += 0.15;
    if (!env.network) gap += 0.1;
    if (!env.storage && !env.db) gap += 0.1;

    // Penalise out-of-range values
    if (env.network?.latencyMs != null) {
      if (env.network.latencyMs < 0) gap += 0.2;
      if (env.network.latencyMs > 5000) gap += 0.1;
    }
    if (env.memory != null && (env.memory < 0 || env.memory > 100000)) gap += 0.2;
    if (env.cpu != null && (env.cpu < 0 || env.cpu > 100)) gap += 0.15;

    // Penalise inconsistent states
    if (env.services?.nginx?.status === "failed" && !env.logs?.length) gap += 0.1;
    if (env.storage?.full && env.services?.mysql?.status === "running") gap += 0.1;

    return Math.min(1, gap);
  }

  /**
   * System diversity — how varied the state space is (0–1).
   */
  private calculateEntropy(env: any): number {
    const signals: number[] = [];

    if (env.network?.latencyMs != null) signals.push(env.network.latencyMs);
    if (env.db?.lag != null) signals.push(env.db.lag);
    if (env.cpu != null) signals.push(env.cpu);
    if (env.memory != null) signals.push(env.memory);

    if (signals.length < 2) return 0.05;

    const mean = signals.reduce((a, b) => a + b, 0) / signals.length;
    const variance =
      signals.reduce((a, b) => a + (b - mean) ** 2, 0) / signals.length;
    // Normalise: higher variance → higher entropy, cap at 1
    return Math.min(1, Math.sqrt(variance) / 1000);
  }

  /**
   * How deterministic the system appears (0–1). High = too predictable.
   */
  private calculatePredictability(env: any): number {
    const services = env.services ?? {};
    const statuses = Object.values(services).map(
      (s: any) => s?.status ?? "unknown",
    );

    if (statuses.length === 0) return 0.5;

    const unique = new Set(statuses).size;
    // Fewer unique statuses → more predictable
    return 1 - (unique - 1) / (statuses.length - 1 || 1);
  }

  /**
   * Percentage of services that are in a failed/error state.
   */
  private calculateFailureRate(env: any): number {
    const services = env.services ?? {};
    const entries = Object.values(services) as any[];
    if (entries.length === 0) return 0;

    const failed = entries.filter(
      (s) => s?.status === "failed" || s?.status === "error",
    ).length;

    return failed / entries.length;
  }

  /**
   * Unique log sources / total log entries.
   */
  private calculateLogDiversity(env: any): number {
    const logs: string[] = env.logs ?? [];
    if (logs.length === 0) return 0;

    const sources = new Set(logs.map((l) => l.split(":")[0]?.trim() ?? l));
    return sources.size / Math.max(1, logs.length);
  }

  // ── Invariant Checks ──────────────────────────────────────────────────

  /**
   * Run all hard invariant checks against the environment.
   */
  private checkInvariants(env: any): RealityCheck[] {
    const checks: Array<{ invariant: string; test: (env: any) => boolean }> = [
      {
        invariant: "services_fail_if_dependencies_fail",
        // nginx running → network running
        test: (e) => {
          if (e.services?.nginx?.status === "running") {
            return e.network?.latencyMs != null && e.network.latencyMs >= 0;
          }
          return true;
        },
      },
      {
        invariant: "disk_errors_propagate",
        // storage.failed → mysql NOT running
        test: (e) => {
          if (e.storage?.failed) {
            return e.services?.mysql?.status !== "running";
          }
          return true;
        },
      },
      {
        invariant: "logs_exist_on_failure",
        // nginx failed → logs exist
        test: (e) => {
          if (e.services?.nginx?.status === "failed") {
            return Array.isArray(e.logs) && e.logs.length > 0;
          }
          return true;
        },
      },
      {
        invariant: "latency_non_negative",
        test: (e) => e.network?.latencyMs == null || e.network.latencyMs >= 0,
      },
      {
        invariant: "memory_bounded",
        test: (e) =>
          e.memory == null || (e.memory >= 0 && e.memory < 100000),
      },
      {
        invariant: "cpu_bounded",
        test: (e) => e.cpu == null || (e.cpu >= 0 && e.cpu <= 100),
      },
      {
        invariant: "service_status_valid",
        test: (e) => {
          const valid = ["running", "failed", "stopped", "error", "unknown", "degraded"];
          const services = e.services ?? {};
          return Object.values(services).every(
            (s: any) => s?.status == null || valid.includes(s.status),
          );
        },
      },
    ];

    return checks.map((c) => ({
      invariant: c.invariant,
      test: c.test,
      result: c.test(env),
    }));
  }

  // ── Recommendations ───────────────────────────────────────────────────

  /**
   * Generate actionable recommendations from drift + invariant results.
   */
  private generateRecommendations(
    drift: DriftReport,
    checks: RealityCheck[],
  ): string[] {
    const recs: string[] = [];

    if (drift.realityGap > 0.25) {
      recs.push("DRIFT ALERT: reality gap exceeds 0.25 — review environment state");
    } else if (drift.realityGap > 0.1) {
      recs.push("Reality gap is acceptable but elevated — monitor for degradation");
    }

    if (drift.predictability > 0.9) {
      recs.push("System is too deterministic — introduce stochasticity");
    }

    if (drift.failureRate < 0.05) {
      recs.push("Failure rate too low — inject faults to validate resilience");
    }

    if (drift.entropy < 0.1) {
      recs.push("Low entropy detected — diversify environment signals");
    }

    if (drift.logDiversity < 2) {
      recs.push("Log diversity too low — add varied log sources");
    }

    if (drift.trend === "degrading") {
      recs.push("Drift trend is degrading — investigate root cause");
    }

    const failedChecks = checks.filter((c) => !c.result);
    for (const fc of failedChecks) {
      recs.push(`Invariant violated: ${fc.invariant}`);
    }

    if (recs.length === 0) {
      recs.push("All checks passed — environment looks healthy");
    }

    return recs;
  }

  // ── Meta Score ─────────────────────────────────────────────────────────

  /**
   * Combined quality score:
   *   realism(0.4) + entropy(0.2) + diversity(0.2) + unpredictability(0.2)
   */
  private calculateMetaScore(drift: DriftReport, checks: RealityCheck[]): number {
    const realism = Math.max(0, 1 - drift.realityGap);
    const entropy = Math.min(1, drift.entropy * 2); // scale up
    const diversity = drift.logDiversity;
    const unpredictability = Math.max(0, 1 - drift.predictability);

    const weighted =
      realism * 0.4 + entropy * 0.2 + diversity * 0.2 + unpredictability * 0.2;

    // Penalise for failed invariants
    const passRate = checks.filter((c) => c.result).length / Math.max(1, checks.length);

    return Math.max(0, Math.min(1, weighted * passRate));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Collect red-flag warnings from drift metrics.
   */
  private _collectFlags(drift: DriftReport): string[] {
    const flags: string[] = [];
    if (drift.predictability > 0.9) flags.push("too_deterministic");
    if (drift.failureRate < 0.05) flags.push("no_failures");
    if (drift.entropy < 0.1) flags.push("low_entropy");
    if (drift.logDiversity < 2) flags.push("logs_too_clean");
    if (drift.realityGap > 0.25) flags.push("DRIFT_ALERT");
    return flags;
  }

  /**
   * Compute trend from the drift history using simple linear regression.
   */
  private _computeTrend(): "improving" | "stable" | "degrading" {
    if (this.history.length < 2) return "stable";

    const n = this.history.length;
    const xMean = (n - 1) / 2;
    const yMean = this.history.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (this.history[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    if (slope > 0.005) return "degrading"; // gap increasing
    if (slope < -0.005) return "improving";
    return "stable";
  }

  // ── Static Validators ─────────────────────────────────────────────────

  /**
   * Shadow-validate a reported incident against the current environment.
   */
  static shadowValidate(
    incident: any,
    env: any,
  ): { gap: number; match: boolean } {
    let mismatches = 0;
    let total = 0;

    if (incident.networkLatency != null && env.network?.latencyMs != null) {
      total++;
      if (Math.abs(incident.networkLatency - env.network.latencyMs) > 200) mismatches++;
    }
    if (incident.dbLag != null && env.db?.lag != null) {
      total++;
      if (Math.abs(incident.dbLag - env.db.lag) > 500) mismatches++;
    }
    if (incident.serviceStatus && env.services) {
      for (const [svc, status] of Object.entries(incident.serviceStatus)) {
        total++;
        if (env.services[svc]?.status !== status) mismatches++;
      }
    }

    const gap = total === 0 ? 0 : mismatches / total;
    return { gap, match: gap < 0.3 };
  }

  /**
   * Cross-validate two environment snapshots for consistency.
   */
  static crossScenarioValidate(
    envA: any,
    envB: any,
  ): { consistent: boolean; differences: string[] } {
    const differences: string[] = [];

    if (envA.services && envB.services) {
      const keysA = Object.keys(envA.services);
      const keysB = Object.keys(envB.services);
      const missing = keysA.filter((k) => !keysB.includes(k));
      if (missing.length) differences.push(`missing services in B: ${missing.join(", ")}`);
    }

    if (envA.network?.latencyMs != null && envB.network?.latencyMs != null) {
      const diff = Math.abs(envA.network.latencyMs - envB.network.latencyMs);
      if (diff > 1000) differences.push(`network latency delta too large: ${diff}ms`);
    }

    if (envA.storage?.full !== envB.storage?.full) {
      differences.push("storage.full state mismatch");
    }

    return { consistent: differences.length === 0, differences };
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a RealityAuditor instance.
 */
export function createRealityAuditor(): RealityAuditor {
  return new RealityAuditor();
}
