import { describe, it, expect, beforeEach } from 'vitest';
import { graph, seedDefaultTopology, STATUS } from '../src/core/dependencyGraph.js';
import { triggerFailure, computeImpactScore, recoverService } from '../src/core/impactEngine.js';
import { recommendRemediation, analyzeRootCause, REMEDIATION_ACTIONS } from '../src/core/remediationAdvisor.js';
import { selfHealingEngine } from '../src/core/selfHealingEngine.js';
import { timelineStore, logIncident, SEVERITY } from '../src/core/timelineStore.js';

describe('dependency graph + cascading failures', () => {
  beforeEach(() => {
    graph.reset(STATUS.UP);
    timelineStore.clear();
  });

  it('initializes with all services UP', () => {
    seedDefaultTopology();
    const nodes = graph.list();
    expect(nodes.every(n => n.status === STATUS.UP)).toBe(true);
  });

  it('propagates DB failure to dependents', () => {
    seedDefaultTopology();
    triggerFailure('DB');

    expect(graph.getNode('DB')?.status).toBe(STATUS.DOWN);
    // Auth depends on DB only → DEGRADED
    expect(graph.getNode('Auth')?.status).toBe(STATUS.DEGRADED);
    // API depends on DB + Auth: hit by DB cascade (→ DEGRADED), then Auth cascade (DEGRADED→DOWN)
    expect(graph.getNode('API')?.status).toBe(STATUS.DOWN);
    // Frontend depends on API → DEGRADED (hit once)
    expect(graph.getNode('Frontend')?.status).toBe(STATUS.DEGRADED);
  });

  it('computes impact score > 0 after failure', () => {
    seedDefaultTopology();
    triggerFailure('DB');
    const score = computeImpactScore();
    expect(score).toBeGreaterThan(0);
  });

  it('recovers a service successfully', () => {
    seedDefaultTopology();
    triggerFailure('DB');
    expect(graph.getNode('DB')?.status).toBe(STATUS.DOWN);

    recoverService('DB');
    expect(graph.getNode('DB')?.status).toBe(STATUS.UP);
  });

  it('detects cascade from API failure', () => {
    seedDefaultTopology();
    triggerFailure('API');

    expect(graph.getNode('API')?.status).toBe(STATUS.DOWN);
    expect(graph.getNode('Frontend')?.status).toBe(STATUS.DEGRADED);
  });
});

describe('remediation advisor', () => {
  beforeEach(() => {
    graph.reset(STATUS.UP);
    timelineStore.clear();
  });

  it('proposes FAILOVER for DB failure', () => {
    seedDefaultTopology();
    triggerFailure('DB');

    const actions = recommendRemediation();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.action === REMEDIATION_ACTIONS.FAILOVER)).toBe(true);
  });

  it('proposes RESTART for non-DB DOWN service', () => {
    seedDefaultTopology();
    triggerFailure('API');

    const actions = recommendRemediation();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.action === REMEDIATION_ACTIONS.RESTART)).toBe(true);
  });

  it('proposes FAILOVER for services impacted by DB failure', () => {
    seedDefaultTopology();
    triggerFailure('DB');

    const actions = recommendRemediation();
    // API is degraded but its root cause is DB → still recommends FAILOVER
    const apiAction = actions.find(a => a.serviceId === 'API');
    expect(apiAction?.action).toBe(REMEDIATION_ACTIONS.FAILOVER);
  });
});

describe('root cause analyzer', () => {
  beforeEach(() => {
    timelineStore.clear();
  });

  it('returns "no critical incidents" when clean', () => {
    const result = analyzeRootCause();
    expect(result).toContain('No critical incidents');
  });

  it('detects DB-related root cause', () => {
    logIncident('INFRA', 'DB is DOWN', SEVERITY.CRITICAL, { serviceId: 'DB' });
    const result = analyzeRootCause();
    expect(result.toLowerCase()).toContain('database');
  });
});

describe('self-healing engine', () => {
  beforeEach(() => {
    graph.reset(STATUS.UP);
    timelineStore.clear();
    selfHealingEngine.stop();
  });

  it('starts and stops without error', () => {
    seedDefaultTopology();
    expect(selfHealingEngine.isRunning()).toBe(false);

    selfHealingEngine.start(500);
    expect(selfHealingEngine.isRunning()).toBe(true);

    selfHealingEngine.stop();
    expect(selfHealingEngine.isRunning()).toBe(false);
  });

  it('automatically recovers services', async () => {
    seedDefaultTopology();
    triggerFailure('DB');
    expect(graph.getNode('DB')?.status).toBe(STATUS.DOWN);

    selfHealingEngine.start(200);

    // Wait for healing cycle
    await new Promise(resolve => setTimeout(resolve, 2000));

    selfHealingEngine.stop();
    expect(graph.getNode('DB')?.status).toBe(STATUS.UP);
  });
});
