/**
 * Dependency Graph — Service topology with relationships
 * Models infrastructure as a directed graph of dependencies
 */

export const STATUS = {
  UP: "UP",
  DEGRADED: "DEGRADED",
  DOWN: "DOWN",
  RECOVERING: "RECOVERING",
};

class DependencyGraph {
  constructor() {
    this.nodes = new Map();
  }

  addNode(node) {
    this.nodes.set(node.id, {
      id: node.id,
      status: node.status || STATUS.UP,
      dependsOn: node.dependsOn || [],
      tier: node.tier || "application",
      criticality: node.criticality || 2,
    });
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  updateStatus(id, status) {
    const node = this.nodes.get(id);
    if (!node) return false;
    node.status = status;
    return true;
  }

  getDependents(id) {
    return [...this.nodes.values()].filter((n) => n.dependsOn.includes(id));
  }

  getDependencies(id) {
    const node = this.nodes.get(id);
    return node ? node.dependsOn.map((depId) => this.nodes.get(depId)).filter(Boolean) : [];
  }

  list() {
    return [...this.nodes.values()];
  }

  reset(status = STATUS.UP) {
    for (const node of this.nodes.values()) {
      node.status = status;
    }
  }

  findByStatus(status) {
    return [...this.nodes.values()].filter((n) => n.status === status);
  }

  hasCycles() {
    const visited = new Set();
    const recStack = new Set();

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) return false;

      for (const depId of node.dependsOn) {
        if (!visited.has(depId) && dfs(depId)) return true;
        if (recStack.has(depId)) return true;
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId) && dfs(nodeId)) return true;
    }
    return false;
  }
}

export const graph = new DependencyGraph();

/**
 * Seed with default cloud-like topology:
 *   Frontend → API → DB
 *           → Auth ↗
 */
export function seedDefaultTopology() {
  graph.addNode({
    id: "DB",
    status: STATUS.UP,
    dependsOn: [],
    tier: "data",
    criticality: 1,
  });
  graph.addNode({
    id: "Auth",
    status: STATUS.UP,
    dependsOn: ["DB"],
    tier: "application",
    criticality: 1,
  });
  graph.addNode({
    id: "API",
    status: STATUS.UP,
    dependsOn: ["DB", "Auth"],
    tier: "application",
    criticality: 1,
  });
  graph.addNode({
    id: "Frontend",
    status: STATUS.UP,
    dependsOn: ["API"],
    tier: "frontend",
    criticality: 2,
  });
  graph.addNode({
    id: "Cache",
    status: STATUS.UP,
    dependsOn: [],
    tier: "data",
    criticality: 3,
  });
  graph.addNode({
    id: "CDN",
    status: STATUS.UP,
    dependsOn: ["Frontend"],
    tier: "network",
    criticality: 3,
  });
}

export default graph;
