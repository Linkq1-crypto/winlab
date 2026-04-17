// realism/clustering.ts — Behavioral clustering engine

import type { CommandTelemetry, SessionTelemetry, RealityTelemetry } from "./telemetry";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Cluster {
  id: string;
  name: string;
  description: string;
  sessions: string[]; // session IDs
  centroid: BehavioralProfile;
  characteristics: string[];
  avgSolveTime: number;
  solveRate: number;
  commonCommands: Array<{ cmd: string; frequency: number }>;
  commonErrors: Array<{ error: string; frequency: number }>;
}

export interface BehavioralProfile {
  // Command patterns
  avgCommandsPerSession: number;
  avgTimeBetweenCommands: number;
  errorRate: number;
  retryRate: number;
  hintDependency: number;

  // Service interaction patterns
  serviceRestartFrequency: number;
  logInspectionFrequency: number;
  diagnosticCommandRatio: number;

  // Problem-solving style
  exploratoryRatio: number; // ls, ps, df, etc.
  targetedRatio: number;   // systemctl, specific fixes
  destructiveRatio: number; // rm, kill, etc.

  // Temporal patterns
  avgSessionDuration: number;
  commandsPerMinute: number;
}

export interface ClusterResult {
  clusters: Cluster[];
  unassigned: string[];
  silhouetteScore: number;
}

// ─── Clustering Engine ───────────────────────────────────────────────────────

export class ClusteringEngine {
  private clusters: Map<string, Cluster> = new Map();
  private minClusterSize: number;

  constructor(minClusterSize = 3) {
    this.minClusterSize = minClusterSize;
  }

  /**
   * Run clustering on a set of sessions.
   */
  cluster(sessions: SessionTelemetry[]): ClusterResult {
    // Build behavioral profiles
    const profiles = sessions.map((s) => ({
      sessionId: s.sessionId,
      profile: this.buildProfile(s),
    }));

    // Initialize clusters using k-means++ style seeding
    const initialClusters = this.initializeClusters(profiles);

    // Run k-means iterations
    const clusters = this.runKMeans(initialClusters, profiles, sessions);

    // Analyze cluster characteristics
    const analyzedClusters = clusters.map((c) => this.analyzeCluster(c, sessions));

    // Calculate silhouette score
    const silhouetteScore = this.calculateSilhouetteScore(clusters, profiles);

    return {
      clusters: analyzedClusters,
      unassigned: [],
      silhouetteScore,
    };
  }

  /**
   * Build a behavioral profile from a session.
   */
  buildProfile(session: SessionTelemetry): BehavioralProfile {
    const commands = session.commands;
    const totalCommands = commands.length;

    // Categorize commands
    const exploratory = commands.filter(
      (c) => ["ls", "ps", "df", "free", "top", "cat", "journalctl", "dmesg", "ip", "ss"].includes(c.cmd)
    ).length;

    const targeted = commands.filter(
      (c) => ["systemctl", "service", "mdadm", "mount", "umount"].includes(c.cmd)
    ).length;

    const destructive = commands.filter(
      (c) => ["rm", "kill", "killall", "truncate"].includes(c.cmd)
    ).length;

    const diagnostic = commands.filter(
      (c) => ["journalctl", "cat", "dmesg", "grep", "tail", "ss", "ip", "ping"].includes(c.cmd)
    ).length;

    const logInspections = commands.filter(
      (c) => ["journalctl", "tail", "cat", "grep", "dmesg"].includes(c.cmd)
    ).length;

    const serviceRestarts = commands.filter(
      (c) => c.cmd === "systemctl" && (c.args.includes("restart") || c.args.includes("start"))
    ).length;

    const errors = commands.filter((c) => c.exitCode !== 0).length;
    const retries = commands.filter((c) => c.wasRetry).length;
    const hints = commands.filter((c) => c.wasHint).length;

    const sessionDuration = session.completedAt
      ? session.completedAt - session.startedAt
      : 60000;

    return {
      avgCommandsPerSession: totalCommands,
      avgTimeBetweenCommands: session.avgCommandInterval,
      errorRate: totalCommands > 0 ? errors / totalCommands : 0,
      retryRate: totalCommands > 0 ? retries / totalCommands : 0,
      hintDependency: totalCommands > 0 ? hints / totalCommands : 0,
      serviceRestartFrequency: totalCommands > 0 ? serviceRestarts / totalCommands : 0,
      logInspectionFrequency: totalCommands > 0 ? logInspections / totalCommands : 0,
      diagnosticCommandRatio: totalCommands > 0 ? diagnostic / totalCommands : 0,
      exploratoryRatio: totalCommands > 0 ? exploratory / totalCommands : 0,
      targetedRatio: totalCommands > 0 ? targeted / totalCommands : 0,
      destructiveRatio: totalCommands > 0 ? destructive / totalCommands : 0,
      avgSessionDuration: sessionDuration,
      commandsPerMinute: sessionDuration > 0 ? (totalCommands / sessionDuration) * 60000 : 0,
    };
  }

