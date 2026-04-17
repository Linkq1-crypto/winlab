// realism/effects.ts — Command effects and state mutations

import type { CommandAST } from "./parsers";
import type { Env, ServiceState, FileEntry } from "./state";
import { createDefaultDependencyGraph } from "./deps";

export interface ExecutionResult {
  stdout: string;
  stderr?: string;
  code: number;
}

const depGraph = createDefaultDependencyGraph();

/**
 * Apply command effects to the environment.
 */
export async function applyEffects(ast: CommandAST, env: Env): Promise<ExecutionResult> {
  const { cmd, args, flags } = ast;

  // Route to appropriate handler
  switch (cmd) {
    case "systemctl":
      return handleSystemctl(ast, env);
    case "journalctl":
      return handleJournalctl(ast, env);
    case "ps":
    case "top":
      return handleProcess(ast, env);
    case "df":
      return handleDisk(ast, env);
    case "free":
      return handleMemory(ast, env);
    case "ip":
      return handleNetwork(ast, env);
    case "ss":
    case "netstat":
      return handleSockets(ast, env);
    case "ping":
      return handlePing(ast, env);
    case "cat":
      return handleCat(ast, env);
    case "ls":
      return handleLs(ast, env);
    case "cd":
      return handleCd(ast, env);
    case "pwd":
      return handlePwd(ast, env);
    case "hostname":
      return handleHostname(ast, env);
    case "whoami":
      return handleWhoami(ast, env);
    case "uname":
      return handleUname(ast, env);
    case "date":
      return handleDate(ast, env);
    case "uptime":
      return handleUptime(ast, env);
    case "mdadm":
      return handleMdadm(ast, env);
    case "service":
      return handleService(ast, env);
    case "kill":
    case "killall":
      return handleKill(ast, env);
    case "chmod":
      return handleChmod(ast, env);
    case "chown":
      return handleChown(ast, env);
    case "touch":
      return handleTouch(ast, env);
    case "rm":
      return handleRm(ast, env);
    case "mkdir":
      return handleMkdir(ast, env);
    case "find":
      return handleFind(ast, env);
    case "mount":
      return handleMount(ast, env);
    case "umount":
      return handleUmount(ast, env);
    case "curl":
      return handleCurl(ast, env);
    case "wget":
      return handleWget(ast, env);
    case "systemd-analyze":
      return handleSystemdAnalyze(ast, env);
    case "clear":
      return { stdout: "__CLEAR__", code: 0 };
    case "":
      return { stdout: "", code: 0 };
    default:
      return {
        stdout: "",
        stderr: `-bash: ${cmd}: command not found`,
        code: 127,
      };
  }
}

// ─── systemctl ───────────────────────────────────────────────────────────────

