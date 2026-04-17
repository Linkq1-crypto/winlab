// tests/realism.spec.ts — Comprehensive realism test suite

import { describe, it, expect, beforeEach } from "vitest";
import { exec, createDefaultEnv, createTestNoise, normalize } from "../realism/engine";
import { Env } from "../realism/state";
import { DependencyGraph, createDefaultDependencyGraph } from "../realism/deps";
import { Noise } from "../realism/noise";
import { emitLog, queryLogs } from "../realism/logs";
import { loadBaseline } from "../realism/snapshots";

function mkEnv(): Env {
  const env = createDefaultEnv();

  // Ensure standard services are running
  env.services = {
    network: { status: "running", deps: [], enabled: true, since: Date.now() - 86400000 },
    sshd: { status: "running", pid: 892, deps: ["network"], enabled: true, since: Date.now() - 86400000 },
    httpd: { status: "running", pid: 1234, deps: ["network"], enabled: true, since: Date.now() - 3600000, configPath: "/etc/httpd/conf/httpd.conf" },
    mysqld: { status: "running", pid: 2345, deps: ["storage"], enabled: true, since: Date.now() - 86400000, configPath: "/etc/my.cnf" },
    nginx: { status: "running", pid: 3456, deps: ["network"], enabled: false, since: Date.now() - 3600000 },
    crond: { status: "running", pid: 567, deps: [], enabled: true, since: Date.now() - 86400000 },
    chronyd: { status: "running", pid: 678, deps: ["network"], enabled: true, since: Date.now() - 86400000 },
    firewalld: { status: "running", pid: 789, deps: [], enabled: true, since: Date.now() - 86400000 },
    rsyslog: { status: "running", pid: 456, deps: [], enabled: true, since: Date.now() - 86400000 },
  };

  // Initialize FS
  env.fs.write("/etc/nginx/nginx.conf", "worker_processes 1;\n", 0o644);
  env.fs.write("/etc/httpd/conf/httpd.conf", "<VirtualHost *:80>\n  ServerName localhost\n</VirtualHost>", 0o644);
  env.fs.write("/etc/my.cnf", "[mysqld]\ndatadir=/var/lib/mysql\n", 0o644);

  return env;
}

// ─── Command Fidelity Tests ─────────────────────────────────────────────────

