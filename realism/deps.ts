// realism/deps.ts — Dependency graph for cascade failures

import type { Env, ServiceState } from "./state";

export interface DependencyNode {
  name: string;
  deps: string[];
}

export class DependencyGraph {
  private graph: Record<string, DependencyNode>;

  constructor(nodes: DependencyNode[]) {
    this.graph = {};
    for (const node of nodes) {
      this.graph[node.name] = node;
    }
  }

  /**
   * Propagate a service failure through the dependency graph.
   * All services depending on the failed service become degraded/failed.
   */
  propagateFailure(env: Env, root: string): void {
    if (!env.services[root]) return;

    const visited = new Set<string>();
    const failedServices: string[] = [];

    const dfs = (svc: string) => {
      if (visited.has(svc)) return;
      visited.add(svc);

      // Find all services that depend on this one
      for (const [name, service] of Object.entries(env.services)) {
        if (service.deps.includes(svc)) {
          if (env.services[name].status !== "failed") {
            env.services[name].status = "degraded";
            failedServices.push(name);
          }
          dfs(name);
        }
      }
    };

    env.services[root].status = "failed";
    dfs(root);
  }

  /**
   * Check if a service can start (all dependencies met).
   */
  canStart(env: Env, svc: string): boolean {
    const service = env.services[svc];
    if (!service) return false;

    for (const dep of service.deps) {
      const depService = env.services[dep];
      if (!depService || depService.status !== "running") {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all dependencies (recursive) of a service.
   */
  getAllDependencies(svc: string, visited = new Set<string>()): string[] {
    if (visited.has(svc)) return [];
    visited.add(svc);

    const node = this.graph[svc];
    if (!node) return [];

    const allDeps = [...node.deps];

    for (const dep of node.deps) {
      allDeps.push(...this.getAllDependencies(dep, visited));
    }

    return [...new Set(allDeps)];
  }

  /**
   * Restart cascade: restart a service and all that depend on it.
   */
  restartCascade(env: Env, svc: string): string[] {
    const toRestart: string[] = [];
    const visited = new Set<string>();

    const findDependents = (service: string) => {
      if (visited.has(service)) return;
      visited.add(service);

      for (const [name, s] of Object.entries(env.services)) {
        if (s.deps.includes(service)) {
          findDependents(name);
          toRestart.push(name);
        }
      }
    };

    findDependents(svc);
    return toRestart;
  }

  /**
   * Add a service to the graph.
   */
  addService(name: string, deps: string[] = []): void {
    this.graph[name] = { name, deps };
  }

  /**
   * Get the graph as a readable structure.
   */
  getGraph(): Record<string, DependencyNode> {
    return { ...this.graph };
  }
}

/**
 * Default dependency graph for common services.
 */
export function createDefaultDependencyGraph(): DependencyGraph {
  return new DependencyGraph([
    { name: "network", deps: [] },
    { name: "storage", deps: [] },
    { name: "dns", deps: ["network"] },
    { name: "sshd", deps: ["network"] },
    { name: "httpd", deps: ["network", "storage"] },
    { name: "nginx", deps: ["network", "dns"] },
    { name: "mysqld", deps: ["storage", "network"] },
    { name: "crond", deps: [] },
    { name: "chronyd", deps: ["network"] },
    { name: "firewalld", deps: ["network"] },
    { name: "rsyslog", deps: ["storage"] },
    { name: "fail2ban", deps: ["network", "sshd"] },
  ]);
}