function handleSystemctl(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const subcmd = args[0];
  const unit = args[1];
  const svc = unit?.replace(/\.service$/, "");

  if (!subcmd) {
    return { stdout: "", stderr: "Missing operation", code: 1 };
  }

  if (subcmd === "status") {
    if (!svc) {
      return { stdout: "", stderr: "Failed to get properties: No unit specified", code: 1 };
    }

    const service = env.services[svc];
    if (!service) {
      return {
        stdout: "",
        stderr: `Unit ${unit || svc} could not be found.`,
        code: 4,
      };
    }

    const isActive = service.status === "running";
    const loadState = service.status !== "failed" ? "loaded" : "not-found";
    const activeState = mapStatus(service.status);

    return {
      stdout: `● ${svc}.service
   Loaded: ${loadState} (/usr/lib/systemd/system/${svc}.service; ${service.enabled ? "enabled" : "disabled"})
   Active: ${activeState} since ${new Date(service.since || Date.now()).toLocaleString("en-US")}
${isActive ? `   Main PID: ${service.pid || Math.floor(Math.random() * 9000) + 1000} (${svc})` : "     Process: N/A"}`,
      code: isActive ? 0 : 3,
    };
  }

  if (subcmd === "start") {
    if (!svc) {
      return { stdout: "", stderr: "Failed to start: No unit specified", code: 1 };
    }

    // Check dependencies
    if (!depGraph.canStart(env, svc)) {
      const deps = env.services[svc]?.deps || [];
      const failedDeps = deps.filter((d) => env.services[d]?.status !== "running");
      return {
        stdout: "",
        stderr: `Failed to start ${svc}.service: Dependency failed (${failedDeps.join(", ")})`,
        code: 1,
      };
    }

    if (env.services[svc]) {
      env.services[svc].status = "running";
      env.services[svc].since = Date.now();
      env.services[svc].pid = Math.floor(Math.random() * 9000) + 1000;
      return { stdout: "", code: 0 };
    }

    return { stdout: "", stderr: `Failed to start ${svc}.service: Unit not found`, code: 5 };
  }

  if (subcmd === "stop") {
    if (!svc) {
      return { stdout: "", stderr: "Failed to stop: No unit specified", code: 1 };
    }

    if (env.services[svc]) {
      env.services[svc].status = "stopped";
      env.services[svc].pid = undefined;

      // Propagate failure to dependents
      depGraph.propagateFailure(env, svc);

      return { stdout: "", code: 0 };
    }

    return { stdout: "", stderr: `Failed to stop ${svc}.service: Unit not found`, code: 5 };
  }

  if (subcmd === "restart" || subcmd === "reload") {
    if (!svc) {
      return { stdout: "", stderr: "Failed to restart: No unit specified", code: 1 };
    }

    if (env.services[svc]) {
      env.services[svc].status = "restarting";
      env.services[svc].since = Date.now();
      env.services[svc].pid = Math.floor(Math.random() * 9000) + 1000;

      // Check if config is valid (simulate)
      const configPath = env.services[svc].configPath;
      if (configPath) {
        const config = env.fs.read(configPath);
        if (config && config.includes("INVALID")) {
          env.services[svc].status = "failed";
          return {
            stdout: "",
            stderr: `Job for ${svc}.service failed. See 'journalctl -xe' for details.`,
            code: 1,
          };
        }
      }

      env.services[svc].status = "running";

      // Restart cascade
      const toRestart = depGraph.restartCascade(env, svc);
      for (const s of toRestart) {
        if (env.services[s]) {
          env.services[s].status = "restarting";
          setTimeout(() => {
            if (env.services[s]) {
              env.services[s].status = "running";
            }
          }, 500);
        }
      }

      return { stdout: "", code: 0 };
    }

    return { stdout: "", stderr: `Failed to restart ${svc}.service: Unit not found`, code: 5 };
  }

  if (subcmd === "enable") {
    if (env.services[svc]) {
      env.services[svc].enabled = true;
      return {
        stdout: `Created symlink /etc/systemd/system/multi-user.target.wants/${unit}.`,
        code: 0,
      };
    }
    return { stdout: "", stderr: `Failed to enable ${svc}.service: Unit not found`, code: 1 };
  }

  if (subcmd === "disable") {
    if (env.services[svc]) {
      env.services[svc].enabled = false;
      return {
        stdout: `Removed /etc/systemd/system/multi-user.target.wants/${unit}.`,
        code: 0,
      };
    }
    return { stdout: "", stderr: `Failed to disable ${svc}.service: Unit not found`, code: 1 };
  }

  if (subcmd === "is-active") {
    const service = env.services[svc];
    if (!service) {
      return { stdout: "inactive", code: 3 };
    }
    const activeState = service.status === "running" ? "active" : 
                        service.status === "stopped" ? "inactive" :
                        service.status === "failed" ? "failed" : "inactive";
    return { 
      stdout: activeState, 
      code: activeState === "active" ? 0 : 3 
    };
  }

  if (subcmd === "is-enabled") {
    const service = env.services[svc];
    if (!service) {
      return { stdout: "disabled", code: 1 };
    }
    return { stdout: service.enabled ? "enabled" : "disabled", code: service.enabled ? 0 : 1 };
  }

  if (subcmd === "list-units" || subcmd === "list-unit-files") {
    const lines = ["UNIT                   LOAD   ACTIVE     SUB       DESCRIPTION"];

    for (const [name, service] of Object.entries(env.services)) {
      const active = service.status.pad(10);
      const sub = getSubState(service.status).pad(8);
      lines.push(`${(name + ".service").pad(22)} loaded ${active} ${sub}${name} daemon`);
    }

    return { stdout: lines.join("\n"), code: 0 };
  }

  return {
    stdout: "",
    stderr: `Unknown operation '${subcmd}'.`,
    code: 1,
  };
}

