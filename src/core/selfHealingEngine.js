/**
 * Self-Healing Engine — Automatic remediation for simulated infrastructure
 * Monitors service state and executes remediation actions automatically
 */

import { eventBus } from "./eventBus.js";
import { graph, STATUS } from "./dependencyGraph.js";
import { logIncident, SEVERITY } from "./timelineStore.js";
import { recommendRemediation, REMEDIATION_ACTIONS } from "./remediationAdvisor.js";

class SelfHealingEngine {
  constructor() {
    this.timer = null;
    this.running = false;
  }

  /**
   * Start automatic remediation loop
   * @param {number} intervalMs - Check interval in milliseconds
   */
  start(intervalMs = 1500) {
    if (this.running) return;
    this.running = true;

    this.timer = setInterval(() => {
      const actions = recommendRemediation();

      for (const action of actions) {
        const target = graph.getNode(action.serviceId);
        if (!target) continue;

        // Only auto-remediate DOWN/DEGRADED services
        if (target.status !== STATUS.DOWN && target.status !== STATUS.DEGRADED) {
          continue;
        }

        // Execute remediation
        if (
          action.action === REMEDIATION_ACTIONS.FAILOVER ||
          action.action === REMEDIATION_ACTIONS.RESTART
        ) {
          this._executeRemediation(target.id, action);
        }
      }
    }, intervalMs);

    logIncident("REMEDIATION", "Self-healing engine started", SEVERITY.INFO);
    eventBus.emit("SELF_HEALING_STARTED");
  }

  /**
   * Stop automatic remediation
   */
  stop() {
    if (!this.running) return;

    clearInterval(this.timer);
    this.timer = null;
    this.running = false;

    logIncident("REMEDIATION", "Self-healing engine stopped", SEVERITY.INFO);
    eventBus.emit("SELF_HEALING_STOPPED");
  }

  /**
   * Execute a single remediation action
   * @param {string} serviceId
   * @param {{action: string, reason: string, confidence: number}} action
   */
  _executeRemediation(serviceId, action) {
    // Mark as recovering
    graph.updateStatus(serviceId, STATUS.RECOVERING);

    eventBus.emit("REMEDIATION_STARTED", {
      serviceId,
      action: action.action,
      confidence: action.confidence,
      reason: action.reason,
    });

    logIncident("REMEDIATION", `${action.action} started on ${serviceId}`, SEVERITY.WARN, {
      serviceId,
      action: action.action,
      confidence: action.confidence,
    });

    // Simulate recovery delay
    setTimeout(() => {
      graph.updateStatus(serviceId, STATUS.UP);

      eventBus.emit("REMEDIATION_SUCCESS", {
        serviceId,
        action: action.action,
      });

      logIncident("REMEDIATION", `${serviceId} recovered via ${action.action}`, SEVERITY.INFO, {
        serviceId,
        action: action.action,
      });
    }, 1200);
  }

  /**
   * Manual remediation of a specific service
   * @param {string} serviceId
   */
  remediate(serviceId) {
    const node = graph.getNode(serviceId);
    if (!node) return;

    this._executeRemediation(serviceId, {
      action: node.status === STATUS.DOWN ? REMEDIATION_ACTIONS.RESTART : REMEDIATION_ACTIONS.FAILOVER,
      reason: "Manual remediation",
      confidence: 1.0,
    });
  }

  isRunning() {
    return this.running;
  }
}

export const selfHealingEngine = new SelfHealingEngine();

// Expose globally for demo/test hooks
if (typeof window !== "undefined") {
  window.startSelfHealing = () => selfHealingEngine.start();
  window.stopSelfHealing = () => selfHealingEngine.stop();
  window.remediate = (serviceId) => selfHealingEngine.remediate(serviceId);
  window.__SELF_HEALING_ENGINE__ = selfHealingEngine;
}

export default selfHealingEngine;
