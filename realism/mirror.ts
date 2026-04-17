// realism/mirror.ts — Production monitoring mirror

import type { RealityTelemetry } from "./telemetry";
import type { DriftScore, AnomalyReport } from "./anomaly";
import { AnomalyDetector } from "./anomaly";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MirrorConfig {
  serverId: string;
  source: "production" | "staging" | "lab";
  pollingIntervalMs: number;
  retentionDays: number;
  alertWebhook?: (reports: AnomalyReport[]) => void;
}

export interface MirrorState {
  lastSync: number;
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  avgResolutionTime: number;
  driftScore: DriftScore;
  recentAnomalies: AnomalyReport[];
  healthStatus: "healthy" | "degraded" | "critical";
}

export interface IncidentReport {
  id: string;
  serverId: string;
  type: string;
  severity: "critical" | "warning" | "info";
  startedAt: number;
  resolvedAt?: number;
  commands: Array<{
    raw: string;
    exitCode: number;
    durationMs: number;
    timestamp: number;
  }>;
  serviceStates: Record<string, string>;
  logs: Array<{
    timestamp: number;
    source: string;
    level: string;
    message: string;
  }>;
  resolution?: string;
}

// ─── Production Mirror Monitor ───────────────────────────────────────────────

export class ProductionMirror {
  private config: MirrorConfig;
  private incidents: IncidentReport[] = [];
  private telemetry: RealityTelemetry[] = [];
  private anomalyDetector: AnomalyDetector;
  private state: MirrorState;

  constructor(config: MirrorConfig) {
    this.config = config;
    this.anomalyDetector = new AnomalyDetector();
    this.state = {
      lastSync: 0,
      totalIncidents: 0,
      activeIncidents: 0,
      resolvedIncidents: 0,
      avgResolutionTime: 0,
      driftScore: {
        overall: 0,
        commandPattern: 0,
        timing: 0,
        serviceState: 0,
        errorRate: 0,
        logPattern: 0,
        trend: "stable",
      },
      recentAnomalies: [],
      healthStatus: "healthy",
    };
  }

  /**
   * Ingest reality telemetry from a server.
   */
  ingest(telemetry: RealityTelemetry): void {
    this.telemetry.push(telemetry);

    if (telemetry.incident) {
      const incident: IncidentReport = {
        id: telemetry.id,
        serverId: telemetry.serverId,
        type: telemetry.incident.type,
        severity: telemetry.incident.severity,
        startedAt: telemetry.timestamp - telemetry.incident.duration * 1000,
        resolvedAt: telemetry.incident.resolution ? telemetry.timestamp : undefined,
        commands: telemetry.commands,
        serviceStates: telemetry.serviceStates,
        logs: telemetry.logs,
        resolution: telemetry.incident.resolution,
      };

      this.incidents.push(incident);
      this.state.totalIncidents++;

      if (telemetry.incident.resolution) {
        this.state.resolvedIncidents++;
      } else {
        this.state.activeIncidents++;
      }

      // Update avg resolution time
      const resolved = this.incidents.filter((i) => i.resolvedAt);
      if (resolved.length > 0) {
        this.state.avgResolutionTime =
          resolved.reduce(
            (sum, i) => sum + (i.resolvedAt! - i.startedAt),
            0
          ) / resolved.length;
      }
    }

    // Update anomaly detection
    this.analyze();

    this.state.lastSync = Date.now();
  }

