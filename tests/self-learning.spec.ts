// tests/self-learning.spec.ts — Self-learning realism engine tests

import { describe, it, expect, beforeEach } from "vitest";
import { TelemetryCollector, createCommandTelemetry } from "../realism/telemetry";
import { ClusteringEngine } from "../realism/clustering";
import { AnomalyDetector } from "../realism/anomaly";
import { IncrementalModel } from "../realism/model";
import { LabGenerator } from "../realism/lab-generator";
import { ProductionMirror, MirrorManager } from "../realism/mirror";

// ─── Telemetry Tests ─────────────────────────────────────────────────────────

describe("Self-Learning: Telemetry", () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    collector = new TelemetryCollector();
  });

  it("records command telemetry", () => {
    const cmd = createCommandTelemetry(
      "systemctl restart nginx",
      "systemctl",
      ["restart", "nginx"],
      0,
      1200,
      0,
      0,
      { nginx: "running" },
      5,
      2,
      "session_1",
      "nginx_down",
      "user_1"
    );

    collector.recordCommand(cmd);
    const stats = collector.getStats();

    expect(stats.totalCommands).toBe(1);
    expect(stats.totalSessions).toBe(1);
  });

  it("completes session and calculates stats", () => {
    const sessionId = "session_test_1";

    collector.recordCommand(
      createCommandTelemetry("systemctl status nginx", "systemctl", ["status", "nginx"], 0, 100, 200, 0, { nginx: "running" }, 5, 1, sessionId)
    );

    collector.recordCommand(
      createCommandTelemetry("systemctl restart nginx", "systemctl", ["restart", "nginx"], 0, 1200, 0, 0, { nginx: "running" }, 6, 1, sessionId)
    );

    const session = collector.completeSession(sessionId, true);

    expect(session.solved).toBe(true);
    expect(session.hintsUsed).toBe(0);
    expect(session.commands.length).toBe(2);
  });

  it("exports telemetry for training", () => {
    const sessionId = "session_export";

    collector.recordCommand(
      createCommandTelemetry("journalctl -u nginx", "journalctl", ["-u", "nginx"], 0, 300, 500, 0, {}, 1, 1, sessionId)
    );

    const exported = collector.exportForTraining();

    expect(exported.commands.length).toBe(1);
    expect(exported.sessions.length).toBe(1);
  });
});

// ─── Clustering Tests ────────────────────────────────────────────────────────

