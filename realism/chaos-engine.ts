// realism/chaos-engine.ts — Netflix-style chaos engineering for the simulation
// Injects realistic failures, cascades, and degradations into an Env.

import type { Env, ServiceState } from "./state";

export interface ChaosEvent {
  type: string;
  impact: (env: any) => void;
  probability: number;
  category: string;
}

export interface ChaosConfig {
  intensity: number; // 0-1, scales probability of all events
  intervalMs: number;
  correlated: boolean; // enable cascade events
  userSkill: "junior" | "mid" | "senior" | "expert";
}

export class ChaosEngine {
  private config: ChaosConfig;
  private events: ChaosEvent[];
  private lastEventTime: number = 0;

  constructor(config?: Partial<ChaosConfig>) {
    this.config = {
      intensity: config?.intensity ?? 0.3,
      intervalMs: config?.intervalMs ?? 10_000,
      correlated: config?.correlated ?? true,
      userSkill: config?.userSkill ?? "mid",
    };
    this.events = this.buildEventCatalog();
  }

  // -----------------------------------------------------------------------
  // Event catalog — grouped by category
  // -----------------------------------------------------------------------

  private buildEventCatalog(): ChaosEvent[] {
    return [
      // ---- Network ----
      {
        type: "network_latency_spike",
        category: "network",
        probability: 0.15,
        impact: (env: any) => {
          env.network = env.network || {};
          const spike = 500 + Math.random() * 4500;
          env.network.latencyMs = Math.round(spike);
          env.network.drops = Math.min(1, (env.network.drops ?? 0) + 0.05);
        },
      },
      {
        type: "packet_loss",
        category: "network",
        probability: 0.1,
        impact: (env: any) => {
          env.network = env.network || {};
          env.network.drops = Math.min(1, 0.1 + Math.random() * 0.4);
        },
      },
      {
        type: "network_partition",
        category: "network",
        probability: 0.03,
        impact: (env: any) => {
          if (env.network?.interfaces) {
            for (const key of Object.keys(env.network.interfaces)) {
              if (Math.random() < 0.5) {
                env.network.interfaces[key].up = false;
              }
            }
          }
          // Dependent services must degrade
          this.degradeServicesByDep(env, "network");
        },
      },
      {
        type: "dns_failure",
        category: "network",
        probability: 0.08,
        impact: (env: any) => {
          // Simulate DNS failure by breaking resolv.conf
          env.fs?.write?.("/etc/resolv.conf", "", 0o644);
          env.network = env.network || {};
          env.network.latencyMs = (env.network.latencyMs ?? 20) + 2000;
        },
      },
      {
        type: "dns_recovery",
        category: "network",
        probability: 0.05,
        impact: (env: any) => {
          env.fs?.write?.("/etc/resolv.conf", `nameserver 10.0.10.1\nnameserver 10.0.10.2\nsearch lab.local`, 0o644);
          if (env.network) {
            env.network.latencyMs = Math.max(20, (env.network.latencyMs ?? 0) - 1500);
          }
        },
      },

      // ---- Storage ----
      {
        type: "disk_degradation",
        category: "storage",
        probability: 0.07,
        impact: (env: any) => {
          const raid = env.storage?.raid;
          if (raid) {
            // Degrade one device
            const idx = Math.floor(Math.random() * raid.devices.length);
            if (raid.devices[idx]) {
              raid.devices[idx].status = "failed";
            }
            raid.status = raid.status === "failed" ? "failed" : "degraded";
            raid.missingBlocks = (raid.missingBlocks ?? 0) + Math.floor(Math.random() * 100);
            raid.rebuildProgress = 0;
          }
          // Degrade storage-dependent services
          this.degradeServicesByDep(env, "storage");
        },
      },
      {
        type: "io_spike",
        category: "storage",
        probability: 0.1,
        impact: (env: any) => {
          // Spike volume usage
          for (const [, vol] of Object.entries(env.storage?.volumes ?? {})) {
            const v = vol as any;
            const spike = v.size * 0.1 * Math.random();
            v.used = Math.min(v.size, v.used + spike);
          }
        },
      },
      {
        type: "disk_corruption",
        category: "storage",
        probability: 0.02,
        impact: (env: any) => {
          const raid = env.storage?.raid;
          if (raid) {
            raid.status = "failed";
            raid.missingBlocks = (raid.missingBlocks ?? 0) + 500 + Math.floor(Math.random() * 2000);
            raid.rebuildProgress = 0;
            for (const dev of raid.devices) {
              if (Math.random() < 0.5) dev.status = "failed";
            }
          }
          // All storage-dependent services fail
          this.failServicesByDep(env, "storage");
        },
      },
      {
        type: "disk_recovery",
        category: "storage",
        probability: 0.03,
        impact: (env: any) => {
          const raid = env.storage?.raid;
          if (raid && raid.status === "degraded") {
            raid.status = "rebuilding";
            raid.rebuildProgress = Math.floor(Math.random() * 50);
          }
        },
      },

      // ---- Service crashes ----
      {
        type: "service_crash_nginx",
        category: "service",
        probability: 0.06,
        impact: (env: any) => {
          this.crashService(env, "nginx");
          // If httpd is running, it may become primary
          if (env.services?.httpd && env.services.httpd.status === "stopped") {
            env.services.httpd.status = "starting";
          }
        },
      },
      {
        type: "service_crash_mysql",
        category: "service",
        probability: 0.05,
        impact: (env: any) => {
          this.crashService(env, "mysqld");
        },
      },
      {
        type: "service_crash_sshd",
        category: "service",
        probability: 0.04,
        impact: (env: any) => {
          this.crashService(env, "sshd");
        },
      },
      {
        type: "service_crash_httpd",
        category: "service",
        probability: 0.05,
        impact: (env: any) => {
          this.crashService(env, "httpd");
        },
      },
      {
        type: "service_crash_rsyslog",
        category: "service",
        probability: 0.04,
        impact: (env: any) => {
          this.crashService(env, "rsyslog");
        },
      },
      {
        type: "service_recovery",
        category: "service",
        probability: 0.08,
        impact: (env: any) => {
          // Attempt to recover one failed service
          for (const [name, s] of Object.entries(env.services ?? {})) {
            const service = s as any;
            if (service.status === "failed" && service.enabled) {
              service.status = "starting";
              break;
            }
          }
        },
      },

      // ---- Auth ----
      {
        type: "ldap_timeout",
        category: "auth",
        probability: 0.06,
        impact: (env: any) => {
          // Simulate LDAP becoming unreachable
          if (env.services?.sssd) {
            env.services.sssd.status = "degraded";
          }
          // Increase latency (LDAP lookups are slow)
          env.network = env.network || {};
          env.network.latencyMs = (env.network.latencyMs ?? 20) + 3000;
        },
      },
      {
        type: "auth_failure",
        category: "auth",
        probability: 0.03,
        impact: (env: any) => {
          // Break pam config
          env.fs?.write?.("/etc/pam.d/system-auth", "# CORRUPTED\nauth required pam_deny.so", 0o600);
        },
      },
      {
        type: "auth_recovery",
        category: "auth",
        probability: 0.04,
        impact: (env: any) => {
          // Restore pam
          env.fs?.write?.("/etc/pam.d/system-auth", `#%PAM-1.0\nauth      required      pam_env.so\nauth      sufficient    pam_unix.so\nauth      required      pam_deny.so`, 0o644);
          if (env.services?.sssd && env.services.sssd.status === "degraded") {
            env.services.sssd.status = "running";
          }
        },
      },

      // ---- Resource exhaustion ----
      {
        type: "memory_leak",
        category: "resource",
        probability: 0.06,
        impact: (env: any) => {
          // Simulate memory pressure by increasing volume usage and degrading services
          for (const [, vol] of Object.entries(env.storage?.volumes ?? {})) {
            const v = vol as any;
            v.used = Math.min(v.size, v.used + v.size * 0.05);
          }
          // Degrade a random running service
          const running = Object.entries(env.services ?? {}).filter(
            ([, s]: [string, any]) => s.status === "running"
          );
          if (running.length > 0) {
            const [name] = running[Math.floor(Math.random() * running.length)];
            if (env.services[name]) {
              env.services[name].status = "degraded";
            }
          }
        },
      },
      {
        type: "cpu_spike",
        category: "resource",
        probability: 0.08,
        impact: (env: any) => {
          // Spike latency and drops
          env.network = env.network || {};
          env.network.latencyMs = (env.network.latencyMs ?? 20) + 1000 + Math.random() * 2000;
          env.network.drops = Math.min(1, (env.network.drops ?? 0) + 0.1);
        },
      },

      // ---- Correlated / cascade events ----
      {
        type: "cascade_network_dns_nginx",
        category: "correlated",
        probability: 0.02,
        impact: (env: any) => {
          // Network partition -> DNS failure -> nginx crash cascade
          if (env.network?.interfaces) {
            for (const key of Object.keys(env.network.interfaces)) {
              if (Math.random() < 0.6) env.network.interfaces[key].up = false;
            }
          }
          env.network.latencyMs = 5000;
          env.network.drops = 0.5;

          // Break DNS
          env.fs?.write?.("/etc/resolv.conf", "", 0o644);

          // Crash nginx and httpd (no network)
          this.crashService(env, "nginx");
          this.crashService(env, "httpd");

          // Degrade chronyd (can't reach NTP)
          if (env.services?.chronyd) {
            env.services.chronyd.status = "degraded";
          }
        },
      },
      {
        type: "cascade_storage_mysql",
        category: "correlated",
        probability: 0.015,
        impact: (env: any) => {
          // Disk degradation -> MySQL crash -> dependent services fail
          const raid = env.storage?.raid;
          if (raid) {
            raid.status = "failed";
            raid.missingBlocks = (raid.missingBlocks ?? 0) + 1000;
            for (const dev of raid.devices) {
              dev.status = "failed";
            }
          }
          this.failService(env, "mysqld");
          this.failService(env, "rsyslog");
        },
      },
      {
        type: "cascade_auth_lockout",
        category: "correlated",
        probability: 0.01,
        impact: (env: any) => {
          // LDAP timeout + SSSD fail + PAM corruption = auth lockout
          if (env.services?.sssd) {
            env.services.sssd.status = "failed";
          }
          env.fs?.write?.("/etc/pam.d/system-auth", "# CORRUPTED\nauth required pam_deny.so", 0o600);
          env.network = env.network || {};
          env.network.latencyMs = (env.network.latencyMs ?? 20) + 5000;

          // Crash sshd (can't authenticate)
          this.crashService(env, "sshd");
        },
      },
      {
        type: "full_outage",
        category: "correlated",
        probability: 0.005,
        impact: (env: any) => {
          // Everything goes down
          if (env.network?.interfaces) {
            for (const key of Object.keys(env.network.interfaces)) {
              env.network.interfaces[key].up = false;
            }
          }
          env.network.latencyMs = 9999;
          env.network.drops = 1;

          const raid = env.storage?.raid;
          if (raid) {
            raid.status = "failed";
            raid.missingBlocks = 5000;
          }

          for (const [, s] of Object.entries(env.services ?? {})) {
            (s as any).status = "failed";
          }

          env.fs?.write?.("/etc/resolv.conf", "", 0o644);
        },
      },
    ];
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private crashService(env: any, name: string): void {
    const s = env.services?.[name];
    if (s && (s.status === "running" || s.status === "degraded")) {
      s.status = "failed";
      s.pid = undefined;
      s.since = Date.now();
    }
  }

  private failService(env: any, name: string): void {
    const s = env.services?.[name];
    if (s) {
      s.status = "failed";
      s.pid = undefined;
    }
  }

  private degradeServicesByDep(env: any, dep: string): void {
    for (const [name, s] of Object.entries(env.services ?? {})) {
      const service = s as any;
      if (service.deps?.includes(dep) && service.status === "running") {
        service.status = "degraded";
      }
    }
  }

  private failServicesByDep(env: any, dep: string): void {
    for (const [name, s] of Object.entries(env.services ?? {})) {
      const service = s as any;
      if (service.deps?.includes(dep) && (service.status === "running" || service.status === "degraded")) {
        service.status = "failed";
        service.pid = undefined;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Run one round of chaos: pick events based on probability + intensity, apply them. */
  runChaos(env: any): ChaosEvent[] {
    const triggered: ChaosEvent[] = [];
    const intensity = this.config.intensity;

    // Shuffle events for variety
    const shuffled = [...this.events].sort(() => Math.random() - 0.5);

    for (const event of shuffled) {
      const effectiveProb = event.probability * intensity;
      if (Math.random() < effectiveProb) {
        try {
          event.impact(env);
          triggered.push(event);
        } catch {
          // Skip events that fail to apply
        }
      }
    }

    // If correlated mode is on, and we triggered a network or storage event,
    // try to trigger a cascade event too
    if (this.config.correlated && triggered.length > 0) {
      const hasNetwork = triggered.some((e) => e.category === "network");
      const hasStorage = triggered.some((e) => e.category === "storage");
      if (hasNetwork || hasStorage) {
        const cascadeType = hasNetwork
          ? "cascade_network_dns_nginx"
          : "cascade_storage_mysql";
        const cascadeEvent = this.events.find((e) => e.type === cascadeType);
        if (cascadeEvent && Math.random() < 0.3 * intensity) {
          try {
            cascadeEvent.impact(env);
            triggered.push(cascadeEvent);
          } catch {
            // Skip
          }
        }
      }
    }

    this.lastEventTime = Date.now();
    return triggered;
  }

  /** Continuous chaos loop — runs at `intervalMs` until `stopSignal.stopped` is true. */
  async chaosLoop(
    env: any,
    stopSignal?: { stopped: boolean }
  ): Promise<void> {
    while (!stopSignal?.stopped) {
      this.runChaos(env);
      await new Promise((resolve) => setTimeout(resolve, this.config.intervalMs));
    }
  }

  /** Force-trigger a specific chaos event by type name. */
  triggerIncident(env: any, type: string): void {
    const event = this.events.find((e) => e.type === type);
    if (event) {
      event.impact(env);
    } else {
      // Unknown incident type — do nothing
    }
  }

  /** Return all available event type names. */
  getEventTypes(): string[] {
    return this.events.map((e) => e.type);
  }

  /** Get the current config. */
  getConfig(): ChaosConfig {
    return { ...this.config };
  }

  /** Update config at runtime. */
  setConfig(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Default chaos engine — moderate intensity, mid-level skill. */
export function createDefaultChaosEngine(): ChaosEngine {
  return new ChaosEngine({
    intensity: 0.3,
    intervalMs: 10_000,
    correlated: true,
    userSkill: "mid",
  });
}

/** Expert chaos engine — high intensity, expert-level correlated cascades, shorter intervals. */
export function createExpertChaosEngine(): ChaosEngine {
  return new ChaosEngine({
    intensity: 0.7,
    intervalMs: 5_000,
    correlated: true,
    userSkill: "expert",
  });
}

/** Junior-friendly chaos — low intensity, mostly single-point failures. */
export function createJuniorChaosEngine(): ChaosEngine {
  return new ChaosEngine({
    intensity: 0.15,
    intervalMs: 20_000,
    correlated: false,
    userSkill: "junior",
  });
}

/** Senior chaos — balanced with moderate cascades. */
export function createSeniorChaosEngine(): ChaosEngine {
  return new ChaosEngine({
    intensity: 0.5,
    intervalMs: 8_000,
    correlated: true,
    userSkill: "senior",
  });
}
