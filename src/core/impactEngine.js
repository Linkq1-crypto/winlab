/**
 * Impact Engine — Cascading failure propagation and impact scoring
 * When a service fails, propagate degradation to all dependents
 */

import { eventBus } from "./eventBus.js";
import { graph, STATUS } from "./dependencyGraph.js";
import { logIncident, SEVERITY } from "./timelineStore.js";

/**
 * Trigger a failure on a specific service and cascade to dependents
 */
export function triggerFailure(serviceId, metadata = {}) {
  const node = graph.getNode(serviceId);
  if (!node) {
    console.warn(`[ImpactEngine] Service "${serviceId}" not found in topology`);
    return null;
  }

  graph.updateStatus(serviceId, STATUS.DOWN);

  logIncident("INFRA", `${serviceId} is DOWN`, SEVERITY.CRITICAL, {
    serviceId,
    ...metadata,
  });

  eventBus.emit("SERVICE_DOWN", { serviceId, ...metadata });

  // Cascade to dependents
  cascade(serviceId, new Set());

  return node;
}

/**
 * Recursively propagate failure to dependent services
 */
function cascade(failedId, visited) {
  if (visited.has(failedId)) return;
  visited.add(failedId);

  const dependents = graph.getDependents(failedId);

  for (const dependent of dependents) {
    if (dependent.status === STATUS.DOWN) continue;

    const newStatus = dependent.status === STATUS.DEGRADED ? STATUS.DOWN : STATUS.DEGRADED;
    graph.updateStatus(dependent.id, newStatus);

    logIncident("INFRA", `${dependent.id} ${newStatus} due to ${failedId}`, SEVERITY.WARN, {
      serviceId: dependent.id,
      cause: failedId,
      newStatus,
    });

    eventBus.emit("SERVICE_DEGRADED", {
      serviceId: dependent.id,
      cause: failedId,
      status: newStatus,
    });

    // Continue cascading
    cascade(dependent.id, visited);
  }
}

/**
 * Compute impact score: 0 (healthy) → 100 (total outage)
 */
export function computeImpactScore() {
  const nodes = graph.list();
  if (nodes.length === 0) return 0;

  const totalWeight = nodes.reduce((sum, n) => sum + n.criticality, 0);
  const downWeight = nodes
    .filter((n) => n.status === STATUS.DOWN)
    .reduce((sum, n) => sum + n.criticality * 3, 0);
  const degradedWeight = nodes
    .filter((n) => n.status === STATUS.DEGRADED)
    .reduce((sum, n) => sum + n.criticality, 0);
  const recoveringWeight = nodes
    .filter((n) => n.status === STATUS.RECOVERING)
    .reduce((sum, n) => sum + n.criticality * 0.5, 0);

  const score = ((downWeight + degradedWeight + recoveringWeight) / (totalWeight * 3)) * 100;
  return Math.min(Math.round(score), 100);
}

/**
 * Recover a specific service
 */
export function recoverService(serviceId) {
  const node = graph.getNode(serviceId);
  if (!node) return false;

  graph.updateStatus(serviceId, STATUS.UP);

  logIncident("INFRA", `${serviceId} recovered`, SEVERITY.INFO, { serviceId });
  eventBus.emit("SERVICE_UP", { serviceId });

  return true;
}

/**
 * Check if a service is impacted by another's failure
 */
export function isImpactedBy(serviceId, causeId) {
  const node = graph.getNode(serviceId);
  if (!node) return false;
  if (node.dependsOn.includes(causeId)) return true;

  // Check transitive dependencies
  return node.dependsOn.some((depId) => isImpactedBy(depId, causeId));
}

export default {
  triggerFailure,
  recoverService,
  computeImpactScore,
  isImpactedBy,
};
