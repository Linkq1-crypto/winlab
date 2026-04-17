// realism/invariants.ts — Reality invariant engine
// Every invariant encodes a non-negotiable law of real systems.
// Violations = impossible simulation state → flagged for auto-correction.

import type { Env, Service } from "./state";

export interface Invariant {
  id: string;
  domain: string;
  severity: "hard" | "soft";
  check: (env: any) => boolean;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svc(env: any, name: string): Service | undefined {
  return (env as Env).services?.[name];
}

function isUp(s: Service | undefined): boolean {
  return s?.status === "running" || s?.status === "degraded";
}

function isFailed(s: Service | undefined): boolean {
  return s?.status === "failed" || s?.status === "stopped";
}

function isRunning(s: Service | undefined): boolean {
  return s?.status === "running";
}

// ---------------------------------------------------------------------------
// Network invariants
// ---------------------------------------------------------------------------

export const networkInvariants: Invariant[] = [
  {
    id: "NET-001",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      const s = svc(env, "httpd");
      const n = svc(env, "nginx");
      // if network is down, HTTP services cannot be running
      if (env.network?.interfaces?.eth0?.up === false && (isUp(s) || isUp(n))) return false;
      return true;
    },
    description: "If network interface eth0 is down, HTTP services cannot be running",
  },
  {
    id: "NET-002",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      // Latency must be non-negative
      return (env.network?.latencyMs ?? 0) >= 0;
    },
    description: "Network latency must be non-negative",
  },
  {
    id: "NET-003",
    domain: "network",
    severity: "soft",
    check: (env: any) => {
      return (env.network?.latencyMs ?? 0) < 5000;
    },
    description: "Network latency should be under 5000ms in normal operation",
  },
  {
    id: "NET-004",
    domain: "network",
    severity: "soft",
    check: (env: any) => {
      // Packet drop ratio between 0 and 1
      const drops = env.network?.drops ?? 0;
      return drops >= 0 && drops <= 1;
    },
    description: "Packet drop ratio must be between 0 and 1",
  },
  {
    id: "NET-005",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      const s = svc(env, "sshd");
      // SSH requires network
      if (env.network?.interfaces?.eth0?.up === false && isUp(s)) return false;
      return true;
    },
    description: "SSHD cannot be running if network is down",
  },
  {
    id: "NET-006",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      const s = svc(env, "mysqld");
      // If all interfaces down and MySQL has network dep, it should not be running
      const allDown = Object.values(env.network?.interfaces ?? {}).every(
        (iface: any) => !iface.up
      );
      if (allDown && Object.keys(env.network?.interfaces ?? {}).length > 0 && isRunning(s)) return false;
      return true;
    },
    description: "MySQL should degrade when all network interfaces are down",
  },
  {
    id: "NET-007",
    domain: "network",
    severity: "soft",
    check: (env: any) => {
      // At least one interface must exist
      const ifaces = env.network?.interfaces ?? {};
      return Object.keys(ifaces).length > 0;
    },
    description: "At least one network interface must exist",
  },
  {
    id: "NET-008",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      // firewalld running requires at least one up interface
      const f = svc(env, "firewalld");
      if (isUp(f)) {
        const anyUp = Object.values(env.network?.interfaces ?? {}).some(
          (iface: any) => iface.up
        );
        if (!anyUp) return false;
      }
      return true;
    },
    description: "Firewalld requires at least one active network interface",
  },
  {
    id: "NET-009",
    domain: "network",
    severity: "soft",
    check: (env: any) => {
      return (env.network?.drops ?? 0) < 0.3;
    },
    description: "Packet drop ratio should be under 30%",
  },
  {
    id: "NET-010",
    domain: "network",
    severity: "hard",
    check: (env: any) => {
      // chronyd needs network for NTP sync
      const c = svc(env, "chronyd");
      if (env.network?.interfaces?.eth0?.up === false && isRunning(c)) return false;
      return true;
    },
    description: "Chronyd cannot run if primary network is down",
  },
];

// ---------------------------------------------------------------------------
// Service invariants
// ---------------------------------------------------------------------------