// ─── journalctl ──────────────────────────────────────────────────────────────

function handleJournalctl(ast: CommandAST, env: Env): ExecutionResult {
  const { args, flags } = ast;
  const raw = args.join(" ");

  if (flags["disk-usage"] || flags["disk_usage"] || raw.includes("--disk-usage") || raw.includes("-D") || args.includes("--disk-usage")) {
    const journalSize = env.logs.length * 1024; // ~1KB per log
    const sizeMB = (journalSize / (1024 * 1024)).toFixed(1);
    return {
      stdout: `Archived and active journals take up ${sizeMB}M in the file system.`,
      code: 0,
    };
  }

  if (flags.vacuum_size || flags.vacuum_time || raw.includes("--vacuum")) {
    const size = flags.vacuum_size || "500M";
    env.logs = env.logs.slice(-1000); // Keep last 1000 logs
    return {
      stdout: `Vacuuming done, freed space.`,
      code: 0,
    };
  }

  if (flags.unit || flags.u || raw.includes("-u ")) {
    const unitMatch = raw.match(/-u\s+(\S+)/);
    const unit = unitMatch ? unitMatch[1].replace(/\.service$/, "") : null;

    if (unit) {
      const unitLogs = env.logs.filter((l) => l.source === unit || l.message.includes(unit));
      if (unitLogs.length === 0) {
        return { stdout: `-- No entries for unit ${unit} --`, code: 0 };
      }

      return {
        stdout: unitLogs.map((l) => formatLogEntry(l)).join("\n"),
        code: 0,
      };
    }
  }

  if (flags.priority || flags.p || raw.includes("-p ")) {
    const levelMatch = raw.match(/-p\s+(\S+)/);
    const level = levelMatch ? levelMatch[1] : null;

    if (level) {
      const levelLogs = env.logs.filter((l) => l.level === level);
      if (levelLogs.length === 0) {
        return { stdout: `-- No entries with priority ${level} --`, code: 0 };
      }

      return {
        stdout: levelLogs.map((l) => formatLogEntry(l)).join("\n"),
        code: 0,
      };
    }
  }

  if (flags.xe || raw.includes("-xe")) {
    const recentLogs = env.logs.slice(-20);
    if (recentLogs.length === 0) {
      return { stdout: `-- No entries --`, code: 0 };
    }

    return {
      stdout: recentLogs.map((l) => formatLogEntry(l)).join("\n"),
      code: 0,
    };
  }

  // Default: show recent logs
  const recentLogs = env.logs.slice(-50);
  if (recentLogs.length === 0) {
    return { stdout: `-- No entries --`, code: 0 };
  }

  return {
    stdout: recentLogs.map((l) => formatLogEntry(l)).join("\n"),
    code: 0,
  };
}

// ─── ps / top ────────────────────────────────────────────────────────────────

function handleProcess(ast: CommandAST, env: Env): ExecutionResult {
  const lines = ["USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND"];

  for (const [name, service] of Object.entries(env.services)) {
    if (service.status === "running" && service.pid) {
      const cpu = (Math.random() * 5).toFixed(1);
      const mem = (Math.random() * 10).toFixed(1);
      lines.push(
        `root  ${String(service.pid).padStart(5)} ${cpu.padStart(4)} ${mem.padStart(4)} 123456 87654 ?        Ss   ${new Date(service.since || 0).toLocaleTimeString()}   0:00 ${name}`
      );
    }
  }

  return { stdout: lines.join("\n"), code: 0 };
}

// ─── df ──────────────────────────────────────────────────────────────────────

