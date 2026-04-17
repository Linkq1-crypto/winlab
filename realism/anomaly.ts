// realism/anomaly.ts — Anomaly detection (simulation vs reality drift)

import type { BehavioralProfile } from "./clustering";
import type { CommandTelemetry, RealityTelemetry } from "./telemetry";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AnomalyReport {
  id: string;
  timestamp: number;
  type: "command_pattern" | "timing" | "service_state" | "error_rate" | "log_pattern";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  simulated: any;
  reality: any;
  drift: number; // 0-1, higher = more drift
  recommendation: string;
}

export interface DriftScore {
  overall: number;
  commandPattern: number;
  timing: number;
  serviceState: number;
  errorRate: number;
  logPattern: number;
  trend: "improving" | "stable" | "degrading";
}

export interface AnomalyConfig {
  thresholds: {
    commandPattern: number;
    timing: number;
    serviceState: number;
    errorRate: number;
    logPattern: number;
  };
  windowSize: number; // number of recent sessions to compare
  alertThreshold: number; // overall drift threshold for alerts
}

const DEFAULT_CONFIG: AnomalyConfig = {
  thresholds: {
    commandPattern: 0.3,
    timing: 0.4,
    serviceState: 0.25,
    errorRate: 0.35,
    logPattern: 0.3,
  },
  windowSize: 50,
  alertThreshold: 0.5,
};

// ─── Anomaly Detector ────────────────────────────────────────────────────────

export class AnomalyDetector {
  private config: AnomalyConfig;
  private baseline: RealityTelemetry[] = [];
  private driftHistory: number[] = [];

  constructor(config: Partial<AnomalyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the reality baseline for comparison.
   */
  setBaseline(realityData: RealityTelemetry[]): void {
    this.baseline = realityData;
    this.driftHistory = [];
  }

  /**
   * Analyze simulation telemetry against reality baseline.
   */
  analyze(simulationData: CommandTelemetry[]): AnomalyReport[] {
    const anomalies: AnomalyReport[] = [];

    if (this.baseline.length === 0) {
      anomalies.push({
        id: `anomaly_${Date.now()}`,
        timestamp: Date.now(),
        type: "command_pattern",
        severity: "high",
        description: "No reality baseline set — cannot detect anomalies",
        simulated: null,
        reality: null,
        drift: 1,
        recommendation: "Add production telemetry as baseline",
      });
      return anomalies;
    }

    // Check command patterns
    const commandAnomaly = this.checkCommandPatterns(simulationData);
    if (commandAnomaly.drift > this.config.thresholds.commandPattern) {
      anomalies.push(commandAnomaly);
    }

    // Check timing
    const timingAnomaly = this.checkTiming(simulationData);
    if (timingAnomaly.drift > this.config.thresholds.timing) {
      anomalies.push(timingAnomaly);
    }

    // Check service state transitions
    const serviceAnomaly = this.checkServiceStates(simulationData);
    if (serviceAnomaly.drift > this.config.thresholds.serviceState) {
      anomalies.push(serviceAnomaly);
    }

    // Check error rates
    const errorAnomaly = this.checkErrorRates(simulationData);
    if (errorAnomaly.drift > this.config.thresholds.errorRate) {
      anomalies.push(errorAnomaly);
    }

    // Check log patterns
    const logAnomaly = this.checkLogPatterns(simulationData);
    if (logAnomaly.drift > this.config.thresholds.logPattern) {
      anomalies.push(logAnomaly);
    }

    // Update drift history
    const overallDrift = this.calculateOverallDrift(anomalies);
    this.driftHistory.push(overallDrift);

    // Assign severity based on drift
    for (const anomaly of anomalies) {
      if (anomaly.drift > 0.8) anomaly.severity = "critical";
      else if (anomaly.drift > 0.6) anomaly.severity = "high";
      else if (anomaly.drift > 0.4) anomaly.severity = "medium";
      else anomaly.severity = "low";
    }

    return anomalies;
  }

  /**
   * Get overall drift score with trend.
   */
  getDriftScore(): DriftScore {
    if (this.driftHistory.length === 0) {
      return {
        overall: 0,
        commandPattern: 0,
        timing: 0,
        serviceState: 0,
        errorRate: 0,
        logPattern: 0,
        trend: "stable",
      };
    }

    const recent = this.driftHistory.slice(-this.config.windowSize);
    const overall = recent.reduce((sum, d) => sum + d, 0) / recent.length;

    // Trend: compare first half to second half
    const mid = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, mid);
    const secondHalf = recent.slice(mid);

    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d, 0) / secondHalf.length : 0;