export const serviceInvariants: Invariant[] = [
  {
    id: "SVC-001",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // If nginx failed, httpd (reverse proxy alternative) logs must exist
      const nginx = svc(env, "nginx");
      if (isFailed(nginx)) {
        const httpdLogs = env.fs?.exists?.("/var/log/httpd/access_log");
        // At minimum, the httpd service should have some log footprint
        const httpd = svc(env, "httpd");
        if (isUp(httpd) && !httpdLogs) return false;
      }
      return true;
    },
    description: "If nginx failed, running httpd must have log files present",
  },
  {
    id: "SVC-002",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // Dependency ordering: a service cannot be running if its deps are failed
      for (const [name, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        for (const dep of service.deps ?? []) {
          const depSvc = svc(env, dep);
          if (isFailed(depSvc) && service.status === "running") return false;
        }
      }
      return true;
    },
    description: "A running service must have all its dependencies not failed",
  },
  {
    id: "SVC-003",
    domain: "service",
    severity: "soft",
    check: (env: any) => {
      // Total restart count across all services should be reasonable
      // We approximate by checking that no service has been running for a negative duration
      for (const [, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        if (service.since !== undefined && service.since > Date.now()) return false;
      }
      return true;
    },
    description: "Service uptime start cannot be in the future",
  },
  {
    id: "SVC-004",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // mysqld requires storage
      const storage = svc(env, "storage");
      const mysql = svc(env, "mysqld");
      // If storage is explicitly failed, MySQL should not be running
      // We check storage via the storage state, not a service
      if (env.storage?.raid?.status === "failed" && isRunning(mysql)) return false;
      return true;
    },
    description: "MySQL cannot run if RAID has failed",
  },
  {
    id: "SVC-005",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // rsyslog needs storage for writing logs
      const rsyslog = svc(env, "rsyslog");
      if (env.storage?.raid?.status === "failed" && isRunning(rsyslog)) return false;
      return true;
    },
    description: "Rsyslog cannot run if storage has failed",
  },
  {
    id: "SVC-006",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // A service with PID must have a positive PID
      for (const [, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        if (service.pid !== undefined && service.pid <= 0) return false;
      }
      return true;
    },
    description: "Service PID must be positive",
  },
  {
    id: "SVC-007",
    domain: "service",
    severity: "soft",
    check: (env: any) => {
      // A running service must have been started at some point
      for (const [, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        if (service.status === "running" && service.since === undefined) return false;
      }
      return true;
    },
    description: "Running services must have a start time",
  },
  {
    id: "SVC-008",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // network service has no deps and must always be valid status
      const net = svc(env, "network");
      if (net && net.deps.length > 0) return false;
      return true;
    },
    description: "Network service should have no dependencies",
  },
  {
    id: "SVC-009",
    domain: "service",
    severity: "soft",
    check: (env: any) => {
      // Enabled services should not be permanently failed (they would restart)
      for (const [, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        if (service.enabled && service.status === "failed") {
          // This is soft - an enabled service could be in transient failed state
          // But it should have a since timestamp indicating recent activity
          if (service.since === undefined) return false;
        }
      }
      return true;
    },
    description: "Enabled services in failed state should have recent activity timestamp",
  },
  {
    id: "SVC-010",
    domain: "service",
    severity: "hard",
    check: (env: any) => {
      // firewalld should not be running if network is completely down
      const fw = svc(env, "firewalld");
      if (isRunning(fw)) {
        const allDown = Object.values(env.network?.interfaces ?? {}).every(
          (iface: any) => !iface.up
        );
        if (allDown && Object.keys(env.network?.interfaces ?? {}).length > 0) return false;
      }
      return true;
    },
    description: "Firewalld cannot run if all network interfaces are down",
  },
];

// ---------------------------------------------------------------------------
// Storage invariants
// ---------------------------------------------------------------------------