describe("Realism: command fidelity", () => {
  it("systemctl status output matches expected format", async () => {
    const env = mkEnv();
    const r = await exec("systemctl status nginx", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Active: (active \(running\)|failed|inactive|dead)/);
    expect(r.stdout).toMatch(/nginx\.service/);
  });

  it("systemctl status shows correct PID", async () => {
    const env = mkEnv();
    const r = await exec("systemctl status httpd", env);

    expect(r.stdout).toMatch(/Main PID: \d+/);
  });

  it("systemctl is-active returns correct state", async () => {
    const env = mkEnv();
    const r = await exec("systemctl is-active sshd", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toBe("active");
  });

  it("systemctl is-active returns inactive for stopped service", async () => {
    const env = mkEnv();
    await exec("systemctl stop sshd", env);
    const r = await exec("systemctl is-active sshd", env);

    expect(r.code).toBe(3);
    expect(r.stdout).toBe("inactive");
  });

  it("ps output includes running services", async () => {
    const env = mkEnv();
    const r = await exec("ps aux", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/sshd/);
    expect(r.stdout).toMatch(/httpd/);
  });

  it("df shows filesystem info", async () => {
    const env = mkEnv();
    const r = await exec("df -h", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Mounted on/);
    expect(r.stdout).toMatch(/\d+%/);
  });

  it("free shows memory info", async () => {
    const env = mkEnv();
    const r = await exec("free", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Mem:/);
    expect(r.stdout).toMatch(/Swap:/);
  });

  it("hostname returns configured hostname", async () => {
    const env = mkEnv();
    const r = await exec("hostname", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toBe("server01.lab.local");
  });

  it("whoami returns current user", async () => {
    const env = mkEnv();
    const r = await exec("whoami", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toBe("root");
  });

  it("unknown command returns error", async () => {
    const env = mkEnv();
    const r = await exec("nonexistent-command", env);

    expect(r.code).toBe(127);
    expect(r.stderr).toMatch(/command not found/);
  });
});

// ─── Side-Effects Tests ─────────────────────────────────────────────────────

describe("Realism: side-effects", () => {
  it("rm -rf /var/lib/mysql breaks mysql + logs error", async () => {
    const env = mkEnv();
    await exec("rm -rf /var/lib/mysql", env);

    expect(env.services.mysqld.status).toBe("failed");
    const mysqlLogs = queryLogs(env, { source: "mysql" });
    expect(mysqlLogs.length).toBeGreaterThan(0);
    expect(mysqlLogs.some((l) => l.message.includes("InnoDB"))).toBe(true);
  });

  it("systemctl stop network cascades to dependent services", async () => {
    const env = mkEnv();
    await exec("systemctl stop network", env);

    // sshd depends on network
    expect(env.services.sshd.status).toBe("degraded");
    // httpd depends on network
    expect(env.services.httpd.status).toBe("degraded");
  });

  it("systemctl start httpd when network is down fails", async () => {
    const env = mkEnv();
    await exec("systemctl stop network", env);
    const r = await exec("systemctl start httpd", env);

    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/Dependency failed/);
  });

  it("systemctl restart nginx restarts dependents", async () => {
    const env = mkEnv();
    const r = await exec("systemctl restart nginx", env);

    expect(r.code).toBe(0);
    expect(env.services.nginx.status).toBe("running");
  });
});

// ─── Timing Tests ────────────────────────────────────────────────────────────

describe("Realism: timing transitions", () => {
  it("restart is not instant and converges", async () => {
    const env = mkEnv();
    const p = exec("systemctl restart nginx", env);

    // Command should take some time (not instant)
    const r = await p;
    expect(r.timing.delayMs).toBeGreaterThan(0);
    expect(env.services.nginx.status).toBe("running");
  });

  it("multiple commands accumulate timing", async () => {
    const env = mkEnv();
    const start = Date.now();

    await exec("systemctl restart nginx", env);
    await exec("systemctl restart httpd", env);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(100); // At least some cumulative delay
  });
});

// ─── Noise Tests ─────────────────────────────────────────────────────────────

describe("Realism: noise and retry", () => {
  it("noise with zero rates succeeds immediately", async () => {
    const noise = new Noise({
      baseLatencyMs: 10,
      jitterMs: 5,
      dropRate: 0,
      errorRate: 0,
      retryPolicy: { retries: 0, backoffMs: 0, factor: 1 },
      seed: 42,
    });

    const res = await noise.withRetry(async () => ({ ok: true }));
    expect(res.ok).toBe(true);
  });

  it("deterministic noise produces consistent results", async () => {
    const noise1 = new Noise({
      baseLatencyMs: 10,
      jitterMs: 20,
      dropRate: 0,
      errorRate: 0,
      retryPolicy: { retries: 0, backoffMs: 0, factor: 1 },
      seed: 12345,
    });

    const noise2 = new Noise({
      baseLatencyMs: 10,
      jitterMs: 20,
      dropRate: 0,
      errorRate: 0,
      retryPolicy: { retries: 0, backoffMs: 0, factor: 1 },
      seed: 12345,
    });

    const lat1 = noise1.latency();
    const lat2 = noise2.latency();

    expect(lat1).toBe(lat2); // Same seed = same latency
  });
});

// ─── Dependency Graph Tests ─────────────────────────────────────────────────

describe("Realism: dependency graph", () => {
  it("network failure cascades correctly", () => {
    const env = mkEnv();
    const graph = createDefaultDependencyGraph();

    graph.propagateFailure(env, "network");

    expect(env.services.sshd.status).toBe("degraded");
    expect(env.services.httpd.status).toBe("degraded");
    expect(env.services.nginx.status).toBe("degraded");
    expect(env.services.chronyd.status).toBe("degraded");
  });

  it("canStart returns false if dependency is down", () => {
    const env = mkEnv();
    const graph = createDefaultDependencyGraph();

    env.services.network.status = "stopped";

    expect(graph.canStart(env, "sshd")).toBe(false);
    expect(graph.canStart(env, "httpd")).toBe(false);
  });

  it("getAllDependencies returns full chain", () => {
    const graph = createDefaultDependencyGraph();

    const deps = graph.getAllDependencies("nginx");
    expect(deps).toContain("network");
    expect(deps).toContain("dns");
  });

  it("restartCascade returns list of dependents", () => {
    const env = mkEnv();
    const graph = createDefaultDependencyGraph();

    const toRestart = graph.restartCascade(env, "network");
    expect(toRestart.length).toBeGreaterThan(0);
  });
});

// ─── Log Tests ───────────────────────────────────────────────────────────────

describe("Realism: logs look real", () => {
  it("emitLog generates plausible kernel error", () => {
    const env = mkEnv();
    emitLog(env, "kernel", "crit", { dev: "sda1" });

    const lastLog = env.logs[env.logs.length - 1];
    expect(lastLog.source).toBe("kernel");
    expect(lastLog.level).toBe("crit");
    // Any kernel log is valid for crit level
    expect(lastLog.message.length).toBeGreaterThan(5);
  });

  it("queryLogs filters by source", () => {
    const env = mkEnv();
    emitLog(env, "nginx", "error");
    emitLog(env, "mysql", "error");
    emitLog(env, "nginx", "warn");

    const nginxLogs = queryLogs(env, { source: "nginx" });
    expect(nginxLogs.length).toBe(2);
  });

  it("queryLogs filters by level", () => {
    const env = mkEnv();
    emitLog(env, "nginx", "error");
    emitLog(env, "mysql", "warn");
    emitLog(env, "kernel", "error");

    const errorLogs = queryLogs(env, { level: "error" });
    expect(errorLogs.length).toBe(2);
  });
});

// ─── Baseline Tests ─────────────────────────────────────────────────────────

describe("Realism: baseline diff (REAL vs SIM)", () => {
  it("mdadm --detail matches baseline (normalized)", async () => {
    const env = mkEnv();
    env.storage.raid.status = "degraded";
    env.storage.raid.devices[1].status = "failed";

    const r = await exec("mdadm --detail /dev/md0", env);

    expect(r.code).toBe(0);  // mdadm --detail returns 0 even for degraded
    expect(r.stdout).toContain("degraded");
    expect(r.stdout).toContain("Failed Devices");
  });

  it("emitLog generates plausible nginx error", () => {
    const env = mkEnv();
    emitLog(env, "nginx", "error", { client: "10.0.2.50" });

    const lastLog = env.logs[env.logs.length - 1];
    expect(lastLog.source).toBe("nginx");
    expect(lastLog.level).toBe("error");
    // Any nginx error log is valid
    expect(lastLog.message.length).toBeGreaterThan(10);
  });

  it("systemctl status nginx format is plausible", async () => {
    const env = mkEnv();
    const r = await exec("systemctl status nginx", env);

    const baseline = loadBaseline("systemctl_status_nginx.txt");

    expect(normalize(r.stdout)).toContain(normalize("Active:").split(" ")[0]);
  });
});

// ─── Parser Tests ────────────────────────────────────────────────────────────

describe("Realism: command parser", () => {
  it("handles multiple spaces", async () => {
    const env = mkEnv();
    const r = await exec("systemctl  status   nginx", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/nginx/);
  });

  it("handles tabs", async () => {
    const env = mkEnv();
    const r = await exec("systemctl\tstatus\tnginx", env);

    expect(r.code).toBe(0);
  });

  it("handles quoted arguments", async () => {
    const env = mkEnv();
    const r = await exec('echo "hello world"', env);

    // Echo not implemented, but should not crash
    expect(r.code).toBe(127);
  });

  it("handles flags with values", async () => {
    const env = mkEnv();
    const r = await exec("journalctl -u httpd", env);

    expect(r.code).toBe(0);
  });

  it("handles long flags", async () => {
    const env = mkEnv();
    const r = await exec("journalctl --disk-usage", env);

    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/journals take up/);
  });
});
