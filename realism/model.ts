// realism/model.ts — Incremental learning model for simulation realism

import type { BehavioralProfile } from "./clustering";
import type { CommandTelemetry, RealityTelemetry, SessionTelemetry } from "./telemetry";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SimulationModel {
  version: number;
  updatedAt: number;
  trainingSessions: number;
  trainingCommands: number;

  // Command timing model
  commandTimings: Record<
    string,
    {
      mean: number;
      stddev: number;
      samples: number;
    }
  >;

  // Error probability model
  errorProbabilities: Record<
    string,
    {
      probability: number;
      samples: number;
    }
  >;

  // Service state transition probabilities
  serviceTransitions: Record<
    string,
    Record<string, number> // from_state -> to_state count
  >;

  // Behavioral profiles
  behavioralProfiles: Record<string, BehavioralProfile>;

  // Scenario difficulty estimates
  scenarioDifficulty: Record<
    string,
    {
      avgSolveTime: number;
      solveRate: number;
      avgHints: number;
      samples: number;
    }
  >;

  // Common diagnostic paths (command sequences)
  diagnosticPaths: Array<{
    scenarioId: string;
    path: string[];
    frequency: number;
    successRate: number;
  }>;
}

export interface ModelUpdate {
  sessions: SessionTelemetry[];
  realities?: RealityTelemetry[];
}

// ─── Incremental Model ───────────────────────────────────────────────────────

export class IncrementalModel {
  private model: SimulationModel;

  constructor() {
    this.model = this.createEmptyModel();
  }

  /**
   * Update model with new telemetry data.
   */
  update(update: ModelUpdate): SimulationModel {
    const { sessions, realities = [] } = update;

    // Update command timing model
    for (const session of sessions) {
      for (const cmd of session.commands) {
        this.updateCommandTiming(cmd.cmd, cmd.durationMs);
        this.updateErrorProbability(cmd.cmd, cmd.exitCode);
      }
    }

    // Update service transition model
    for (const session of sessions) {
      for (const cmd of session.commands) {
        this.updateServiceTransitions(cmd.serviceStates);
      }
    }

    // Update scenario difficulty
    for (const session of sessions) {
      if (session.scenarioId) {
        this.updateScenarioDifficulty(session);
      }
    }

    // Update diagnostic paths
    this.updateDiagnosticPaths(sessions);

    // Incorporate reality data
    for (const reality of realities) {
      this.updateFromReality(reality);
    }

    this.model.version++;
    this.model.updatedAt = Date.now();
    this.model.trainingSessions += sessions.length;
    this.model.trainingCommands += sessions.reduce((sum, s) => sum + s.commands.length, 0);

    return this.model;
  }

  /**
   * Get estimated timing for a command.
   */
  getCommandTiming(cmd: string): { mean: number; stddev: number } {
    const timing = this.model.commandTimings[cmd];
    if (!timing) {
      return { mean: 100, stddev: 50 }; // Default
    }
    return { mean: timing.mean, stddev: timing.stddev };
  }

  /**
   * Get error probability for a command.
   */
  getErrorProbability(cmd: string): number {
    const prob = this.model.errorProbabilities[cmd];
    if (!prob) return 0.1; // Default 10% error rate
    return prob.probability;
  }

  /**
   * Get scenario difficulty estimate.
   */
  getScenarioDifficulty(scenarioId: string): {
    avgSolveTime: number;
    solveRate: number;
    avgHints: number;
  } {
    const diff = this.model.scenarioDifficulty[scenarioId];
    if (!diff) {
      return { avgSolveTime: 300000, solveRate: 0.5, avgHints: 3 };
    }
    return {
      avgSolveTime: diff.avgSolveTime,
      solveRate: diff.solveRate,
      avgHints: diff.avgHints,
    };
  }

  /**
   * Get most common diagnostic path for a scenario.
   */
  getCommonPath(scenarioId: string): string[] {
    const paths = this.model.diagnosticPaths.filter((p) => p.scenarioId === scenarioId);
    if (paths.length === 0) return [];
    return paths.sort((a, b) => b.frequency - a.frequency)[0].path;
  }

  /**
   * Export the model.
   */
  export(): SimulationModel {
    return JSON.parse(JSON.stringify(this.model));
  }

  /**
   * Import a model.
   */
  import(model: SimulationModel): void {
    this.model = model;
  }