  /**
   * Assign a cluster name based on characteristics.
   */
  nameCluster(characteristics: string[]): string {
    if (characteristics.includes("high_exploratory")) return "explorers";
    if (characteristics.includes("high_targeted")) return "troubleshooters";
    if (characteristics.includes("high_destructive")) return "aggressive_fixers";
    if (characteristics.includes("high_hints")) return "hint_dependent";
    if (characteristics.includes("high_errors")) return "struggling";
    if (characteristics.includes("fast_solve")) return "efficient_solvers";
    if (characteristics.includes("log_heavy")) return "log analysts";
    if (characteristics.includes("service_restart_heavy")) return "restart_all";
    return "mixed";
  }

  /**
   * Find the closest cluster for a new session.
   */
  findClosestCluster(profile: BehavioralProfile): { cluster: Cluster; distance: number } {
    let closest: Cluster | null = null;
    let minDistance = Infinity;

    for (const cluster of this.clusters.values()) {
      const distance = this.profileDistance(profile, cluster.centroid);
      if (distance < minDistance) {
        minDistance = distance;
        closest = cluster;
      }
    }

    return { cluster: closest!, distance: minDistance };
  }

  /**
   * Add a session to existing clustering or create new cluster.
   */
  addSession(session: SessionTelemetry): void {
    const profile = this.buildProfile(session);

    if (this.clusters.size === 0) {
      // First session, create initial cluster
      this.createCluster(session, profile);
      return;
    }

    // Find closest cluster
    const { cluster, distance } = this.findClosestCluster(profile);

    // Threshold for creating new cluster
    if (distance > 0.5) {
      this.createCluster(session, profile);
    } else {
      cluster.sessions.push(session.sessionId);
      // Update centroid
      cluster.centroid = this.updateCentroid(cluster.centroid, profile, cluster.sessions.length);
    }
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private initializeClusters(
    profiles: Array<{ sessionId: string; profile: BehavioralProfile }>
  ): Array<{ centroid: BehavioralProfile; members: string[] }> {
    if (profiles.length === 0) return [];

    // Simple k-means++ initialization
    const k = Math.min(5, Math.max(2, Math.floor(profiles.length / 5)));
    const clusters: Array<{ centroid: BehavioralProfile; members: string[] }> = [];

    // Pick first centroid randomly
    const firstIdx = Math.floor(Math.random() * profiles.length);
    clusters.push({
      centroid: profiles[firstIdx].profile,
      members: [profiles[firstIdx].sessionId],
    });

    // Pick remaining centroids with probability proportional to distance
    for (let i = 1; i < k; i++) {
      const distances = profiles.map((p) => {
        const minDist = Math.min(
          ...clusters.map((c) => this.profileDistance(p.profile, c.centroid))
        );
        return minDist * minDist;
      });

      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      let rand = Math.random() * totalDist;

      for (let j = 0; j < profiles.length; j++) {
        rand -= distances[j];
        if (rand <= 0) {
          clusters.push({
            centroid: profiles[j].profile,
            members: [profiles[j].sessionId],
          });
          break;
        }
      }
    }

    return clusters;
  }

  private runKMeans(
    initial: Array<{ centroid: BehavioralProfile; members: string[] }>,
    profiles: Array<{ sessionId: string; profile: BehavioralProfile }>,
    sessions: SessionTelemetry[]
  ): Cluster[] {
    let clusters = initial;
    const maxIterations = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assignment step
      const newClusters: Array<{ centroid: BehavioralProfile; members: string[] }> = clusters.map(
        (c) => ({ centroid: c.centroid, members: [] })
      );

      for (const p of profiles) {
        let minDist = Infinity;
        let closestIdx = 0;

        for (let i = 0; i < clusters.length; i++) {
          const dist = this.profileDistance(p.profile, clusters[i].centroid);
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }

        newClusters[closestIdx].members.push(p.sessionId);
      }

      // Update centroids
      clusters = newClusters.map((c) => {
        const memberProfiles = profiles
          .filter((p) => c.members.includes(p.sessionId))
          .map((p) => p.profile);

        if (memberProfiles.length === 0) {
          return c;
        }

        return {
          centroid: this.averageProfile(memberProfiles),
          members: c.members,
        };
      });

      // Check convergence
      const changed = clusters.some(
        (c, i) => c.members.length !== initial[i]?.members.length
      );

      if (!changed) break;
      initial = clusters;
    }

    // Convert to Cluster objects
    return clusters
      .filter((c) => c.members.length >= this.minClusterSize)
      .map((c, i) => {
        const sessionData = sessions.filter((s) => c.members.includes(s.sessionId));
        const solved = sessionData.filter((s) => s.solved).length;

        return {
          id: `cluster_${i}`,
          name: `cluster_${i}`,
          description: "",
          sessions: c.members,
          centroid: c.centroid,
          characteristics: [],
          avgSolveTime: 0,
          solveRate: sessionData.length > 0 ? solved / sessionData.length : 0,
          commonCommands: [],
          commonErrors: [],
        };
      });
  }

