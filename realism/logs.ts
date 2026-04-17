// realism/logs.ts — Dynamic log generator using corpus

import type { Env, LogEntry, LogLevel } from "./state";
import type { CommandAST } from "./parsers";
import { corpus, interpolate } from "./log-corpus";

/**
 * Emit a log entry based on command execution and environment state.
 */
export function emitLog(
  env: Env,
  source: string,
  level: LogLevel = "info",
  ctx: Record<string, string | number> = {}
): void {
  const group = corpus.find((c) => c.source === source);
  if (!group) {
    // Fallback: simple log
    env.logs.push({
      timestamp: Date.now(),
      source,
      level,
      message: ctx.message || `${source}: action completed`,
    });
    return;
  }

  const pattern = group.patterns[Math.floor(Math.random() * group.patterns.length)];
  const message = interpolate(pattern, ctx);

  env.logs.push({
    timestamp: Date.now(),
    source,
    level,
    message,
  });
}

/**
 * Generate logs based on command execution results.
 */
export function genLogs(ast: CommandAST, env: Env, result: { stdout: string; stderr?: string; code?: number }): void {
  const { cmd, args } = ast;

  // systemctl logs
  if (cmd === "systemctl") {
    const subcmd = args[0];
    const svc = args[1]?.replace(/\.service$/, "");

    if (subcmd === "start" || subcmd === "restart") {
      if (result.code === 0) {
        emitLog(env, "systemd", "info", { svc, message: `Started ${svc}.service.` });
      } else {
        emitLog(env, "systemd", "error", { svc, message: `Failed to start ${svc}.service.` });
      }
    }

    if (subcmd === "stop") {
      emitLog(env, "systemd", "info", { svc, message: `Stopped ${svc}.service.` });
    }

    if (subcmd === "status") {
      const service = env.services[svc];
      if (service?.status === "failed") {
        emitLog(env, "systemd", "error", { svc, message: `Unit ${svc}.service entered failed state.` });
      }
    }
  }

  // Service-specific logs
  if (env.services.httpd?.status === "failed") {
    emitLog(env, "httpd", "error", { port: "80" });
  }

  if (env.services.mysqld?.status === "failed") {
    emitLog(env, "mysql", "error", { db: "proddb", user: "app_user", host: "10.0.1.12" });
  }

  if (env.services.sshd?.status === "running" && Math.random() < 0.1) {
    emitLog(env, "sshd", "warn", { ip: "185.234.12.45", port: "43210", user: "root" });
  }

  // Storage-related logs
  if (env.storage.raid.status === "degraded") {
    emitLog(env, "kernel", "crit", { dev: "sdb1", pct: "0" });
  }

  if (env.storage.raid.status === "rebuilding") {
    emitLog(env, "kernel", "info", { dev: "sdb1", pct: String(env.storage.raid.rebuildProgress) });
  }

  // Network-related logs
  if (env.network.interfaces.eth0?.up === false) {
    emitLog(env, "kernel", "error", { iface: "eth0" });
  }
}

/**
 * Query logs by service and time range.
 */
export function queryLogs(
  env: Env,
  options: {
    source?: string;
    level?: LogLevel;
    since?: number;
    until?: number;
    limit?: number;
  } = {}
): LogEntry[] {
  let filtered = env.logs;

  if (options.source) {
    filtered = filtered.filter((l) => l.source === options.source);
  }

  if (options.level) {
    filtered = filtered.filter((l) => l.level === options.level);
  }

  if (options.since) {
    filtered = filtered.filter((l) => l.timestamp >= options.since!);
  }

  if (options.until) {
    filtered = filtered.filter((l) => l.timestamp <= options.until!);
  }

  if (options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * Format a log entry for display.
 */
export function formatLog(entry: LogEntry): string {
  const date = new Date(entry.timestamp);
  const timestamp = date.toISOString().replace("T", " ").substring(0, 19);
  return `${timestamp} ${entry.source}[${Math.floor(Math.random() * 9000) + 1000}]: ${entry.message}`;
}

/**
 * Clear old logs (simulate log rotation).
 */
export function rotateLogs(env: Env, keepLast = 1000): void {
  if (env.logs.length > keepLast) {
    env.logs = env.logs.slice(-keepLast);
  }
}
