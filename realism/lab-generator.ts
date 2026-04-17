// realism/lab-generator.ts — Auto-generate lab scenarios from model data

import type { SimulationModel } from "./model";
import type { Cluster } from "./clustering";
import type { RealityTelemetry } from "./telemetry";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedScenario {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  category: string;

  // Initial state
  services: Record<string, string>;
  storage?: {
    raid?: {
      status: string;
      missingBlocks: number;
    };
  };
  network?: {
    latencyMs: number;
    drops: number;
  };

  // Goals
  goals: Array<{
    id: string;
    description: string;
    check: string; // Serialized check expression
  }>;

  // Expected diagnostic path
  expectedPath: string[];

  // Hints
  hints: string[];

  // Scoring
  scoring: {
    basePoints: number;
    timeLimit: number;
    hintPenalty: number;
    errorPenalty: number;
  };

  // Metadata
  source: "clustering" | "reality" | "model";
  confidence: number;
}

export interface GenerationConfig {
  minConfidence: number;
  maxScenarios: number;
  difficultyDistribution: Record<string, number>;
  categories: string[];
}

const DEFAULT_CONFIG: GenerationConfig = {
  minConfidence: 0.3,
  maxScenarios: 10,
  difficultyDistribution: {
    easy: 0.2,
    medium: 0.4,
    hard: 0.3,
    expert: 0.1,
  },
  categories: ["web", "database", "network", "storage", "security", "memory"],
};

// ─── Lab Generator ───────────────────────────────────────────────────────────

export class LabGenerator {
  private config: GenerationConfig;