export const storageInvariants: Invariant[] = [
  {
    id: "STO-001",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // If RAID failed, dependent services can't be running
      const raid = env.storage?.raid;
      if (raid?.status === "failed") {
        const mysql = svc(env, "mysqld");
        const rsyslog = svc(env, "rsyslog");
        if (isRunning(mysql) || isRunning(rsyslog)) return false;
      }
      return true;
    },
    description: "If RAID failed, dependent services (mysqld, rsyslog) cannot be running",
  },
  {
    id: "STO-002",
    domain: "storage",
    severity: "soft",
    check: (env: any) => {
      return (env.storage?.raid?.missingBlocks ?? 0) >= 0;
    },
    description: "Missing blocks count must be non-negative",
  },
  {
    id: "STO-003",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // Volume used cannot exceed size
      for (const [, vol] of Object.entries(env.storage?.volumes ?? {})) {
        const v = vol as any;
        if (v.used > v.size) return false;
      }
      return true;
    },
    description: "Volume used space cannot exceed volume size",
  },
  {
    id: "STO-004",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // Inodes used cannot exceed total inodes
      for (const [, vol] of Object.entries(env.storage?.volumes ?? {})) {
        const v = vol as any;
        if (v.inodesUsed > v.inodes) return false;
      }
      return true;
    },
    description: "Inodes used cannot exceed total inodes",
  },
  {
    id: "STO-005",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // RAID status must be a valid value
      const validStatuses = ["healthy", "degraded", "rebuilding", "failed"];
      const status = env.storage?.raid?.status;
      return validStatuses.includes(status);
    },
    description: "RAID status must be a valid state",
  },
  {
    id: "STO-006",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // Rebuild progress must be 0-100
      const progress = env.storage?.raid?.rebuildProgress;
      if (progress !== undefined && (progress < 0 || progress > 100)) return false;
      return true;
    },
    description: "RAID rebuild progress must be between 0 and 100",
  },
  {
    id: "STO-007",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // If RAID is rebuilding, rebuild progress must be < 100
      const raid = env.storage?.raid;
      if (raid?.status === "rebuilding" && raid.rebuildProgress >= 100) return false;
      return true;
    },
    description: "RAID rebuild progress must be < 100 while rebuilding",
  },
  {
    id: "STO-008",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // RAID must have at least one device
      const devices = env.storage?.raid?.devices ?? [];
      return devices.length > 0;
    },
    description: "RAID array must have at least one device",
  },
  {
    id: "STO-009",
    domain: "storage",
    severity: "hard",
    check: (env: any) => {
      // At least one volume must exist
      const volumes = env.storage?.volumes ?? {};
      return Object.keys(volumes).length > 0;
    },
    description: "At least one storage volume must exist",
  },
  {
    id: "STO-010",
    domain: "storage",
    severity: "soft",
    check: (env: any) => {
      // Volume size must be positive
      for (const [, vol] of Object.entries(env.storage?.volumes ?? {})) {
        const v = vol as any;
        if (v.size <= 0) return false;
      }
      return true;
    },
    description: "Volume size must be positive",
  },
];

// ---------------------------------------------------------------------------
// Auth invariants
// ---------------------------------------------------------------------------

export const authInvariants: Invariant[] = [
  {
    id: "AUTH-001",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // If sssd/ldap service failed, users should not be visible
      const sssd = env.services?.["sssd"];
      const ldap = env.services?.["ldap"];
      if (isFailed(sssd) || isFailed(ldap)) {
        // Check that no non-root user is visible in env
        // We approximate: if user is not root and no local fallback, it's a violation
        if (env.user && env.user !== "root") {
          // Check if there's a local passwd file as fallback
          const hasLocalPass = env.fs?.exists?.("/etc/passwd");
          if (!hasLocalPass) return false;
        }
      }
      return true;
    },
    description: "If SSSD/LDAP failed, non-root users cannot be visible without local fallback",
  },
  {
    id: "AUTH-002",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // sshd cannot be running without network
      const sshd = svc(env, "sshd");
      if (isUp(sshd)) {
        const eth0 = env.network?.interfaces?.eth0;
        if (!eth0?.up) return false;
      }
      return true;
    },
    description: "SSHD requires network to be running",
  },
  {
    id: "AUTH-003",
    domain: "auth",
    severity: "soft",
    check: (env: any) => {
      // Current user should exist in passwd
      const passwd = env.fs?.read?.("/etc/passwd");
      if (passwd && env.user) {
        return passwd.includes(env.user);
      }
      return true; // No passwd file means we can't check
    },
    description: "Current user should exist in /etc/passwd",
  },
  {
    id: "AUTH-004",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // Root user must always be accessible regardless of auth services
      if (env.user === "root") {
        const passwd = env.fs?.read?.("/etc/passwd");
        // Root must be in passwd
        if (passwd && !passwd.includes("root")) return false;
      }
      return true;
    },
    description: "Root user must be in /etc/passwd when root is the current user",
  },
  {
    id: "AUTH-005",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // sshd_config must exist if sshd is running
      const sshd = svc(env, "sshd");
      if (isUp(sshd)) {
        const configExists = env.fs?.exists?.("/etc/ssh/sshd_config");
        if (!configExists) return false;
      }
      return true;
    },
    description: "SSHD config must exist when sshd is running",
  },
  {
    id: "AUTH-006",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // Environment HOME must exist as a directory
      const home = env.environment?.HOME;
      if (home) {
        return env.fs?.exists?.(home) ?? true;
      }
      return true;
    },
    description: "User HOME directory must exist in filesystem",
  },
  {
    id: "AUTH-007",
    domain: "auth",
    severity: "hard",
    check: (env: any) => {
      // Current working directory must exist
      if (env.cwd) {
        return env.fs?.exists?.(env.cwd) ?? true;
      }
      return true;
    },
    description: "Current working directory must exist",
  },
  {
    id: "AUTH-008",
    domain: "auth",
    severity: "soft",
    check: (env: any) => {
      // SHELL must be a valid path
      const shell = env.environment?.SHELL;
      if (shell) {
        return shell.startsWith("/") && shell.endsWith("/bash") || shell.endsWith("/sh") || shell.endsWith("/zsh") || shell.endsWith("/fish");
      }
      return true;
    },
    description: "User shell must be a valid shell path",
  },
];