function handleDisk(ast: CommandAST, env: Env): ExecutionResult {
  const { flags, args } = ast;
  const raw = args.join(" ");
  const lines = ["Filesystem              Size  Used Avail Use% Mounted on"];

  for (const [mount, volume] of Object.entries(env.storage.volumes)) {
    const sizeGB = (volume.size / (1024 ** 3)).toFixed(0);
    const usedGB = (volume.used / (1024 ** 3)).toFixed(0);
    const availGB = (volume.size - volume.used) / (1024 ** 3);
    const usePct = Math.round((volume.used / volume.size) * 100);

    lines.push(
      `/dev/mapper/ol-root   ${sizeGB.padStart(4)}G  ${usedGB.padStart(4)}G ${availGB.toFixed(0).padStart(4)}G ${String(usePct).padStart(3)}% ${mount}`
    );
  }

  // Add inode info if requested
  if (flags.i || flags.inodes || raw.includes("-i")) {
    return handleDfInodes(env);
  }

  return { stdout: lines.join("\n"), code: 0 };
}

function handleDfInodes(env: Env): ExecutionResult {
  const lines = ["Filesystem              Inodes   IUsed    IFree IUse% Mounted on"];

  for (const [mount, volume] of Object.entries(env.storage.volumes)) {
    const inodes = volume.inodes;
    const used = volume.inodesUsed;
    const free = inodes - used;
    const usePct = Math.round((used / inodes) * 100);

    lines.push(
      `/dev/mapper/ol-root    ${String(inodes).pad(7)} ${String(used).pad(7)} ${String(free).pad(7)} ${String(usePct).padStart(4)}% ${mount}`
    );
  }

  return { stdout: lines.join("\n"), code: 0 };
}

// ─── free ────────────────────────────────────────────────────────────────────

function handleMemory(ast: CommandAST, env: Env): ExecutionResult {
  const total = 8192000;
  const used = Math.floor(total * (0.3 + Math.random() * 0.4));
  const free = total - used;
  const swapTotal = 2097152;
  const swapUsed = Math.floor(swapTotal * Math.random() * 0.2);

  return {
    stdout: `               total        used        free      shared  buff/cache   available
Mem:        ${total}     ${used}      ${free}       430       ${Math.floor(free * 0.1)}     ${Math.floor(free * 0.8)}
Swap:       ${swapTotal}      ${swapUsed}     ${swapTotal - swapUsed}`,
    code: 0,
  };
}

// ─── ip ──────────────────────────────────────────────────────────────────────

function handleNetwork(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const subcmd = args[0];

  if (subcmd === "addr" || subcmd === "a") {
    const lines = ["1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN", "    inet 127.0.0.1/8 scope host lo"];

    for (const [iface, info] of Object.entries(env.network.interfaces)) {
      const state = info.up ? "UP" : "DOWN";
      lines.push(`${iface}: <BROADCAST,MULTICAST,${state},LOWER_UP> mtu 1500 qdisc mq state ${state}`);
      if (info.ip) {
        lines.push(`    inet ${info.ip}/${info.mask || "24"} brd 192.168.1.255 scope global ${iface}`);
      }
    }

    return { stdout: lines.join("\n"), code: 0 };
  }

  if (subcmd === "route" || subcmd === "r") {
    const lines = [];

    for (const [iface, info] of Object.entries(env.network.interfaces)) {
      if (info.up && info.ip && info.gateway) {
        const network = info.ip.split(".").slice(0, 3).join(".");
        lines.push(`default via ${info.gateway} dev ${iface}`);
        lines.push(`${network}.0/24 dev ${iface} proto kernel scope link src ${info.ip}`);
      }
    }

    return { stdout: lines.join("\n") || "No routes found", code: 0 };
  }

  if (subcmd === "link" || subcmd === "l") {
    const lines = [];

    for (const [iface, info] of Object.entries(env.network.interfaces)) {
      const state = info.up ? "UP" : "DOWN";
      lines.push(`${iface}: <BROADCAST,MULTICAST,${state},LOWER_UP> mtu 1500 qdisc mq state ${state}`);
    }

    return { stdout: lines.join("\n"), code: 0 };
  }

  return { stdout: "", stderr: `Unknown command: ${subcmd}`, code: 1 };
}

