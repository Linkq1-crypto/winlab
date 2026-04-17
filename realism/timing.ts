// realism/timing.ts — Realistic timing for command execution and async transitions

import type { CommandAST } from "./parsers";
import type { Env, ServiceState } from "./state";
import { sleep, jitter } from "./noise";

/**
 * Timing profiles for different command types.
 */
const TIMING_PROFILES: Record<string, { base: number; jitter: number }> = {
  "systemctl_start": { base: 800, jitter: 400 },
  "systemctl_stop": { base: 400, jitter: 200 },
  "systemctl_restart": { base: 1000, jitter: 500 },
  "systemctl_status": { base: 50, jitter: 30 },
  "service_quick": { base: 100, jitter: 50 },
  "io_heavy": { base: 1500, jitter: 800 },
  "network_cmd": { base: 200, jitter: 150 },
  "filesystem_cmd": { base: 150, jitter: 100 },
  "instant": { base: 20, jitter: 10 },
};

/**
 * Schedule realistic delays based on command type.
 */
export async function schedule(ast: CommandAST, env: Env): Promise<void> {
  const profile = getTimingProfile(ast);
  const delay = profile.base + Math.floor(Math.random() * profile.jitter);

  // Simulate async state transitions
  await simulateTransitions(ast, env);

  // Add timing delay
  await sleep(delay);
}

/**
 * Get the timing profile for a command.
 */
function getTimingProfile(ast: CommandAST): { base: number; jitter: number } {
  const { cmd, args } = ast;

  // systemctl commands
  if (cmd === "systemctl") {
    const subcmd = args[0];

    if (subcmd === "start") return TIMING_PROFILES.systemctl_start;
    if (subcmd === "stop") return TIMING_PROFILES.systemctl_stop;
    if (subcmd === "restart" || subcmd === "reload") return TIMING_PROFILES.systemctl_restart;
    if (subcmd === "status" || subcmd === "is-active" || subcmd === "is-enabled") {
      return TIMING_PROFILES.systemctl_status;
    }
    if (subcmd === "list-units" || subcmd === "list-unit-files") {
      return TIMING_PROFILES.io_heavy;
    }

    return TIMING_PROFILES.service_quick;
  }

  // Filesystem commands
  if (cmd === "df" || cmd === "du" || cmd === "find") {
    return TIMING_PROFILES.io_heavy;
  }

  if (cmd === "ls" || cmd === "cat" || cmd === "head" || cmd === "tail") {
    return TIMING_PROFILES.filesystem_cmd;
  }

  // Network commands
  if (cmd === "ping" || cmd === "curl" || cmd === "wget") {
    return TIMING_PROFILES.network_cmd;
  }

  if (cmd === "ss" || cmd === "netstat" || cmd === "lsof") {
    return TIMING_PROFILES.io_heavy;
  }

  // Storage commands
  if (cmd === "mdadm" || cmd === "fsck" || cmd === "mount" || cmd === "umount") {
    return TIMING_PROFILES.io_heavy;
  }

  if (cmd === "pvs" || cmd === "vgs" || cmd === "lvs" || cmd === "lvextend") {
    return TIMING_PROFILES.io_heavy;
  }

  // Database commands
  if (cmd === "mysql" || cmd === "mysqladmin") {
    return TIMING_PROFILES.network_cmd;
  }

  // Process commands
  if (cmd === "ps" || cmd === "top" || cmd === "htop" || cmd === "free" || cmd === "vmstat") {
    return TIMING_PROFILES.service_quick;
  }

  // Default: quick command
  return TIMING_PROFILES.instant;
}

/**
 * Simulate realistic state transitions (e.g., starting → running).
 */
async function simulateTransitions(ast: CommandAST, env: Env): Promise<void> {
  const { cmd, args } = ast;

  if (cmd === "systemctl") {
    const subcmd = args[0];
    const svc = args[1]?.replace(/\.service$/, "");

    if (subcmd === "start" || subcmd === "restart") {
      // Phase 1: starting
      if (env.services[svc]) {
        env.services[svc].status = "starting";
        await sleep(200 + jitter(100));
        // Complete the transition
        env.services[svc].status = "running";
      }
    }

    if (subcmd === "stop") {
      // Phase 1: stopping
      if (env.services[svc]) {
        env.services[svc].status = "stopping";
        await sleep(150 + jitter(50));
        // Complete the transition
        env.services[svc].status = "stopped";
        env.services[svc].pid = undefined;
      }
    }
  }

  // RAID rebuild simulation (progressive)
  if (cmd === "mdadm" && args.includes("--add")) {
    env.storage.raid.status = "rebuilding";
    env.storage.raid.rebuildProgress = 0;

    // Simulate incremental rebuild
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      await sleep(100 + jitter(50));
      env.storage.raid.rebuildProgress = Math.min(100, Math.floor((i / steps) * 100));
    }

    env.storage.raid.status = "healthy";
    env.storage.raid.rebuildProgress = 100;
  }
}

/**
 * Calculate estimated time for a command to complete.
 */
export function estimateTime(ast: CommandAST): number {
  const profile = getTimingProfile(ast);
  return profile.base + profile.jitter / 2;
}

/**
 * Check if a service has completed its transition.
 */
export function isTransitionComplete(env: Env, svc: string): boolean {
  const service = env.services[svc];
  if (!service) return false;

  const terminalStates: ServiceState[] = ["running", "stopped", "failed"];
  return terminalStates.includes(service.status);
}