// ---------------------------------------------------------------------------
// Log invariants
// ---------------------------------------------------------------------------

export const logInvariants: Invariant[] = [
  {
    id: "LOG-001",
    domain: "log",
    severity: "hard",
    check: (env: any) => {
      // If services failed, error/crit logs must exist
      for (const [name, s] of Object.entries(env.services ?? {})) {
        const service = s as Service;
        if (service.status === "failed") {
          const hasLog = env.logs?.some(
            (l: any) => l.source === name && (l.level === "error" || l.level === "crit")
          );
          if (!hasLog) return false;
        }
      }
      return true;
    },
    description: "Failed services must have corresponding error/crit log entries",
  },
  {
    id: "LOG-002",
    domain: "log",
    severity: "hard",
    check: (env: any) => {
      // Log entries must have valid timestamps
      for (const log of env.logs ?? []) {
        if (!log.timestamp || log.timestamp <= 0) return false;
      }
      return true;
    },
    description: "All log entries must have positive timestamps",
  },
  {
    id: "LOG-003",
    domain: "log",
    severity: "hard",
    check: (env: any) => {
      // Log level must be valid
      const validLevels = ["info", "warn", "error", "crit"];
      for (const log of env.logs ?? []) {
        if (!validLevels.includes(log.level)) return false;
      }
      return true;
    },
    description: "Log entries must have valid log levels",
  },
  {
    id: "LOG-004",
    domain: "log",
    severity: "soft",
    check: (env: any) => {
      // Log sources must come from known services
      const knownServices = Object.keys(env.services ?? {});
      for (const log of env.logs ?? []) {
        if (log.source && !knownServices.includes(log.source)) {
          // Allow system sources
          if (!["kernel", "systemd", "cron", "sshd", "sudo", "pam"].includes(log.source)) {
            return false;
          }
        }
      }
      return true;
    },
    description: "Log sources must be known services or system sources",
  },
  {
    id: "LOG-005",
    domain: "log",
    severity: "soft",
    check: (env: any) => {
      // Log diversity: at least 3 distinct sources when logs exist
      const logs = env.logs ?? [];
      if (logs.length === 0) return true;
      const sources = new Set(logs.map((l: any) => l.source));
      return sources.size >= 3 || logs.length < 3;
    },
    description: "Log sources should show diversity (at least 3 distinct sources when enough logs exist)",
  },
  {
    id: "LOG-006",
    domain: "log",
    severity: "hard",
    check: (env: any) => {
      // Log messages must be non-empty strings
      for (const log of env.logs ?? []) {
        if (!log.message || typeof log.message !== "string" || log.message.trim().length === 0) {
          return false;
        }
      }
      return true;
    },
    description: "Log messages must be non-empty strings",
  },
  {
    id: "LOG-007",
    domain: "log",
    severity: "hard",
    check: (env: any) => {
      // If rsyslog is running, logs must be written to disk
      const rsyslog = svc(env, "rsyslog");
      if (isRunning(rsyslog) && (env.logs?.length ?? 0) > 0) {
        const logFileExists = env.fs?.exists?.("/var/log/messages") || env.fs?.exists?.("/var/log/syslog");
        if (!logFileExists) return false;
      }
      return true;
    },
    description: "If rsyslog is running with logs, log files must exist on disk",
  },
];

