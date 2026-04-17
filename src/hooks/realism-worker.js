// realism-worker.js — Background worker for chaos + audit loop
// Runs in a Web Worker or as a setInterval-based background task

import {
  ChaosEngine,
  createRealityAuditor,
  validateInvariants,
  ALL_INCIDENTS,
  IncidentOrchestrator,
} from "../../realism";

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

  // Start background loop
  start(env) {
    if (this.running) return;
    this.running = true;

    this.intervalId = setInterval(() => {
      if (!env || !this.running) return;

      // 1. Run chaos
      const chaosEvents = this.chaosEngine.runChaos(env);
      if (chaosEvents.length > 0 && this.onChaosEvent) {
        chaosEvents.forEach((e) => this.onChaosEvent(e));
      }

      // 2. Check invariants
      const violations = validateInvariants(env);

      // 3. Run audit
      const auditResult = this.auditor.audit(env);
      this.onAudit(auditResult);

      // 4. Check for anomalies
      if (auditResult.drift.realityGap > 0.25) {
        this.onAnomaly({
          type: "reality_drift",
          gap: auditResult.drift.realityGap,
          timestamp: Date.now(),
        });
      }

      // 5. Check for red flags
      if (auditResult.drift.predictability > 0.9) {
        this.onAnomaly({
          type: "too_deterministic",
          predictability: auditResult.drift.predictability,
          timestamp: Date.now(),
        });
      }

      if (auditResult.drift.failureRate < 0.05) {
        this.onAnomaly({
          type: "no_failures",
          failureRate: auditResult.drift.failureRate,
          timestamp: Date.now(),
        });
      }
    }, this.chaosEngine.getConfig().intervalMs || 10000);
  }

  // Stop background loop
  stop() {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Run a single audit cycle
  auditOnce(env) {
    const violations = validateInvariants(env);
    const auditResult = this.auditor.audit(env);
    return { violations, ...auditResult };
  }

  // Run senior simulation
  async runSeniorSimulation(env) {
    const { SeniorSimulator, createSeniorSimulator } = await import(
      "../../realism/senior-simulator"
    );
    const simulator = createSeniorSimulator();
    return simulator.simulate(env);
  }

  // Cleanup
  destroy() {
    this.stop();
  }
}

// Singleton instance for the app
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
