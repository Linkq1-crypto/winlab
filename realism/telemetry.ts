// realism/telemetry.ts — Command/behavioral telemetry collector

import type { Env, ServiceState, LogEntry } from "./state";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CommandTelemetry {
  id: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  scenarioId?: string;

  // Command
  raw: string;
  cmd: string;
  args: string[];

  // Execution
  exitCode: number;
  durationMs: number;
  stdoutLength: number;
  stderrLength: number;

  // State snapshot before/after
  serviceStates: Record<string, ServiceState>;
  logCount: number;
  newLogs: number;

  // Behavioral
  wasHint: boolean;
  wasRetry: boolean;
  retryCount: number;
  timeSinceLastCommand: number;
}

export interface SessionTelemetry {
  sessionId: string;
  userId?: string;
  scenarioId?: string;
  startedAt: number;
  completedAt?: number;
  commands: CommandTelemetry[];
  solved: boolean;
  hintsUsed: number;
  totalRetries: number;
  avgCommandInterval: number;
  serviceStateChanges: Record<string, number>;
  errorRate: number;
}

export interface RealityTelemetry {
  id: string;
  timestamp: number;
  source: "production" | "staging" | "lab";
  serverId: string;

  // What happened
  commands: Array<{
    raw: string;
    exitCode: number;
    durationMs: number;
  }>;
  serviceStates: Record<string, ServiceState>;
  logs: LogEntry[];
  incident?: {
    type: string;
    severity: "critical" | "warning" | "info";
    duration: number;
    resolution: string;
  };
}

// ─── Telemetry Collector ─────────────────────────────────────────────────────

export class TelemetryCollector {
  private sessions: Map<string, SessionTelemetry> = new Map();
  private commands: CommandTelemetry[] = [];
  private realities: RealityTelemetry[] = [];
  private storage: TelemetryStorage;

  constructor(storage?: TelemetryStorage) {
    this.storage = storage || new InMemoryStorage();
  }

  /**
   * Record a command execution.
   */
  recordCommand(cmd: CommandTelemetry): void {
    this.commands.push(cmd);

    // Update session
    let session = this.sessions.get(cmd.sessionId);
    if (!session) {
      session = this.createSession(cmd.sessionId, cmd.userId, cmd.scenarioId);
    }

    session.commands.push(cmd);

    // Track service state changes
    for (const [svc, state] of Object.entries(cmd.serviceStates)) {
      if (!session.serviceStateChanges[svc]) {
        session.serviceStateChanges[svc] = 0;
      }
      session.serviceStateChanges[svc]++;
    }

    // Save to storage
    this.storage.saveCommand(cmd);
    this.storage.saveSession(session);
  }

  /**
   * Mark a session as complete.
   */
  completeSession(sessionId: string, solved: boolean): SessionTelemetry {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.completedAt = Date.now();
    session.solved = solved;
    session.hintsUsed = session.commands.filter((c) => c.wasHint).length;
    session.totalRetries = session.commands.reduce((sum, c) => sum + c.retryCount, 0);

    // Calculate avg command interval
    if (session.commands.length > 1) {
      const intervals = session.commands.slice(1).map(
        (c, i) => c.timestamp - session.commands[i].timestamp
      );
      session.avgCommandInterval =
        intervals.reduce((sum, t) => sum + t, 0) / intervals.length;
    }

    // Error rate
    const errors = session.commands.filter((c) => c.exitCode !== 0).length;
    session.errorRate = session.commands.length > 0 ? errors / session.commands.length : 0;

    this.storage.saveSession(session);
    return session;
  }

  /**
   * Record reality telemetry from production/staging servers.
   */
  recordReality(telemetry: RealityTelemetry): void {
    this.realities.push(telemetry);
    this.storage.saveReality(telemetry);
  }

  /**
   * Get all commands for a scenario.
   */
  getCommandsForScenario(scenarioId: string): CommandTelemetry[] {
    return this.commands.filter((c) => c.scenarioId === scenarioId);
  }

  /**
   * Get session by ID.
   */
  getSession(sessionId: string): SessionTelemetry | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all reality telemetry for a server.
   */
  getRealityForServer(serverId: string): RealityTelemetry[] {
    return this.realities.filter((r) => r.source === "production" && r.serverId === serverId);
  }