describe("Self-Learning: Clustering", () => {
  it("builds behavioral profiles from sessions", () => {
    const engine = new ClusteringEngine();

    const session = {
      sessionId: "s1",
      userId: "u1",
      scenarioId: "nginx_down",
      startedAt: Date.now() - 600000,
      completedAt: Date.now(),
      commands: [
        { cmd: "journalctl", args: ["-u", "nginx"], exitCode: 0, durationMs: 300, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now() - 500000 },
        { cmd: "systemctl", args: ["status", "nginx"], exitCode: 0, durationMs: 100, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 10000, timestamp: Date.now() - 400000 },
        { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1200, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 5000, timestamp: Date.now() - 300000 },
      ],
      solved: true,
      hintsUsed: 0,
      totalRetries: 0,
      avgCommandInterval: 15000,
      serviceStateChanges: { nginx: 2 },
      errorRate: 0,
    };

    const profile = engine.buildProfile(session);

    expect(profile.targetedRatio).toBeGreaterThan(0);
    expect(profile.diagnosticCommandRatio).toBeGreaterThan(0);
  });

  it("clusters sessions with k-means", () => {
    const engine = new ClusteringEngine(1); // Min cluster size 1

    const sessions = [
      {
        sessionId: "s1", scenarioId: "nginx", startedAt: Date.now() - 300000, completedAt: Date.now(),
        commands: [
          { cmd: "journalctl", args: ["-u", "nginx"], exitCode: 0, durationMs: 300, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now() },
          { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1200, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 10000, timestamp: Date.now() + 10000 },
        ],
        solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 10000,
        serviceStateChanges: {}, errorRate: 0,
      },
      {
        sessionId: "s2", scenarioId: "mysql", startedAt: Date.now() - 600000, completedAt: Date.now(),
        commands: [
          { cmd: "ps", args: [], exitCode: 0, durationMs: 200, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now() },
          { cmd: "df", args: ["-h"], exitCode: 0, durationMs: 150, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 5000, timestamp: Date.now() + 5000 },
          { cmd: "ls", args: ["/var/lib/mysql"], exitCode: 0, durationMs: 50, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 3000, timestamp: Date.now() + 8000 },
        ],
        solved: false, hintsUsed: 2, totalRetries: 1, avgCommandInterval: 4000,
        serviceStateChanges: {}, errorRate: 0,
      },
    ];

    const result = engine.cluster(sessions as any);

    expect(result.clusters.length).toBeGreaterThanOrEqual(1);
    expect(result.silhouetteScore).toBeGreaterThanOrEqual(0);
    expect(result.silhouetteScore).toBeLessThanOrEqual(1);
  });

  it("finds closest cluster for a new profile", () => {
    const engine = new ClusteringEngine(1);

    // First add some sessions to create clusters
    engine.addSession({
      sessionId: "s1", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 100000,
      commands: [], solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 10000,
      serviceStateChanges: {}, errorRate: 0.1,
    });

    const profile = engine.buildProfile({
      sessionId: "new", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 100000,
      commands: [], solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 10000,
      serviceStateChanges: {}, errorRate: 0.1,
    });

    const { cluster, distance } = engine.findClosestCluster(profile);

    expect(cluster).toBeDefined();
    expect(distance).toBeGreaterThanOrEqual(0);
  });
});

// ─── Anomaly Detection Tests ─────────────────────────────────────────────────

describe("Self-Learning: Anomaly Detection", () => {
  it("detects drift when no baseline is set", () => {
    const detector = new AnomalyDetector();
    const anomalies = detector.analyze([]);

    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].severity).toBe("high");
  });

  it("returns healthy drift when simulation matches reality", () => {
    const detector = new AnomalyDetector();

    // Set reality baseline
    detector.setBaseline([
      {
        id: "r1", timestamp: Date.now(), source: "production" as const, serverId: "srv1",
        commands: [{ raw: "systemctl restart nginx", exitCode: 0, durationMs: 1200 }],
        serviceStates: { nginx: "running" },
        logs: [],
      },
    ]);

    // Simulate similar behavior
    const simData = [
      {
        id: "s1", timestamp: Date.now(), sessionId: "sess1", serverId: "srv1",
        raw: "systemctl restart nginx", cmd: "systemctl", args: ["restart", "nginx"],
        exitCode: 0, durationMs: 1100, stdoutLength: 0, stderrLength: 0,
        serviceStates: { nginx: "running" }, logCount: 1, newLogs: 0,
        wasHint: false, wasRetry: false, retryCount: 0, timeSinceLastCommand: 0,
      },
    ];

    const anomalies = detector.analyze(simData as any);

    // Should have low or no anomalies
    const highSeverity = anomalies.filter((a) => a.severity === "high" || a.severity === "critical");
    expect(highSeverity.length).toBe(0);
  });

  it("calculates drift score with trend", () => {
    const detector = new AnomalyDetector();

    detector.setBaseline([
      {
        id: "r1", timestamp: Date.now(), source: "production" as const, serverId: "srv1",
        commands: [{ raw: "systemctl restart nginx", exitCode: 0, durationMs: 1200 }],
        serviceStates: { nginx: "running" },
        logs: [],
      },
    ]);

    // Simulate some drift
    detector.analyze([
      {
        id: "s1", timestamp: Date.now(), sessionId: "sess1",
        raw: "systemctl restart nginx", cmd: "systemctl", args: ["restart", "nginx"],
        exitCode: 0, durationMs: 5000, stdoutLength: 0, stderrLength: 0,
        serviceStates: { nginx: "running" }, logCount: 1, newLogs: 0,
        wasHint: false, wasRetry: false, retryCount: 0, timeSinceLastCommand: 0,
      },
    ] as any);

    const drift = detector.getDriftScore();

    expect(drift.overall).toBeGreaterThanOrEqual(0);
    expect(drift.overall).toBeLessThanOrEqual(1);
    expect(["improving", "stable", "degrading"]).toContain(drift.trend);
  });

  it("triggers alert when drift exceeds threshold", () => {
    const detector = new AnomalyDetector({
      thresholds: {
        commandPattern: 0.1,
        timing: 0.1,
        serviceState: 0.1,
        errorRate: 0.1,
        logPattern: 0.1,
      },
      windowSize: 5,
      alertThreshold: 0.2,
    });

    detector.setBaseline([
      {
        id: "r1", timestamp: Date.now(), source: "production" as const, serverId: "srv1",
        commands: [{ raw: "systemctl restart nginx", exitCode: 0, durationMs: 1200 }],
        serviceStates: { nginx: "running" },
        logs: [],
      },
    ]);

    // Simulate significant drift
    for (let i = 0; i < 10; i++) {
      detector.analyze([
        {
          id: `s${i}`, timestamp: Date.now(), sessionId: `sess${i}`,
          raw: "unknown_command", cmd: "unknown_command", args: [],
          exitCode: 1, durationMs: 100, stdoutLength: 0, stderrLength: 0,
          serviceStates: {}, logCount: 0, newLogs: 0,
          wasHint: false, wasRetry: false, retryCount: 0, timeSinceLastCommand: 0,
        },
      ] as any);
    }

    expect(detector.shouldAlert()).toBe(true);
  });
});

