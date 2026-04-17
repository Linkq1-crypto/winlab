/**
 * Remediation Advisor — Rule-based AI-style remediation engine
 * Analyzes incidents and service state to propose remediation actions
 */

import { graph, STATUS } from "./dependencyGraph.js";
import { timelineStore, SEVERITY } from "./timelineStore.js";

export const REMEDIATION_ACTIONS = {
  FAILOVER: "FAILOVER",
  RESTART: "RESTART",
  SCALE_UP: "SCALE_UP",
  CLEAR_CACHE: "CLEAR_CACHE",
  INVESTIGATE: "INVESTIGATE",
};

/**
 * Analyze current state and recommend remediation actions
 * @returns {Array<{serviceId: string, action: string, reason: string, confidence: number}>}
 */
export function recommendRemediation() {
  const incidents = timelineStore.all();
  const nodes = graph.list();

  return nodes
    .filter((n) => n.status === STATUS.DOWN || n.status === STATUS.DEGRADED)
    .map((node) => {
      const related = incidents.filter(
        (i) =>
          i.metadata?.serviceId === node.id || i.metadata?.cause === node.id
      );

      const hasLatency = related.some((r) =>
        r.message.toLowerCase().includes("latency")
      );
      const hasDbSignal =
        node.id === "DB" ||
        related.some((r) => String(r.metadata?.cause) === "DB");

      // Data layer failure → failover
      if (hasDbSignal) {
        return {
          serviceId: node.id,
          action: REMEDIATION_ACTIONS.FAILOVER,
          reason: "Dipendenza da data layer in stato critico",
          confidence: 0.88,
        };
      }

      // Latency spike → scale up
      if (hasLatency) {
        return {
          serviceId: node.id,
          action: REMEDIATION_ACTIONS.SCALE_UP,
          reason: "Segnali di saturazione/latency spike",
          confidence: 0.74,
        };
      }

      // Default: restart if DOWN, investigate if degraded
      return {
        serviceId: node.id,
        action: node.status === STATUS.DOWN
          ? REMEDIATION_ACTIONS.RESTART
          : REMEDIATION_ACTIONS.INVESTIGATE,
        reason:
          node.status === STATUS.DOWN
            ? "Servizio non raggiungibile"
            : "Degradazione propagata",
        confidence: node.status === STATUS.DOWN ? 0.8 : 0.6,
      };
    });
}

/**
 * Build a root cause analysis from the latest critical incident
 * @returns {string}
 */
export function analyzeRootCause() {
  const events = timelineStore.all();
  const lastCritical = events.find((e) => e.severity === SEVERITY.CRITICAL);

  if (!lastCritical) return "No critical incidents detected";

  const index = events.indexOf(lastCritical);
  const context = events.slice(index, index + 5);

  // Simple heuristic chain detection
  if (context.some((e) => e.message.toLowerCase().includes("latency"))) {
    return `Root cause: latency spike → system degradation\nIncident: ${lastCritical.type} (${lastCritical.message})\nChain: ${context.map((e) => e.type).join(" → ")}`;
  }

  if (context.some((e) => e.type === "API_FAILURE" || e.message.includes("API"))) {
    return `Root cause: backend/API failure\nIncident: ${lastCritical.type} (${lastCritical.message})\nChain: ${context.map((e) => e.type).join(" → ")}`;
  }

  if (context.some((e) => e.type === "VLAN_DOWN" || e.message.includes("VLAN"))) {
    return `Root cause: network failure\nIncident: ${lastCritical.type} (${lastCritical.message})\nChain: ${context.map((e) => e.type).join(" → ")}`;
  }

  if (context.some((e) => e.message.toLowerCase().includes("db"))) {
    return `Root cause: database failure\nIncident: ${lastCritical.type} (${lastCritical.message})\nChain: ${context.map((e) => e.type).join(" → ")}`;
  }

  return `Root cause: unknown\nIncident: ${lastCritical.type} (${lastCritical.message})\nChain: ${context.map((e) => e.type).join(" → ")}`;
}

export default { recommendRemediation, analyzeRootCause, REMEDIATION_ACTIONS };