  private analyzeCluster(cluster: Cluster, sessions: SessionTelemetry[]): Cluster {
    const sessionData = sessions.filter((s) => cluster.sessions.includes(s.sessionId));

    // Characteristics
    const characteristics: string[] = [];

    if (cluster.centroid.exploratoryRatio > 0.4) characteristics.push("high_exploratory");
    if (cluster.centroid.targetedRatio > 0.4) characteristics.push("high_targeted");
    if (cluster.centroid.destructiveRatio > 0.2) characteristics.push("high_destructive");
    if (cluster.centroid.hintDependency > 0.3) characteristics.push("high_hints");
    if (cluster.centroid.errorRate > 0.3) characteristics.push("high_errors");
    if (cluster.centroid.avgSessionDuration < 120000) characteristics.push("fast_solve");
    if (cluster.centroid.logInspectionFrequency > 0.3) characteristics.push("log_heavy");
    if (cluster.centroid.serviceRestartFrequency > 0.3) characteristics.push("service_restart_heavy");

    // Common commands
    const cmdCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    for (const session of sessionData) {
      for (const cmd of session.commands) {
        cmdCounts[cmd.cmd] = (cmdCounts[cmd.cmd] || 0) + 1;
        if (cmd.exitCode !== 0) {
          errorCounts[cmd.cmd] = (errorCounts[cmd.cmd] || 0) + 1;
        }
      }
    }

    const commonCommands = Object.entries(cmdCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ cmd, frequency: count }));

    const commonErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, frequency: count }));

    const avgSolveTime =
      sessionData.length > 0
        ? sessionData.reduce(
            (sum, s) => sum + (s.completedAt ? s.completedAt - s.startedAt : 0),
            0
          ) / sessionData.length
        : 0;

    return {
      ...cluster,
      name: this.nameCluster(characteristics),
      description: `Cluster: ${characteristics.join(", ")}`,
      characteristics,
      avgSolveTime,
      commonCommands,
      commonErrors,
    };
  }

  private createCluster(session: SessionTelemetry, profile: BehavioralProfile): void {
    const cluster: Cluster = {
      id: `cluster_${this.clusters.size}`,
      name: this.nameCluster([]),
      description: "",
      sessions: [session.sessionId],
      centroid: profile,
      characteristics: [],
      avgSolveTime: 0,
      solveRate: session.solved ? 1 : 0,
      commonCommands: [],
      commonErrors: [],
    };

    this.clusters.set(cluster.id, cluster);
  }

  private updateCentroid(
    current: BehavioralProfile,
    newProfile: BehavioralProfile,
    count: number
  ): BehavioralProfile {
    const weight = 1 / count;
    const result: any = {};

    for (const key of Object.keys(current) as (keyof BehavioralProfile)[]) {
      result[key] = current[key] * (1 - weight) + newProfile[key] * weight;
    }

    return result as BehavioralProfile;
  }

  private averageProfile(profiles: BehavioralProfile[]): BehavioralProfile {
    const result: any = {};

    for (const key of Object.keys(profiles[0]) as (keyof BehavioralProfile)[]) {
      result[key] = profiles.reduce((sum, p) => sum + p[key], 0) / profiles.length;
    }

    return result as BehavioralProfile;
  }

  private profileDistance(a: BehavioralProfile, b: BehavioralProfile): number {
    let sum = 0;
    let count = 0;

    for (const key of Object.keys(a) as (keyof BehavioralProfile)[]) {
      const diff = a[key] - b[key];
      // Normalize by max value
      const maxVal = Math.max(Math.abs(a[key]), Math.abs(b[key]), 1);
      sum += (diff / maxVal) ** 2;
      count++;
    }

    return Math.sqrt(sum / count);
  }

  private calculateSilhouetteScore(
    clusters: Cluster[],
    profiles: Array<{ sessionId: string; profile: BehavioralProfile }>
  ): number {
    if (clusters.length < 2) return 1;

    const silhouetteValues: number[] = [];

    for (const p of profiles) {
      const cluster = clusters.find((c) => c.sessions.includes(p.sessionId));
      if (!cluster) continue;

      // a(i) = avg distance to same cluster
      const sameCluster = profiles.filter((x) =>
        cluster.sessions.includes(x.sessionId)
      );
      const a =
        sameCluster.length > 1
          ? sameCluster
              .filter((x) => x.sessionId !== p.sessionId)
              .reduce((sum, x) => sum + this.profileDistance(p.profile, x.profile), 0) /
            (sameCluster.length - 1)
          : 0;

      // b(i) = min avg distance to other clusters
      let b = Infinity;
      for (const other of clusters) {
        if (other.id === cluster.id) continue;
        const otherProfiles = profiles.filter((x) => other.sessions.includes(x.sessionId));
        if (otherProfiles.length === 0) continue;

        const avgDist =
          otherProfiles.reduce(
            (sum, x) => sum + this.profileDistance(p.profile, x.profile),
            0
          ) / otherProfiles.length;

        b = Math.min(b, avgDist);
      }

      const s = b === 0 ? 0 : (b - a) / Math.max(a, b);
      silhouetteValues.push(s);
    }

    return silhouetteValues.length > 0
      ? silhouetteValues.reduce((sum, s) => sum + s, 0) / silhouetteValues.length
      : 0;
  }
}