  /**
   * Get model stats.
   */
  getStats(): {
    version: number;
    trainingSessions: number;
    trainingCommands: number;
    commandCount: number;
    scenarioCount: number;
    pathCount: number;
  } {
    return {
      version: this.model.version,
      trainingSessions: this.model.trainingSessions,
      trainingCommands: this.model.trainingCommands,
      commandCount: Object.keys(this.model.commandTimings).length,
      scenarioCount: Object.keys(this.model.scenarioDifficulty).length,
      pathCount: this.model.diagnosticPaths.length,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private createEmptyModel(): SimulationModel {
    return {
      version: 0,
      updatedAt: Date.now(),
      trainingSessions: 0,
      trainingCommands: 0,
      commandTimings: {},
      errorProbabilities: {},
      serviceTransitions: {},
      behavioralProfiles: {},
      scenarioDifficulty: {},
      diagnosticPaths: [],
    };
  }

  private updateCommandTiming(cmd: string, durationMs: number): void {
    if (!this.model.commandTimings[cmd]) {
      this.model.commandTimings[cmd] = { mean: durationMs, stddev: 0, samples: 1 };
      return;
    }

    const existing = this.model.commandTimings[cmd];
    const newSamples = existing.samples + 1;
    const delta = durationMs - existing.mean;
    existing.mean += delta / newSamples;
    existing.stddev = Math.sqrt(
      (existing.stddev ** 2 * (newSamples - 1) + delta ** 2) / newSamples
    );
    existing.samples = newSamples;
  }

  private updateErrorProbability(cmd: string, exitCode: number): void {
    if (!this.model.errorProbabilities[cmd]) {
      this.model.errorProbabilities[cmd] = {
        probability: exitCode !== 0 ? 1 : 0,
        samples: 1,
      };
      return;
    }

    const existing = this.model.errorProbabilities[cmd];
    const newSamples = existing.samples + 1;
    existing.probability =
      existing.probability * existing.samples + (exitCode !== 0 ? 1 : 0);
    existing.probability /= newSamples;
    existing.samples = newSamples;
  }

  private updateServiceTransitions(states: Record<string, string>): void {
    for (const [svc, state] of Object.entries(states)) {
      if (!this.model.serviceTransitions[svc]) {
        this.model.serviceTransitions[svc] = {};
      }
      this.model.serviceTransitions[svc][state] =
        (this.model.serviceTransitions[svc][state] || 0) + 1;
    }
  }

  private updateScenarioDifficulty(session: SessionTelemetry): void {
    const id = session.scenarioId;
    if (!id) return;

    if (!this.model.scenarioDifficulty[id]) {
      this.model.scenarioDifficulty[id] = {
        avgSolveTime: session.completedAt
          ? session.completedAt - session.startedAt
          : 0,
        solveRate: session.solved ? 1 : 0,
        avgHints: session.hintsUsed,
        samples: 1,
      };
      return;
    }

    const existing = this.model.scenarioDifficulty[id];
    const newSamples = existing.samples + 1;

    existing.avgSolveTime =
      (existing.avgSolveTime * existing.samples +
        (session.completedAt ? session.completedAt - session.startedAt : 0)) /
      newSamples;
    existing.solveRate =
      (existing.solveRate * existing.samples + (session.solved ? 1 : 0)) / newSamples;
    existing.avgHints =
      (existing.avgHints * existing.samples + session.hintsUsed) / newSamples;
    existing.samples = newSamples;
  }

  private updateDiagnosticPaths(sessions: SessionTelemetry[]): void {
    for (const session of sessions) {
      if (!session.scenarioId) continue;

      const path = session.commands.map((c) => `${c.cmd} ${c.args.join(" ")}`);

      // Check if this path already exists
      const existing = this.model.diagnosticPaths.find(
        (p) => p.scenarioId === session.scenarioId && this.pathsSimilar(p.path, path)
      );

      if (existing) {
        existing.frequency++;
        existing.successRate =
          (existing.successRate * (existing.frequency - 1) + (session.solved ? 1 : 0)) /
          existing.frequency;
      } else {
        this.model.diagnosticPaths.push({
          scenarioId: session.scenarioId,
          path,
          frequency: 1,
          successRate: session.solved ? 1 : 0,
        });
      }
    }
  }

  private updateFromReality(reality: RealityTelemetry): void {
    // Incorporate real server data into model
    for (const cmd of reality.commands) {
      const cmdName = cmd.raw.split(" ")[0];
      this.updateCommandTiming(cmdName, cmd.durationMs);
      this.updateErrorProbability(cmdName, cmd.exitCode);
    }

    this.updateServiceTransitions(reality.serviceStates);
  }

  private pathsSimilar(a: string[], b: string[]): boolean {
    // Simple similarity: overlap ratio
    const setA = new Set(a.map((x) => x.split(" ")[0])); // Just commands
    const setB = new Set(b.map((x) => x.split(" ")[0]));

    let overlap = 0;
    for (const cmd of setA) {
      if (setB.has(cmd)) overlap++;
    }

    const similarity = overlap / Math.max(setA.size, setB.size);
    return similarity > 0.6;
  }
}
