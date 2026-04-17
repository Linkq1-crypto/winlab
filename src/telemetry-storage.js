// telemetry-storage.js — Browser-compatible telemetry storage (localStorage-based)

const STORAGE_KEY = "winlab_telemetry";
const MAX_COMMANDS = 10000; // Cap to prevent localStorage overflow
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function loadTelemetry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyTelemetry();
    const data = JSON.parse(raw);
    // Migrate old format if needed
    if (!data.version) return migrateV1(data);
    return data;
  } catch {
    return createEmptyTelemetry();
  }
}

export function saveTelemetry(data) {
  try {
    // Trim old data if over limit
    if (data.commands.length > MAX_COMMANDS) {
      data.commands = data.commands.slice(-MAX_COMMANDS);
    }
    // Remove expired sessions
    const cutoff = Date.now() - SESSION_TTL;
    data.sessions = data.sessions.filter((s) => s.startedAt > cutoff);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage full — clear oldest
    if (e.name === "QuotaExceededError") {
      const telemetry = loadTelemetry();
      telemetry.commands = telemetry.commands.slice(-MAX_COMMANDS / 2);
      telemetry.sessions = telemetry.sessions.slice(-50);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetry));
      } catch {}
    }
  }
}

export function clearTelemetry() {
  localStorage.removeItem(STORAGE_KEY);
}

function createEmptyTelemetry() {
  return {
    version: 2,
    createdAt: Date.now(),
    commands: [],
    sessions: [],
    scenarios: {},
  };
}

function migrateV1(oldData) {
  return {
    version: 2,
    createdAt: oldData.createdAt || Date.now(),
    commands: oldData.commands || [],
    sessions: oldData.sessions || [],
    scenarios: oldData.scenarios || {},
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function addCommand(telemetry, cmd) {
  telemetry.commands.push(cmd);
  saveTelemetry(telemetry);
}

export function addSession(telemetry, session) {
  telemetry.sessions.push(session);
  saveTelemetry(telemetry);
}

export function updateSession(telemetry, sessionId, updates) {
  const idx = telemetry.sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx !== -1) {
    telemetry.sessions[idx] = { ...telemetry.sessions[idx], ...updates };
    saveTelemetry(telemetry);
  }
}

export function getStats(telemetry) {
  const totalCommands = telemetry.commands.length;
  const totalSessions = telemetry.sessions.length;
  const solvedSessions = telemetry.sessions.filter((s) => s.solved).length;

  // Command frequency
  const cmdCounts = {};
  for (const cmd of telemetry.commands) {
    cmdCounts[cmd.cmd] = (cmdCounts[cmd.cmd] || 0) + 1;
  }
  const topCommands = Object.entries(cmdCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cmd, count]) => ({ cmd, count }));

  // Error rate
  const errors = telemetry.commands.filter((c) => c.exitCode !== 0).length;
  const errorRate = totalCommands > 0 ? errors / totalCommands : 0;

  // Avg timing per command
  const timedCmds = telemetry.commands.filter((c) => c.durationMs > 0);
  const avgTiming =
    timedCmds.length > 0
      ? timedCmds.reduce((sum, c) => sum + c.durationMs, 0) / timedCmds.length
      : 0;

  // Scenario stats
  const scenarioStats = {};
  for (const session of telemetry.sessions) {
    if (session.scenarioId) {
      if (!scenarioStats[session.scenarioId]) {
        scenarioStats[session.scenarioId] = {
          total: 0,
          solved: 0,
          avgTime: 0,
          avgHints: 0,
        };
      }
      const s = scenarioStats[session.scenarioId];
      s.total++;
      if (session.solved) s.solved++;
      const duration = session.completedAt
        ? session.completedAt - session.startedAt
        : 0;
      s.avgTime = (s.avgTime * (s.total - 1) + duration) / s.total;
      s.avgHints =
        (s.avgHints * (s.total - 1) + (session.hintsUsed || 0)) / s.total;
    }
  }

  return {
    totalCommands,
    totalSessions,
    solvedSessions,
    solveRate: totalSessions > 0 ? solvedSessions / totalSessions : 0,
    errorRate,
    avgTiming,
    topCommands,
    scenarioStats,
  };
}

export function getCommandsForScenario(telemetry, scenarioId) {
  return telemetry.commands.filter((c) => c.scenarioId === scenarioId);
}

export function getSessionsForScenario(telemetry, scenarioId) {
  return telemetry.sessions.filter((s) => s.scenarioId === scenarioId);
}