// ─── ss / netstat ────────────────────────────────────────────────────────────

function handleSockets(ast: CommandAST, env: Env): ExecutionResult {
  const { args, flags } = ast;
  const raw = args.join(" ");

  if (flags.tlpn || flags.tulpn || raw.includes("-tlpn") || raw.includes("-tulpn")) {
    const lines = ["Netid  State      Recv-Q Send-Q Local Address:Port   Peer Address:Port"];

    // Add listening services
    for (const [name, service] of Object.entries(env.services)) {
      if (service.status === "running") {
        const port = getServicePort(name);
        if (port) {
          lines.push(`tcp    LISTEN     0      128          0.0.0.0:${port}          0.0.0.0:*`);
        }
      }
    }

    return { stdout: lines.join("\n"), code: 0 };
  }

  if (flags.s || raw.includes("-s")) {
    return {
      stdout: `Total: 1234 (kernel 1300)
TCP:   42 (estab 38, closed 2, orphaned 0, timewait 0)
UDP:   12
RAW:   0
FRAG:  0`,
      code: 0,
    };
  }

  return { stdout: "Netid  State      Local Address:Port", code: 0 };
}

function getServicePort(svc: string): number | null {
  const ports: Record<string, number> = {
    sshd: 22,
    httpd: 80,
    nginx: 80,
    mysqld: 3306,
    firewalld: 53,
    chronyd: 123,
  };
  return ports[svc] || null;
}

// ─── ping ────────────────────────────────────────────────────────────────────

function handlePing(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const target = args.find((a) => !a.startsWith("-"));

  if (!target) {
    return { stdout: "", stderr: "ping: usage: ping [-c count] [-i interval] destination", code: 1 };
  }

  // Check if target is reachable
  const networkUp = Object.values(env.network.interfaces).some((i) => i.up);
  if (!networkUp) {
    return {
      stdout: `ping: connect: Network is unreachable`,
      code: 2,
    };
  }

  return {
    stdout: `PING ${target} (${target}): 56 bytes of data
64 bytes from ${target}: icmp_seq=0 ttl=64 time=${(Math.random() * 10 + 1).toFixed(1)} ms
64 bytes from ${target}: icmp_seq=1 ttl=64 time=${(Math.random() * 10 + 1).toFixed(1)} ms

--- ${target} ping statistics ---
2 packets transmitted, 2 received, 0% packet loss`,
    code: 0,
  };
}

// ─── cat ─────────────────────────────────────────────────────────────────────

function handleCat(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const path = args.find((a) => !a.startsWith("-"));

  if (!path) {
    return { stdout: "", stderr: "cat: missing operand", code: 1 };
  }

  const content = env.fs.read(path);
  if (content === null) {
    return { stdout: "", stderr: `cat: ${path}: No such file or directory`, code: 1 };
  }

  return { stdout: content, code: 0 };
}

// ─── ls ──────────────────────────────────────────────────────────────────────

function handleLs(ast: CommandAST, env: Env): ExecutionResult {
  const { args, flags } = ast;
  const target = args.find((a) => !a.startsWith("-")) || ".";

  if (!env.fs.exists(target)) {
    return { stdout: "", stderr: `ls: cannot access '${target}': No such file or directory`, code: 2 };
  }

  const entries = env.fs.listDir(target);
  if (entries.length === 0) {
    return { stdout: "", code: 0 };
  }

  if (flags.l) {
    const lines = entries.map((entry) => {
      const isDir = env.fs.directories.has(`${target}/${entry}`);
      const prefix = isDir ? "d" : "-";
      const perms = isDir ? "rwxr-xr-x" : "rw-r--r--";
      return `${prefix}${perms} 1 root root  4096 Apr 12 10:00 ${entry}`;
    });
    return { stdout: lines.join("\n"), code: 0 };
  }

  return { stdout: entries.join("\n"), code: 0 };
}

// ─── cd ──────────────────────────────────────────────────────────────────────