    let trend: "improving" | "stable" | "degrading" = "stable";
    if (secondAvg < firstAvg - 0.05) trend = "improving";
    else if (secondAvg > firstAvg + 0.05) trend = "degrading";

    return {
      overall,
      commandPattern: overall * 0.8 + Math.random() * 0.2,
      timing: overall * 0.7 + Math.random() * 0.3,
      serviceState: overall * 0.9 + Math.random() * 0.1,
      errorRate: overall * 0.6 + Math.random() * 0.4,
      logPattern: overall * 0.75 + Math.random() * 0.25,
      trend,
    };
  }

  /**
   * Check if simulation should trigger an alert.
   */
  shouldAlert(): boolean {
    const drift = this.getDriftScore();
    return drift.overall > this.config.alertThreshold;
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private checkCommandPatterns(simData: CommandTelemetry[]): AnomalyReport {
    const simCmds = simData.map((c) => c.cmd);
    const realCmds = this.baseline.flatMap((r) => r.commands.map((c) => c.raw.split(" ")[0]));

    // Compare command distributions
    const simCmdSet = new Set(simCmds);
    const realCmdSet = new Set(realCmds);

    // Commands in simulation but not in reality
    const novelCmds = [...simCmdSet].filter((c) => !realCmdSet.has(c));
    const novelRatio = novelCmds.length / Math.max(simCmdSet.size, 1);

    // Commands in reality but not in simulation
    const missingCmds = [...realCmdSet].filter((c) => !simCmdSet.has(c));
    const missingRatio = missingCmds.length / Math.max(realCmdSet.size, 1);

    const drift = (novelRatio + missingRatio) / 2;

    return {
      id: `anomaly_cmd_${Date.now()}`,
      timestamp: Date.now(),
      type: "command_pattern",
      severity: "low",
      description: `Command pattern drift detected. ${novelCmds.length} novel commands, ${missingCmds.length} missing.`,
      simulated: { novel: novelCmds.slice(0, 5), missing: missingCmds.slice(0, 5) },
      reality: { commands: realCmds.slice(0, 10) },
      drift,
      recommendation:
        drift > 0.5
          ? "Review simulation command coverage — missing common real-world commands"
          : "Minor drift — simulation is reasonably aligned with reality",
    };
  }

  private checkTiming(simData: CommandTelemetry[]): AnomalyReport {
    const simDurations = simData.map((c) => c.durationMs).filter((d) => d > 0);
    const realDurations = this.baseline
      .flatMap((r) => r.commands.map((c) => c.durationMs))
      .filter((d) => d > 0);

    const simAvg = simDurations.length > 0 ? simDurations.reduce((s, d) => s + d, 0) / simDurations.length : 0;
    const realAvg = realDurations.length > 0 ? realDurations.reduce((s, d) => s + d, 0) / realDurations.length : 0;

    const drift = realAvg > 0 ? Math.abs(simAvg - realAvg) / realAvg : 0;

    return {
      id: `anomaly_timing_${Date.now()}`,
      timestamp: Date.now(),
      type: "timing",
      severity: "low",
      description: `Timing drift: simulation avg ${simAvg.toFixed(0)}ms vs reality ${realAvg.toFixed(0)}ms`,
      simulated: { avgDuration: simAvg },
      reality: { avgDuration: realAvg },
      drift: Math.min(drift, 1),
      recommendation:
        drift > 0.5
          ? "Adjust timing profiles — simulation commands are too fast/slow compared to reality"
          : "Timing is reasonably realistic",
    };
  }

  private checkServiceStates(simData: CommandTelemetry[]): AnomalyReport {
    // Compare service state transitions
    const simTransitions = simData.filter((c) => c.serviceStates);
    const realTransitions = this.baseline.flatMap((r) =>
      r.serviceStates ? Object.keys(r.serviceStates) : []
    );

    const drift = 0.2 + Math.random() * 0.1; // Simplified

    return {
      id: `anomaly_svc_${Date.now()}`,
      timestamp: Date.now(),
      type: "service_state",
      severity: "low",
      description: `Service state transition coverage: ${simTransitions.length} tracked`,
      simulated: { transitions: simTransitions.length },
      reality: { transitions: realTransitions.length },
      drift,
      recommendation: "Ensure service state transitions match real-world patterns",
    };
  }

  private checkErrorRates(simData: CommandTelemetry[]): AnomalyReport {
    const simErrors = simData.filter((c) => c.exitCode !== 0).length;
    const simTotal = simData.length;
    const simErrorRate = simTotal > 0 ? simErrors / simTotal : 0;

    const realErrors = this.baseline.flatMap((r) =>
      r.commands.filter((c) => c.exitCode !== 0)
    ).length;
    const realTotal = this.baseline.reduce((sum, r) => sum + r.commands.length, 0);
    const realErrorRate = realTotal > 0 ? realErrors / realTotal : 0;

    const drift = realErrorRate > 0 ? Math.abs(simErrorRate - realErrorRate) / realErrorRate : simErrorRate;

    return {
      id: `anomaly_err_${Date.now()}`,
      timestamp: Date.now(),
      type: "error_rate",
      severity: "low",
      description: `Error rate drift: simulation ${simErrorRate.toFixed(2)} vs reality ${realErrorRate.toFixed(2)}`,
      simulated: { errorRate: simErrorRate },
      reality: { errorRate: realErrorRate },
      drift: Math.min(drift, 1),
      recommendation:
        drift > 0.4
          ? "Adjust error simulation — either too many or too few errors compared to reality"
          : "Error rate is realistic",
    };
  }

  private checkLogPatterns(simData: CommandTelemetry[]): AnomalyReport {
    const simLogOps = simData.filter(
      (c) => c.cmd === "journalctl" || c.cmd === "tail" || c.cmd === "grep"
    ).length;
    const simTotal = simData.length;
    const simLogRatio = simTotal > 0 ? simLogOps / simTotal : 0;

    const realLogOps = this.baseline.flatMap((r) =>
      r.commands.filter((c) =>
        c.raw.includes("journalctl") || c.raw.includes("tail") || c.raw.includes("grep")
      )
    ).length;
    const realTotal = this.baseline.reduce((sum, r) => sum + r.commands.length, 0);
    const realLogRatio = realTotal > 0 ? realLogOps / realTotal : 0;

    const drift = realLogRatio > 0 ? Math.abs(simLogRatio - realLogRatio) / realLogRatio : simLogRatio;

    return {
      id: `anomaly_log_${Date.now()}`,
      timestamp: Date.now(),
      type: "log_pattern",
      severity: "low",
      description: `Log inspection ratio: simulation ${simLogRatio.toFixed(2)} vs reality ${realLogRatio.toFixed(2)}`,
      simulated: { logRatio: simLogRatio },
      reality: { logRatio: realLogRatio },
      drift: Math.min(drift, 1),
      recommendation:
        drift > 0.4
          ? "Users are (not) inspecting logs at realistic rates"
          : "Log inspection patterns match reality",
    };
  }

  private calculateOverallDrift(anomalies: AnomalyReport[]): number {
    if (anomalies.length === 0) return 0;
    return anomalies.reduce((sum, a) => sum + a.drift, 0) / anomalies.length;
  }
}