  constructor(config: Partial<GenerationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate scenarios from clustering data.
   */
  generateFromClusters(
    clusters: Cluster[],
    model: SimulationModel
  ): GeneratedScenario[] {
    const scenarios: GeneratedScenario[] = [];

    for (const cluster of clusters) {
      if (cluster.sessions.length < 3) continue;

      // Extract incident pattern from cluster characteristics
      const incident = this.extractIncidentPattern(cluster);
      if (!incident) continue;

      const scenario: GeneratedScenario = {
        id: `cluster_${cluster.id}`,
        name: this.generateName(cluster),
        description: cluster.description,
        difficulty: this.estimateDifficulty(cluster),
        category: this.categorizeIncident(incident),
        services: this.generateInitialState(incident),
        goals: [
          {
            id: "service_restored",
            description: `Restore ${incident.affectedService} to running state`,
            check: `env.services['${incident.affectedService}'].status === 'running'`,
          },
          {
            id: "root_cause_found",
            description: "Identify the root cause of the issue",
            check: `user.runDiagnostic("${incident.diagnosticCommand}")`,
          },
        ],
        expectedPath: this.generateExpectedPath(incident),
        hints: this.generateHints(incident),
        scoring: {
          basePoints: this.calculateBasePoints(cluster),
          timeLimit: this.calculateTimeLimit(cluster),
          hintPenalty: 50,
          errorPenalty: 25,
        },
        source: "clustering",
        confidence: cluster.solveRate,
      };

      scenarios.push(scenario);
    }

    return scenarios.slice(0, this.config.maxScenarios);
  }

  /**
   * Generate scenarios from production reality data.
   */
  generateFromReality(
    realityData: RealityTelemetry[],
    model: SimulationModel
  ): GeneratedScenario[] {
    const scenarios: GeneratedScenario[] = [];

    for (const reality of realityData) {
      if (!reality.incident) continue;

      const scenario: GeneratedScenario = {
        id: `reality_${reality.id}`,
        name: this.generateRealityName(reality),
        description: `Production incident on ${reality.serverId}: ${reality.incident.type}`,
        difficulty: this.estimateRealityDifficulty(reality),
        category: this.categorizeIncidentType(reality.incident.type),
        services: this.generateRealityInitialState(reality),
        goals: [
          {
            id: "incident_resolved",
            description: `Resolve ${reality.incident.type} incident`,
            check: `env.services.status !== 'failed'`,
          },
          {
            id: "root_cause",
            description: "Identify and fix root cause",
            check: `user.resolveRootCause()`,
          },
        ],
        expectedPath: reality.commands.map((c) => c.raw),
        hints: this.generateRealityHints(reality),
        scoring: {
          basePoints: this.calculateRealityBasePoints(reality),
          timeLimit: reality.incident.duration * 1000,
          hintPenalty: 50,
          errorPenalty: 25,
        },
        source: "reality",
        confidence: 0.9, // High confidence since it's from production
      };

      scenarios.push(scenario);
    }

    return scenarios.slice(0, this.config.maxScenarios);
  }

  /**
   * Generate scenarios from model patterns.
   */
  generateFromModel(model: SimulationModel): GeneratedScenario[] {
    const scenarios: GeneratedScenario[] = [];

    // Generate scenarios from common diagnostic paths
    for (const path of model.diagnosticPaths) {
      if (path.frequency < 3) continue;

      const scenario: GeneratedScenario = {
        id: `model_${path.scenarioId}`,
        name: this.generateModelName(path),
        description: `Common troubleshooting scenario for ${path.scenarioId}`,
        difficulty: this.estimateModelDifficulty(model, path.scenarioId),
        category: this.categorizeFromPath(path.path),
        services: this.generateModelInitialState(path),
        goals: [
          {
            id: "resolve",
            description: "Resolve the issue",
            check: `user.isResolved()`,
          },
        ],
        expectedPath: path.path,
        hints: this.generateModelHints(path),
        scoring: {
          basePoints: Math.round(500 + (1 - path.successRate) * 500),
          timeLimit: 600000,
          hintPenalty: 50,
          errorPenalty: 25,
        },
        source: "model",
        confidence: path.successRate,
      };

      scenarios.push(scenario);
    }

    return scenarios.slice(0, this.config.maxScenarios);
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private extractIncidentPattern(cluster: Cluster): {
    affectedService: string;
    diagnosticCommand: string;
    commonError: string;
  } | null {
    // Find most common error in cluster
    if (cluster.commonErrors.length === 0) return null;

    const topError = cluster.commonErrors[0];
    const topCommand = cluster.commonCommands[0];

    return {
      affectedService: this.inferServiceFromError(topError.error),
      diagnosticCommand: topCommand.cmd,
      commonError: topError.error,
    };
  }

  private inferServiceFromError(error: string): string {
    if (error.includes("nginx") || error.includes("httpd")) return "httpd";
    if (error.includes("mysql") || error.includes("mysqld")) return "mysqld";
    if (error.includes("ssh")) return "sshd";
    if (error.includes("disk") || error.includes("storage")) return "storage";
    return "unknown";
  }

  private generateName(cluster: Cluster): string {
    const characteristics = cluster.characteristics.join(", ");
    return `Cluster Scenario: ${cluster.name}`;
  }

  private generateRealityName(reality: RealityTelemetry): string {
    return `Production: ${reality.incident?.type || "Unknown"}`;
  }

  private generateModelName(path: any): string {
    return `Model Scenario: ${path.scenarioId}`;
  }

  private estimateDifficulty(cluster: Cluster): "easy" | "medium" | "hard" | "expert" {
    if (cluster.solveRate > 0.8) return "easy";
    if (cluster.solveRate > 0.5) return "medium";
    if (cluster.solveRate > 0.3) return "hard";
    return "expert";
  }

  private estimateRealityDifficulty(reality: RealityTelemetry): "easy" | "medium" | "hard" | "expert" {
    if (!reality.incident) return "medium";
    if (reality.incident.severity === "critical") return "expert";
    if (reality.incident.severity === "warning") return "hard";
    return "medium";
  }

  private estimateModelDifficulty(model: SimulationModel, scenarioId: string): "easy" | "medium" | "hard" | "expert" {
    const diff = model.scenarioDifficulty[scenarioId];
    if (!diff) return "medium";
    if (diff.solveRate > 0.8) return "easy";
    if (diff.solveRate > 0.5) return "medium";
    if (diff.solveRate > 0.3) return "hard";
    return "expert";
  }

  private categorizeIncident(incident: any): string {
    const svc = incident.affectedService;
    if (svc === "httpd" || svc === "nginx") return "web";
    if (svc === "mysqld") return "database";
    if (svc === "sshd") return "security";
    if (svc === "storage") return "storage";
    return "general";
  }

  private categorizeIncidentType(type: string): string {
    if (type.includes("nginx") || type.includes("apache")) return "web";
    if (type.includes("mysql")) return "database";
    if (type.includes("disk")) return "storage";
    if (type.includes("network")) return "network";
    return "general";
  }

  private categorizeFromPath(path: string[]): string {
    const cmdString = path.join(" ");
    if (cmdString.includes("nginx") || cmdString.includes("httpd")) return "web";
    if (cmdString.includes("mysql")) return "database";
    if (cmdString.includes("network") || cmdString.includes("ip ")) return "network";
    if (cmdString.includes("mdadm") || cmdString.includes("lvm")) return "storage";
    return "general";
  }

  private generateInitialState(incident: any): Record<string, string> {
    return {
      [incident.affectedService]: "failed",
    };
  }

  private generateRealityInitialState(reality: RealityTelemetry): Record<string, string> {
    return reality.serviceStates;
  }

  private generateModelInitialState(path: any): Record<string, string> {
    return {};
  }

  private generateExpectedPath(incident: any): string[] {
    return [
      `journalctl -u ${incident.affectedService}`,
      `systemctl status ${incident.affectedService}`,
      incident.diagnosticCommand,
      `systemctl restart ${incident.affectedService}`,
    ];
  }

  private generateHints(incident: any): string[] {
    return [
      `Check the status of ${incident.affectedService}`,
      `Look at the logs: journalctl -u ${incident.affectedService}`,
      `Common fix: ${incident.commonError}`,
    ];
  }

  private generateRealityHints(reality: RealityTelemetry): string[] {
    return reality.incident
      ? [
          `This is a real production incident: ${reality.incident.type}`,
          `Resolution took ${reality.incident.duration}s in production`,
        ]
      : [];
  }

  private generateModelHints(path: any): string[] {
    return [`This scenario was generated from ${path.frequency} successful sessions`];
  }

  private calculateBasePoints(cluster: Cluster): number {
    const base = 500;
    const difficultyMultiplier = 1 + (1 - cluster.solveRate) * 2;
    return Math.round(base * difficultyMultiplier);
  }

  private calculateRealityBasePoints(reality: RealityTelemetry): number {
    if (!reality.incident) return 500;
    if (reality.incident.severity === "critical") return 1500;
    if (reality.incident.severity === "warning") return 1000;
    return 750;
  }

  private calculateTimeLimit(cluster: Cluster): number {
    return Math.max(120000, cluster.avgSolveTime * 1.5);
  }
}