  /**
   * Get aggregated stats.
   */
  getStats(): {
    totalSessions: number;
    totalCommands: number;
    solveRate: number;
    avgHintsPerSession: number;
    avgErrorRate: number;
    topFailingCommands: Array<{ cmd: string; count: number }>;
  } {
    const sessions = Array.from(this.sessions.values());
    const solved = sessions.filter((s) => s.solved).length;

    const commandCounts: Record<string, number> = {};
    for (const cmd of this.commands) {
      if (cmd.exitCode !== 0) {
        commandCounts[cmd.cmd] = (commandCounts[cmd.cmd] || 0) + 1;
      }
    }

    const topFailing = Object.entries(commandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ cmd, count }));

    return {
      totalSessions: sessions.length,
      totalCommands: this.commands.length,
      solveRate: sessions.length > 0 ? solved / sessions.length : 0,
      avgHintsPerSession:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.hintsUsed, 0) / sessions.length
          : 0,
      avgErrorRate:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.errorRate, 0) / sessions.length
          : 0,
      topFailingCommands: topFailing,
    };
  }

  /**
   * Export all telemetry for model training.
   */
  exportForTraining(): {
    commands: CommandTelemetry[];
    sessions: SessionTelemetry[];
    realities: RealityTelemetry[];
  } {
    return {
      commands: [...this.commands],
      sessions: Array.from(this.sessions.values()),
      realities: [...this.realities],
    };
  }

  private createSession(
    sessionId: string,
    userId?: string,
    scenarioId?: string
  ): SessionTelemetry {
    const session: SessionTelemetry = {
      sessionId,
      userId,
      scenarioId,
      startedAt: Date.now(),
      commands: [],
      solved: false,
      hintsUsed: 0,
      totalRetries: 0,
      avgCommandInterval: 0,
      serviceStateChanges: {},
      errorRate: 0,
    };

    this.sessions.set(sessionId, session);
    return session;
  }
}

// ─── Storage Interface ───────────────────────────────────────────────────────

export interface TelemetryStorage {
  saveCommand(cmd: CommandTelemetry): void;
  saveSession(session: SessionTelemetry): void;
  saveReality(reality: RealityTelemetry): void;
  loadCommands(scenarioId?: string): CommandTelemetry[];
  loadSessions(): SessionTelemetry[];
  loadRealities(): RealityTelemetry[];
}

export class InMemoryStorage implements TelemetryStorage {
  private commands: CommandTelemetry[] = [];
  private sessions: Map<string, SessionTelemetry> = new Map();
  private realities: RealityTelemetry[] = [];

  saveCommand(cmd: CommandTelemetry): void {
    this.commands.push(cmd);
  }

  saveSession(session: SessionTelemetry): void {
    this.sessions.set(session.sessionId, session);
  }

  saveReality(reality: RealityTelemetry): void {
    this.realities.push(reality);
  }

  loadCommands(scenarioId?: string): CommandTelemetry[] {
    if (scenarioId) {
      return this.commands.filter((c) => c.scenarioId === scenarioId);
    }
    return [...this.commands];
  }

  loadSessions(): SessionTelemetry[] {
    return Array.from(this.sessions.values());
  }

  loadRealities(): RealityTelemetry[] {
    return [...this.realities];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createCommandTelemetry(
  raw: string,
  cmd: string,
  args: string[],
  exitCode: number,
  durationMs: number,
  stdoutLength: number,
  stderrLength: number,
  serviceStates: Record<string, ServiceState>,
  logCount: number,
  newLogs: number,
  sessionId: string,
  scenarioId?: string,
  userId?: string,
  wasHint = false,
  wasRetry = false,
  retryCount = 0,
  timeSinceLastCommand = 0
): CommandTelemetry {
  return {
    id: `${sessionId}-${Date.now()}`,
    timestamp: Date.now(),
    sessionId,
    userId,
    scenarioId,
    raw,
    cmd,
    args,
    exitCode,
    durationMs,
    stdoutLength,
    stderrLength,
    serviceStates,
    logCount,
    newLogs,
    wasHint,
    wasRetry,
    retryCount,
    timeSinceLastCommand,
  };
}