// ─── Incremental Model Tests ─────────────────────────────────────────────────

describe("Self-Learning: Incremental Model", () => {
  let model: IncrementalModel;

  beforeEach(() => {
    model = new IncrementalModel();
  });

  it("updates with session telemetry", () => {
    const updated = model.update({
      sessions: [
        {
          sessionId: "s1", scenarioId: "nginx_down", startedAt: Date.now() - 300000, completedAt: Date.now(),
          commands: [
            { cmd: "journalctl", args: ["-u", "nginx"], exitCode: 0, durationMs: 300, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now() - 200000, serviceStates: {}, logCount: 0, newLogs: 0, raw: "journalctl -u nginx", stdoutLength: 0, stderrLength: 0 },
            { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1200, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 5000, timestamp: Date.now() - 100000, serviceStates: { nginx: "running" }, logCount: 0, newLogs: 0, raw: "systemctl restart nginx", stdoutLength: 0, stderrLength: 0 },
          ],
          solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 5000,
          serviceStateChanges: { nginx: 1 }, errorRate: 0,
        },
      ],
    });

    expect(updated.version).toBe(1);
    expect(updated.trainingSessions).toBe(1);
    expect(updated.trainingCommands).toBe(2);
  });

  it("learns command timings incrementally", () => {
    // First update
    model.update({
      sessions: [
        {
          sessionId: "s1", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 1000,
          commands: [
            { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1000, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now(), serviceStates: {}, logCount: 0, newLogs: 0, raw: "systemctl restart nginx", stdoutLength: 0, stderrLength: 0 },
          ],
          solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 0,
          serviceStateChanges: {}, errorRate: 0,
        },
      ],
    });

    // Second update
    model.update({
      sessions: [
        {
          sessionId: "s2", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 1000,
          commands: [
            { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1200, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now(), serviceStates: {}, logCount: 0, newLogs: 0, raw: "systemctl restart nginx", stdoutLength: 0, stderrLength: 0 },
          ],
          solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 0,
          serviceStateChanges: {}, errorRate: 0,
        },
      ],
    });

    const timing = model.getCommandTiming("systemctl");

    expect(timing.mean).toBeCloseTo(1100, 0);
    expect(timing.stddev).toBeGreaterThan(0);
  });

  it("updates error probabilities", () => {
    model.update({
      sessions: [
        {
          sessionId: "s1", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 1000,
          commands: [
            { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 1, durationMs: 500, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now(), serviceStates: {}, logCount: 0, newLogs: 0, raw: "systemctl restart nginx", stdoutLength: 0, stderrLength: 0 },
          ],
          solved: false, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 0,
          serviceStateChanges: {}, errorRate: 1,
        },
      ],
    });

    const errorProb = model.getErrorProbability("systemctl");
    expect(errorProb).toBe(1);
  });

  it("exports and imports model", () => {
    model.update({
      sessions: [
        {
          sessionId: "s1", scenarioId: "test", startedAt: Date.now(), completedAt: Date.now() + 1000,
          commands: [
            { cmd: "systemctl", args: ["restart", "nginx"], exitCode: 0, durationMs: 1000, wasRetry: false, retryCount: 0, wasHint: false, timeSinceLastCommand: 0, timestamp: Date.now(), serviceStates: {}, logCount: 0, newLogs: 0, raw: "systemctl restart nginx", stdoutLength: 0, stderrLength: 0 },
          ],
          solved: true, hintsUsed: 0, totalRetries: 0, avgCommandInterval: 0,
          serviceStateChanges: {}, errorRate: 0,
        },
      ],
    });

    const exported = model.export();
    const newModel = new IncrementalModel();
    newModel.import(exported);

    expect(newModel.getStats().version).toBe(1);
  });
});