  /**
   * Run anomaly analysis against current simulation model.
   */
  private analyze(): void {
    // Update baseline with all reality data
    this.anomalyDetector.setBaseline(this.telemetry);

    // Get drift score
    this.state.driftScore = this.anomalyDetector.getDriftScore();

    // Check for alerts
    if (this.anomalyDetector.shouldAlert()) {
      const anomalies = this.anomalyDetector.analyze(
        this.telemetry.flatMap((t) =>
          t.commands.map((c, i) => ({
            id: `${t.id}-${i}`,
            timestamp: t.timestamp,
            sessionId: t.id,
            serverId: t.serverId,
            raw: c.raw,
            cmd: c.raw.split(" ")[0],
            args: c.raw.split(" ").slice(1),
            exitCode: c.exitCode,
            durationMs: c.durationMs,
            stdoutLength: 0,
            stderrLength: 0,
            serviceStates: t.serviceStates,
            logCount: t.logs.length,
            newLogs: 0,
            wasHint: false,
            wasRetry: false,
            retryCount: 0,
            timeSinceLastCommand: 0,
          }))
        )
      );

      this.state.recentAnomalies = anomalies;

      // Update health status
      const criticalAnomalies = anomalies.filter((a) => a.severity === "critical");
      const highAnomalies = anomalies.filter((a) => a.severity === "high");

      if (criticalAnomalies.length > 0) {
        this.state.healthStatus = "critical";
      } else if (highAnomalies.length > 0) {
        this.state.healthStatus = "degraded";
      } else {
        this.state.healthStatus = "healthy";
      }

      // Trigger webhook if configured
      if (this.config.alertWebhook && anomalies.length > 0) {
        this.config.alertWebhook(anomalies);
      }
    }
  }

  /**
   * Get current mirror state.
   */
  getState(): MirrorState {
    return { ...this.state };
  }

  /**
   * Get all incidents.
   */
  getIncidents(filter?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
  }): IncidentReport[] {
    let incidents = [...this.incidents];

    if (filter?.type) {
      incidents = incidents.filter((i) => i.type === filter.type);
    }

    if (filter?.severity) {
      incidents = incidents.filter((i) => i.severity === filter.severity);
    }

    if (filter?.resolved !== undefined) {
      incidents = incidents.filter((i) =>
        filter.resolved ? !!i.resolvedAt : !i.resolvedAt
      );
    }

    return incidents;
  }

  /**
   * Get recent anomalies.
   */
  getAnomalies(): AnomalyReport[] {
    return [...this.state.recentAnomalies];
  }

  /**
   * Get telemetry data.
   */
  getTelemetry(): RealityTelemetry[] {
    return [...this.telemetry];
  }

  /**
   * Get incident type distribution.
   */
  getIncidentDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};

    for (const incident of this.incidents) {
      dist[incident.type] = (dist[incident.type] || 0) + 1;
    }

    return dist;
  }

  /**
   * Get severity distribution.
   */
  getSeverityDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};

    for (const incident of this.incidents) {
      dist[incident.severity] = (dist[incident.severity] || 0) + 1;
    }

    return dist;
  }
}

// ─── Multi-Server Mirror Manager ─────────────────────────────────────────────

export class MirrorManager {
  private mirrors: Map<string, ProductionMirror> = new Map();

  /**
   * Add a server to monitor.
   */
  addServer(config: MirrorConfig): ProductionMirror {
    const mirror = new ProductionMirror(config);
    this.mirrors.set(config.serverId, mirror);
    return mirror;
  }

  /**
   * Get mirror for a server.
   */
  getMirror(serverId: string): ProductionMirror | undefined {
    return this.mirrors.get(serverId);
  }

  /**
   * Get aggregate health across all servers.
   */
  getAggregateHealth(): {
    totalServers: number;
    healthy: number;
    degraded: number;
    critical: number;
    totalIncidents: number;
    avgResolutionTime: number;
  } {
    let healthy = 0;
    let degraded = 0;
    let critical = 0;
    let totalIncidents = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const mirror of this.mirrors.values()) {
      const state = mirror.getState();
      if (state.healthStatus === "healthy") healthy++;
      else if (state.healthStatus === "degraded") degraded++;
      else critical++;

      totalIncidents += state.totalIncidents;
      if (state.resolvedIncidents > 0) {
        totalResolutionTime += state.avgResolutionTime * state.resolvedIncidents;
        resolvedCount += state.resolvedIncidents;
      }
    }

    return {
      totalServers: this.mirrors.size,
      healthy,
      degraded,
      critical,
      totalIncidents,
      avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }

  /**
   * Ingest telemetry for a specific server.
   */
  ingest(serverId: string, telemetry: RealityTelemetry): void {
    const mirror = this.mirrors.get(serverId);
    if (mirror) {
      mirror.ingest(telemetry);
    }
  }
}
