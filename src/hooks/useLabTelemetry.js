// useLabTelemetry.js — React hook for telemetry collection in lab simulators

import { useRef, useCallback, useEffect } from "react";
import {
  loadTelemetry,
  addCommand,
  addSession,
  updateSession,
  getStats,
  getCommandsForScenario,
  getSessionsForScenario,
} from "../telemetry-storage";
import { anonymize } from "../anonymizer";

/**
 * Hook that collects telemetry from lab simulators.
 * Returns functions to start/end sessions and record commands.
 */
export function useLabTelemetry(scenarioId, userId, labId) {
  const telemetryRef = useRef(loadTelemetry());
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);
  const lastCmdTimeRef = useRef(null);
  const hintCountRef = useRef(0);
  const retryCountRef = useRef(0);
  const commandsRef = useRef([]);

  // Reload telemetry on mount (in case another tab updated it)
  useEffect(() => {
    telemetryRef.current = loadTelemetry();
  }, []);

  /**
   * Start a new session (when user starts a scenario).
   */
  const startSession = useCallback(() => {
    const sid = `${labId}-${scenarioId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionIdRef.current = sid;
    sessionStartRef.current = Date.now();
    lastCmdTimeRef.current = null;
    hintCountRef.current = 0;
    retryCountRef.current = 0;
    commandsRef.current = [];

    addSession(telemetryRef.current, {
      sessionId: sid,
      userId,
      scenarioId,
      labId,
      startedAt: Date.now(),
      completedAt: null,
      solved: false,
      hintsUsed: 0,
      totalRetries: 0,
      avgCommandInterval: 0,
      serviceStateChanges: {},
      errorRate: 0,
      commands: [],
    });

    return sid;
  }, [labId, scenarioId, userId]);

  /**
   * Record a command execution.
   */
  const recordCommand = useCallback(
    ({
      raw,
      cmd,
      args = [],
      exitCode,
      durationMs,
      stdoutLength = 0,
      stderrLength = 0,
      serviceStates = {},
      logCount = 0,
      newLogs = 0,
      wasRetry = false,
    }) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      const timeSinceLast = lastCmdTimeRef.current
        ? Date.now() - lastCmdTimeRef.current
        : 0;
      lastCmdTimeRef.current = Date.now();

      if (wasRetry) {
        retryCountRef.current++;
      }

      // Anonymize raw command before storage
      const anonymizedRaw = anonymize(raw);

      const cmdTelemetry = {
        id: `${sid}-${commandsRef.current.length}`,
        timestamp: Date.now(),
        sessionId: sid,
        userId,
        scenarioId,
        labId,
        raw: anonymizedRaw,
        cmd,
        args,
        exitCode,
        durationMs,
        stdoutLength,
        stderrLength,
        serviceStates,
        logCount,
        newLogs,
        wasHint: false,
        wasRetry,
        retryCount: retryCountRef.current,
        timeSinceLastCommand: timeSinceLast,
      };

      commandsRef.current.push(cmdTelemetry);
      addCommand(telemetryRef.current, cmdTelemetry);

      // Update session's command list
      updateSession(telemetryRef.current, sid, {
        commands: commandsRef.current.map((c) => c.id),
      });
    },
    [scenarioId, labId, userId]
  );

  /**
   * Record that a hint was used.
   */
  const recordHint = useCallback(() => {
    hintCountRef.current++;
    updateSession(telemetryRef.current, sessionIdRef.current, {
      hintsUsed: hintCountRef.current,
    });
  }, []);

  /**
   * End the session (when scenario is solved or abandoned).
   */
  const endSession = useCallback(
    (solved) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      const completedAt = Date.now();
      const duration = completedAt - sessionStartRef.current;

      // Calculate session stats
      const cmds = commandsRef.current;
      const errors = cmds.filter((c) => c.exitCode !== 0).length;
      const errorRate = cmds.length > 0 ? errors / cmds.length : 0;

      const intervals = cmds
        .slice(1)
        .map((c, i) => c.timestamp - cmds[i].timestamp);
      const avgInterval =
        intervals.length > 0
          ? intervals.reduce((sum, t) => sum + t, 0) / intervals.length
          : 0;

      updateSession(telemetryRef.current, sid, {
        completedAt,
        solved,
        hintsUsed: hintCountRef.current,
        totalRetries: retryCountRef.current,
        avgCommandInterval: avgInterval,
        errorRate,
        duration,
      });

      sessionIdRef.current = null;
    },
    []
  );

  /**
   * Get current session ID.
   */
  const getSessionId = useCallback(() => sessionIdRef.current, []);

  /**
   * Get stats for this scenario.
   */
  const getScenarioStats = useCallback(() => {
    const stats = getStats(telemetryRef.current);
    return {
      ...stats,
      scenarioCommands: getCommandsForScenario(
        telemetryRef.current,
        scenarioId
      ),
      scenarioSessions: getSessionsForScenario(
        telemetryRef.current,
        scenarioId
      ),
    };
  }, [scenarioId]);

  return {
    startSession,
    endSession,
    recordCommand,
    recordHint,
    getSessionId,
    getScenarioStats,
    telemetry: telemetryRef.current,
  };
}