function handleCd(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const target = args[0] || env.environment.HOME || "/root";

  if (target === "~" || target === "") {
    env.cwd = env.environment.HOME || "/root";
    return { stdout: "", code: 0 };
  }

  if (target === "-") {
    return { stdout: env.cwd, code: 0 };
  }

  const fullPath = target.startsWith("/") ? target : `${env.cwd}/${target}`;

  if (!env.fs.exists(fullPath) || !env.fs.directories.has(fullPath)) {
    return { stdout: "", stderr: `cd: ${target}: No such file or directory`, code: 1 };
  }

  env.cwd = fullPath;
  return { stdout: "", code: 0 };
}

// ─── pwd ─────────────────────────────────────────────────────────────────────

function handlePwd(ast: CommandAST, env: Env): ExecutionResult {
  return { stdout: env.cwd, code: 0 };
}

// ─── hostname ────────────────────────────────────────────────────────────────

function handleHostname(ast: CommandAST, env: Env): ExecutionResult {
  return { stdout: env.hostname, code: 0 };
}

// ─── whoami ──────────────────────────────────────────────────────────────────

function handleWhoami(ast: CommandAST, env: Env): ExecutionResult {
  return { stdout: env.user, code: 0 };
}

// ─── uname ───────────────────────────────────────────────────────────────────

function handleUname(ast: CommandAST, env: Env): ExecutionResult {
  const { flags } = ast;

  if (flags.a) {
    return {
      stdout: `Linux ${env.hostname} 5.15.0-206.153.7.el8uek.x86_64 #1 SMP x86_64 GNU/Linux`,
      code: 0,
    };
  }

  return { stdout: `Linux ${env.hostname}`, code: 0 };
}

// ─── date ────────────────────────────────────────────────────────────────────

function handleDate(ast: CommandAST, env: Env): ExecutionResult {
  return { stdout: new Date().toString(), code: 0 };
}

// ─── uptime ──────────────────────────────────────────────────────────────────

function handleUptime(ast: CommandAST, env: Env): ExecutionResult {
  const now = Date.now();
  const uptimeMs = now - (Object.values(env.services)[0]?.since || now);
  const uptimeMin = Math.floor(uptimeMs / 60000);
  const hours = Math.floor(uptimeMin / 60);
  const mins = uptimeMin % 60;

  const load1 = (Math.random() * 2 + 0.1).toFixed(2);
  const load5 = (Math.random() * 1.5 + 0.1).toFixed(2);
  const load15 = (Math.random() * 1 + 0.1).toFixed(2);

  return {
    stdout: ` ${new Date().toLocaleTimeString("en-US", { hour12: false })} up ${hours}:${String(mins).padStart(2, "0")},  1 user,  load average: ${load1}, ${load5}, ${load15}`,
    code: 0,
  };
}

// ─── mdadm ───────────────────────────────────────────────────────────────────

function handleMdadm(ast: CommandAST, env: Env): ExecutionResult {
  const { args, flags } = ast;
  const raid = env.storage.raid;

  if (flags.detail || flags.D || args.includes("--detail") || args.includes("-D")) {
    const device = args.find((a) => a.startsWith("/dev/")) || "/dev/md0";
    return {
      stdout: `${device}:
           Version : 1.2
     Creation Time : Mon Jan  1 00:00:00 2024
        Raid Level : raid${raid.level}
        Array Size : ${raid.devices[0]?.size || 0} (${(raid.devices[0]?.size / 1024 ** 2).toFixed(2)} GiB)
         State : ${raid.status}
  Active Devices : ${raid.devices.filter((d) => d.status === "active").length}
 Failed Devices : ${raid.devices.filter((d) => d.status === "failed").length}
         Layout : near=2
     Chunk Size : 512K

  Number  Major  Minor  RaidDevice State
${raid.devices.map((d, i) => `     ${i}       8       ${i + 1}        ${i}      ${d.status}  ${d.name}`).join("\n")}`,
      code: 0,
    };
  }

  if (flags.add || args.includes("--add")) {
    const device = args.find((a) => a.startsWith("/dev/"));
    if (device) {
      const disk = raid.devices.find((d) => d.name === device);
      if (disk) {
        disk.status = "rebuilding";
        raid.status = "rebuilding";

        // Simulate rebuild completion
        setTimeout(() => {
          disk.status = "active";
          raid.status = "healthy";
          raid.missingBlocks = 0;
          raid.rebuildProgress = 100;
        }, 5000);

        return {
          stdout: `mdadm: added ${device}\nRebuild in progress — check with: cat /proc/mdstat`,
          code: 0,
        };
      }

      // Device not in array, add as spare
      return {
        stdout: `mdadm: added ${device}\nRebuild in progress — check with: cat /proc/mdstat`,
        code: 0,
      };
    }

    return { stdout: "", stderr: "mdadm: device not found", code: 1 };
  }

  return { stdout: "", stderr: "mdadm: invalid option", code: 1 };
}

