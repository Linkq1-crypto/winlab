// realism-worker.js - Background worker for chaos + audit loop
// Runs in a Web Worker or as a setInterval-based background task

import { ChaosEngine } from "../../realism/chaos-engine";
import { validateInvariants } from "../../realism/invariants";
import { IncidentOrchestrator } from "../../realism/incident-orchestrator";
import { createRealityAuditor } from "../../realism/reality-audit";

export class RealismWorker {
  constructor(options = {}) {
    this.chaosEngine = new ChaosEngine({
      intensity: options.chaosIntensity || 0.2,
      intervalMs: options.chaosIntervalMs || 10000,
      correlated: true,
      userSkill: options.userSkill || "mid",
    });

    this.auditor = createRealityAuditor();
    this.orchestrator = new IncidentOrchestrator();
    this.running = false;
    this.intervalId = null;
    this.onAudit = options.onAudit || (() => {});
    this.onAnomaly = options.onAnomaly || (() => {});
    this.onChaosEvent = options.onChaosEvent || (() => {});
  }

  start(env) {
    if (this.running) return;
    this.running = true;

    this.intervalId = setInterval(() => {
      if (!env || !this.running) return;

      const chaosEvents = this.chaosEngine.runChaos(env);
      if (chaosEvents.length > 0 && this.onChaosEvent) {
        chaosEvents.forEach((event) => this.onChaosEvent(event));
      }

      const violations = validateInvariants(env);
      const auditResult = this.auditor.audit(env);
      this.onAudit(auditResult);

      if (auditResult.drift.realityGap > 0.25) {
        this.onAnomaly({
          type: "reality_drift",
          gap: auditResult.drift.realityGap,
          violations,
          timestamp: Date.now(),
        });
      }

      if (auditResult.drift.predictability > 0.9) {
        this.onAnomaly({
          type: "too_deterministic",
          predictability: auditResult.drift.predictability,
          violations,
          timestamp: Date.now(),
        });
      }

      if (auditResult.drift.failureRate < 0.05) {
        this.onAnomaly({
          type: "no_failures",
          failureRate: auditResult.drift.failureRate,
          violations,
          timestamp: Date.now(),
        });
      }
    }, this.chaosEngine.getConfig().intervalMs || 10000);
  }

  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  auditOnce(env) {
    const violations = validateInvariants(env);
    const auditResult = this.auditor.audit(env);
    return { violations, ...auditResult };
  }

  async runSeniorSimulation(env) {
    const { createSeniorSimulator } = await import("../../realism/senior-simulator");
    const simulator = createSeniorSimulator();
    return simulator.simulate(env);
  }

  destroy() {
    this.stop();
  }
}

let workerInstance = null;

export function getRealismWorker(options) {
  if (!workerInstance) {
    workerInstance = new RealismWorker(options);
  }
  return workerInstance;
}

export function destroyRealismWorker() {
  if (workerInstance) {
    workerInstance.destroy();
    workerInstance = null;
  }
}