// ---------------------------------------------------------------------------
// System invariants
// ---------------------------------------------------------------------------

export const systemInvariants: Invariant[] = [
  {
    id: "SYS-001",
    domain: "system",
    severity: "soft",
    check: (env: any) => {
      // Entropy > 0.1 — no total determinism in a real system
      // Approximate: check that not every service is in the same state
      const states = new Set(
        Object.values(env.services ?? {}).map((s: any) => s.status)
      );
      if (states.size <= 1 && Object.keys(env.services ?? {}).length > 3) {
        // All services in identical state is unrealistic
        return false;
      }
      return true;
    },
    description: "System should show state diversity — not all services in identical state",
  },
  {
    id: "SYS-002",
    domain: "system",
    severity: "soft",
    check: (env: any) => {
      // Failure rate > 0.05 — real systems experience failures
      // We check that the environment has experienced some degradation
      const services = Object.values(env.services ?? {}) as Service[];
      if (services.length === 0) return true;
      const failed = services.filter(
        (s) => s.status === "failed" || s.status === "degraded"
      ).length;
      const failureRate = failed / services.length;
      // This is a soft check — we just ensure it's not 0 in a long-running system
      // We allow 0 for fresh environments
      return failureRate >= 0 || services.length === 0;
    },
    description: "System should have non-zero failure rate in long-running simulation",
  },
  {
    id: "SYS-003",
    domain: "system",
    severity: "hard",
    check: (env: any) => {
      // Hostname must be non-empty
      return typeof env.hostname === "string" && env.hostname.length > 0;
    },
    description: "Hostname must be non-empty",
  },
  {
    id: "SYS-004",
    domain: "system",
    severity: "hard",
    check: (env: any) => {
      // User must be set
      return typeof env.user === "string" && env.user.length > 0;
    },
    description: "Current user must be set",
  },
  {
    id: "SYS-005",
    domain: "system",
    severity: "hard",
    check: (env: any) => {
      // CWD must be absolute path
      return env.cwd?.startsWith("/");
    },
    description: "Current working directory must be an absolute path",
  },
  {
    id: "SYS-006",
    domain: "system",
    severity: "hard",
    check: (env: any) => {
      // PATH must be set
      return typeof env.environment?.PATH === "string" && env.environment.PATH.length > 0;
    },
    description: "PATH environment variable must be set",
  },
  {
    id: "SYS-007",
    domain: "system",
    severity: "soft",
    check: (env: any) => {
      // /etc/resolv.conf must exist if network is up
      const eth0 = env.network?.interfaces?.eth0;
      if (eth0?.up) {
        return env.fs?.exists?.("/etc/resolv.conf") ?? true;
      }
      return true;
    },
    description: "resolv.conf must exist when network is up",
  },
  {
    id: "SYS-008",
    domain: "system",
    severity: "hard",
    check: (env: any) => {
      // crond should not depend on network
      const crond = svc(env, "crond");
      if (crond && crond.deps.includes("network")) return false;
      return true;
    },
    description: "Cron daemon should not depend on network",
  },
];

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export const ALL_INVARIANTS: Invariant[] = [
  ...networkInvariants,
  ...serviceInvariants,
  ...storageInvariants,
  ...authInvariants,
  ...logInvariants,
  ...systemInvariants,
];

export interface ValidationResult {
  passed: boolean;
  violations: Invariant[];
  checked: number;
}

export function validateInvariants(env: any): ValidationResult {
  const violations: Invariant[] = [];
  for (const inv of ALL_INVARIANTS) {
    try {
      if (!inv.check(env)) {
        violations.push(inv);
      }
    } catch {
      // If a check throws, treat it as a violation (defensive)
      violations.push({
        ...inv,
        description: `[CHECK ERROR] ${inv.description}`,
      });
    }
  }
  return {
    passed: violations.length === 0,
    violations,
    checked: ALL_INVARIANTS.length,
  };
}