// ─── service ─────────────────────────────────────────────────────────────────

function handleService(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const svc = args[0];
  const action = args[1];

  if (!svc || !action) {
    return { stdout: "", stderr: "Usage: service <option> | --status-all | [ service_name [ command | --full-restart ] ]", code: 1 };
  }

  // Delegate to systemctl logic
  return handleSystemctl(
    {
      cmd: "systemctl",
      args: [action, svc],
      flags: {},
      raw: `systemctl ${action} ${svc}`,
    },
    env
  );
}

// ─── kill ────────────────────────────────────────────────────────────────────

function handleKill(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const pid = parseInt(args.find((a) => /^\d+$/.test(a)) || "0", 10);

  if (!pid) {
    return { stdout: "", stderr: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec", code: 1 };
  }

  // Find service by PID
  for (const [name, service] of Object.entries(env.services)) {
    if (service.pid === pid) {
      service.status = "stopped";
      service.pid = undefined;
      return { stdout: "", code: 0 };
    }
  }

  return { stdout: "", stderr: `kill: (${pid}) - No such process`, code: 1 };
}

// ─── chmod ───────────────────────────────────────────────────────────────────

function handleChmod(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const mode = args[0];
  const path = args[1];

  if (!mode || !path) {
    return { stdout: "", stderr: "chmod: missing operand", code: 1 };
  }

  if (!env.fs.exists(path)) {
    return { stdout: "", stderr: `chmod: cannot access '${path}': No such file or directory`, code: 1 };
  }

  return { stdout: "", code: 0 };
}

// ─── chown ───────────────────────────────────────────────────────────────────

function handleChown(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const owner = args[0];
  const path = args[1];

  if (!owner || !path) {
    return { stdout: "", stderr: "chown: missing operand", code: 1 };
  }

  if (!env.fs.exists(path)) {
    return { stdout: "", stderr: `chown: cannot access '${path}': No such file or directory`, code: 1 };
  }

  return { stdout: "", code: 0 };
}

// ─── touch ───────────────────────────────────────────────────────────────────

function handleTouch(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const path = args[0];

  if (!path) {
    return { stdout: "", stderr: "touch: missing file operand", code: 1 };
  }

  if (!env.fs.exists(path)) {
    env.fs.write(path, "", 0o644);
  }

  return { stdout: "", code: 0 };
}

// ─── rm ──────────────────────────────────────────────────────────────────────

function handleRm(ast: CommandAST, env: Env): ExecutionResult {
  const { args, flags } = ast;
  const path = args[0];

  if (!path) {
    return { stdout: "", stderr: "rm: missing operand", code: 1 };
  }

  if (!env.fs.exists(path)) {
    return { stdout: "", stderr: `rm: cannot remove '${path}': No such file or directory`, code: 1 };
  }

  // Handle destructive operations (check before deletion)
  if (flags.f || flags.r || flags.rf || flags["-rf"]) {
    if (path.includes("/var/lib/mysql")) {
      if (env.services.mysqld) {
        env.services.mysqld.status = "failed";
        env.logs.push({
          timestamp: Date.now(),
          source: "mysql",
          level: "crit",
          message: "InnoDB: data files missing — aborting",
        });
      }
    }
  }

  // Remove file or directory
  env.fs.remove(path);
  env.fs.directories.delete(path);

  return { stdout: "", code: 0 };
}

// ─── mkdir ───────────────────────────────────────────────────────────────────

function handleMkdir(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const path = args[0];

  if (!path) {
    return { stdout: "", stderr: "mkdir: missing operand", code: 1 };
  }

  if (env.fs.exists(path)) {
    return { stdout: "", stderr: `mkdir: cannot create directory '${path}': File exists`, code: 1 };
  }

  env.fs.directories.add(path);
  return { stdout: "", code: 0 };
}

// ─── find ────────────────────────────────────────────────────────────────────

function handleFind(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const path = args[0] || ".";

  if (!env.fs.exists(path)) {
    return { stdout: "", stderr: `find: '${path}': No such file or directory`, code: 1 };
  }

  const entries = env.fs.listDir(path);
  return { stdout: entries.length > 0 ? entries.join("\n") : "", code: 0 };
}

// ─── mount / umount ──────────────────────────────────────────────────────────

function handleMount(ast: CommandAST, env: Env): ExecutionResult {
  return { stdout: "sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)\nproc on /proc type proc (rw,nosuid,nodev,noexec,relatime)", code: 0 };
}

function handleUmount(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const target = args[0];

  if (!target) {
    return { stdout: "", stderr: "umount: missing operand", code: 1 };
  }

  return { stdout: "", code: 0 };
}

// ─── curl / wget ─────────────────────────────────────────────────────────────

function handleCurl(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;
  const url = args.find((a) => !a.startsWith("-"));

  if (!url) {
    return { stdout: "", stderr: "curl: try 'curl --help' for more information", code: 2 };
  }

  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    if (env.services.httpd?.status === "running" || env.services.nginx?.status === "running") {
      return {
        stdout: "<html><body><h1>It works!</h1></body></html>",
        code: 0,
      };
    }

    return {
      stdout: "",
      stderr: `curl: (7) Failed to connect to ${url} port 80: Connection refused`,
      code: 7,
    };
  }

  return {
    stdout: `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>301 Moved Permanently</title>\n</head><body>\n<h1>Moved Permanently</h1>\n</body></html>`,
    code: 0,
  };
}