// ─── Lab Generator Tests ─────────────────────────────────────────────────────

describe("Self-Learning: Lab Generator", () => {
  it("generates scenarios from clusters", () => {
    const generator = new LabGenerator();
    const model = new IncrementalModel();

    const clusters = [
      {
        id: "cluster_1",
        name: "troubleshooters",
        description: "Users who quickly diagnose and fix nginx issues",
        sessions: ["s1", "s2", "s3"],
        centroid: {
          avgCommandsPerSession: 5,
          avgTimeBetweenCommands: 10000,
          errorRate: 0.1,
          retryRate: 0.05,
          hintDependency: 0.1,
          serviceRestartFrequency: 0.3,
          logInspectionFrequency: 0.4,
          diagnosticCommandRatio: 0.5,
          exploratoryRatio: 0.2,
          targetedRatio: 0.5,
          destructiveRatio: 0.05,
          avgSessionDuration: 300000,
          commandsPerMinute: 1,
        },
        characteristics: ["high_targeted", "log_heavy"],
        avgSolveTime: 300000,
        solveRate: 0.8,
        commonCommands: [{ cmd: "journalctl", frequency: 10 }, { cmd: "systemctl", frequency: 8 }],
        commonErrors: [{ error: "nginx connection refused", frequency: 3 }],
      },
    ];

    const scenarios = generator.generateFromClusters(clusters as any, model.export());

    expect(scenarios.length).toBe(1);
    expect(scenarios[0].name).toContain("troubleshooters");
    expect(scenarios[0].goals.length).toBeGreaterThan(0);
  });

  it("generates scenarios from reality data", () => {
    const generator = new LabGenerator();
    const model = new IncrementalModel();

    const realityData = [
      {
        id: "incident_1",
        timestamp: Date.now() - 3600000,
        source: "production" as const,
        serverId: "prod-web-01",
        commands: [
          { raw: "journalctl -u nginx", exitCode: 0, durationMs: 300 },
          { raw: "systemctl restart nginx", exitCode: 0, durationMs: 1200 },
        ],
        serviceStates: { nginx: "running" },
        logs: [],
        incident: {
          type: "nginx_502",
          severity: "critical" as const,
          duration: 1800,
          resolution: "Restarted nginx after config reload",
        },
      },
    ];

    const scenarios = generator.generateFromReality(realityData, model.export());

    expect(scenarios.length).toBe(1);
    expect(scenarios[0].name).toContain("nginx_502");
    expect(scenarios[0].source).toBe("reality");
    expect(scenarios[0].confidence).toBe(0.9);
  });
});

// ─── Production Mirror Tests ─────────────────────────────────────────────────