function handleWget(ast: CommandAST, env: Env): ExecutionResult {
  return handleCurl(ast, env);
}

// ─── systemd-analyze ─────────────────────────────────────────────────────────

function handleSystemdAnalyze(ast: CommandAST, env: Env): ExecutionResult {
  const { args } = ast;

  if (args[0] === "blame") {
    return {
      stdout: `2.345s httpd.service\n1.234s mysqld.service\n890ms sshd.service\n456ms network.service`,
      code: 0,
    };
  }

  if (args[0] === "critical-chain") {
    return {
      stdout: `The time after the unit is active or started is printed after the "@" character.
The time the unit takes to start is printed after the "+" character.

graphical.target @3.456s
└─multi-user.target @3.456s
  └─httpd.service @1.234s +2.100s`,
      code: 0,
    };
  }

  return { stdout: "Startup finished in 3.456s (kernel) + 2.345s (userspace) = 5.801s", code: 0 };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapStatus(status: ServiceState): string {
  const mapping: Record<ServiceState, string> = {
    running: "active (running)",
    stopped: "inactive (dead)",
    failed: "failed",
    starting: "activating (start)",
    stopping: "deactivating (stop)",
    degraded: "active (exited)",
    restarting: "activating (auto-restart)",
  };
  return mapping[status] || "unknown";
}

function getSubState(status: ServiceState): string {
  const mapping: Record<ServiceState, string> = {
    running: "running",
    stopped: "dead",
    failed: "failed",
    starting: "start",
    stopping: "stop",
    degraded: "exited",
    restarting: "start",
  };
  return mapping[status] || "unknown";
}

function formatLogEntry(entry: any): string {
  const date = new Date(entry.timestamp);
  const timestamp = date.toISOString().replace("T", " ").substring(0, 19);
  return `${timestamp} ${entry.source}[${Math.floor(Math.random() * 9000) + 1000}]: ${entry.message}`;
}