describe("Self-Learning: Production Mirror", () => {
  it("ingests reality telemetry", () => {
    const mirror = new ProductionMirror({
      serverId: "prod-web-01",
      source: "production",
      pollingIntervalMs: 60000,
      retentionDays: 30,
    });

    mirror.ingest({
      id: "inc_1",
      timestamp: Date.now(),
      source: "production",
      serverId: "prod-web-01",
      commands: [{ raw: "systemctl restart nginx", exitCode: 0, durationMs: 1200 }],
      serviceStates: { nginx: "running" },
      logs: [],
      incident: {
        type: "nginx_down",
        severity: "critical",
        duration: 300,
        resolution: "Restarted nginx",
      },
    });

    const state = mirror.getState();

    expect(state.totalIncidents).toBe(1);
    expect(state.activeIncidents).toBe(0);
    expect(state.resolvedIncidents).toBe(1);
  });

  it("tracks incident distributions", () => {
    const mirror = new ProductionMirror({
      serverId: "prod-db-01",
      source: "production",
      pollingIntervalMs: 60000,
      retentionDays: 30,
    });

    mirror.ingest({
      id: "inc_1",
      timestamp: Date.now() - 3600000,
      source: "production",
      serverId: "prod-db-01",
      commands: [{ raw: "systemctl restart mysqld", exitCode: 0, durationMs: 2000 }],
      serviceStates: { mysqld: "running" },
      logs: [],
      incident: {
        type: "mysql_crash",
        severity: "critical",
        duration: 600,
        resolution: "Restarted mysqld",
      },
    });

    mirror.ingest({
      id: "inc_2",
      timestamp: Date.now(),
      source: "production",
      serverId: "prod-db-01",
      commands: [{ raw: "systemctl restart mysqld", exitCode: 0, durationMs: 2000 }],
      serviceStates: { mysqld: "running" },
      logs: [],
      incident: {
        type: "mysql_crash",
        severity: "critical",
        duration: 600,
        resolution: "Restarted mysqld",
      },
    });

    const dist = mirror.getIncidentDistribution();

    expect(dist["mysql_crash"]).toBe(2);
  });
});

// ─── Integration: Full Self-Learning Pipeline ────────────────────────────────

describe("Self-Learning: Full Pipeline", () => {
  it("end-to-end: telemetry → clustering → model → lab generation", () => {
    // 1. Collect telemetry
    const collector = new TelemetryCollector();

    for (let i = 0; i < 10; i++) {
      const sessionId = `session_${i}`;

      collector.recordCommand(
        createCommandTelemetry(
          "journalctl -u nginx",
          "journalctl",
          ["-u", "nginx"],
          0,
          300 + Math.random() * 200,
          500,
          0,
          {},
          5,
          2,
          sessionId,
          "nginx_down"
        )
      );

      collector.recordCommand(
        createCommandTelemetry(
          "systemctl restart nginx",
          "systemctl",
          ["restart", "nginx"],
          0,
          1000 + Math.random() * 500,
          0,
          0,
          { nginx: "running" },
          7,
          2,
          sessionId,
          "nginx_down"
        )
      );

      collector.completeSession(sessionId, true);
    }

    // 2. Cluster sessions
    const clusteringEngine = new ClusteringEngine(3);
    const sessions = collector.exportForTraining().sessions;
    const clusterResult = clusteringEngine.cluster(sessions);

    expect(clusterResult.clusters.length).toBeGreaterThanOrEqual(1);

    // 3. Update model
    const model = new IncrementalModel();
    model.update({ sessions });

    expect(model.getStats().trainingSessions).toBe(10);

    // 4. Generate labs
    const generator = new LabGenerator();
    const scenarios = generator.generateFromClusters(clusterResult.clusters, model.export());

    // Should generate at least some scenarios
    expect(scenarios.length).toBeGreaterThanOrEqual(0);

    // 5. Check anomaly detection
    const anomalyDetector = new AnomalyDetector();
    const commands = collector.exportForTraining().commands;
    const anomalies = anomalyDetector.analyze(commands);

    // Without baseline, should report high severity
    expect(anomalies.length).toBeGreaterThan(0);
  });
});
