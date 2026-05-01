const DEADLOCK_SCENARIOS = {
  default: {
    id: 'postgresql-deadlock',
    title: 'PostgreSQL Deadlock',
    summary: 'Two services hold incompatible row locks while waiting on the same billing write path.',
    dependencyGraph: [
      { from: 'service-a', to: 'postgres-primary', relation: 'txn 48217 waiting on RowExclusiveLock' },
      { from: 'service-b', to: 'postgres-primary', relation: 'txn 48231 waiting on RowExclusiveLock' },
      { from: 'postgres-primary', to: 'billing_events', relation: 'row lock conflict on account_id=8841' },
    ],
    blockedServices: [
      { name: 'service-a / billing-reconcile', transactionId: '48217', waitingFor: 'txn 48231', lock: 'RowExclusiveLock' },
      { name: 'service-b / payout-close', transactionId: '48231', waitingFor: 'txn 48217', lock: 'RowExclusiveLock' },
    ],
    blockedChain: [
      'service-a txn 48217 -> postgres-primary -> waiting on txn 48231',
      'service-b txn 48231 -> postgres-primary -> waiting on txn 48217',
    ],
    rootCause: 'Circular lock ordering on billing_events inside concurrent settlement transactions.',
    suggestedAction: 'Terminate txn 48231, replay service-b, and enforce a single lock acquisition order in settlement writes.',
    lockInfo: [
      'tx 48217 holds RowExclusiveLock on billing_events account_id=8841',
      'tx 48231 holds RowExclusiveLock on billing_events account_id=8841',
    ],
  },
  'deadlock-postgresql': {
    id: 'postgresql-deadlock',
    title: 'PostgreSQL Deadlock',
    summary: 'Two services hold incompatible row locks while waiting on the same billing write path.',
    dependencyGraph: [
      { from: 'service-a', to: 'postgres-primary', relation: 'txn 48217 waiting on RowExclusiveLock' },
      { from: 'service-b', to: 'postgres-primary', relation: 'txn 48231 waiting on RowExclusiveLock' },
      { from: 'postgres-primary', to: 'billing_events', relation: 'row lock conflict on account_id=8841' },
    ],
    blockedServices: [
      { name: 'service-a / billing-reconcile', transactionId: '48217', waitingFor: 'txn 48231', lock: 'RowExclusiveLock' },
      { name: 'service-b / payout-close', transactionId: '48231', waitingFor: 'txn 48217', lock: 'RowExclusiveLock' },
    ],
    blockedChain: [
      'service-a txn 48217 -> postgres-primary -> waiting on txn 48231',
      'service-b txn 48231 -> postgres-primary -> waiting on txn 48217',
    ],
    rootCause: 'Circular lock ordering on billing_events inside concurrent settlement transactions.',
    suggestedAction: 'Terminate txn 48231, replay service-b, and enforce a single lock acquisition order in settlement writes.',
    lockInfo: [
      'tx 48217 holds RowExclusiveLock on billing_events account_id=8841',
      'tx 48231 holds RowExclusiveLock on billing_events account_id=8841',
    ],
  },
  'deadlock-k8s-loop': {
    id: 'kubernetes-dependency-loop',
    title: 'Kubernetes Dependency Loop',
    summary: 'Readiness gates form a circular wait between API, worker, and init-controller deployments.',
    dependencyGraph: [
      { from: 'api-deployment', to: 'worker-deployment', relation: 'waiting on queue drain readiness' },
      { from: 'worker-deployment', to: 'config-controller', relation: 'waiting on rollout token' },
      { from: 'config-controller', to: 'api-deployment', relation: 'waiting on admission callback' },
    ],
    blockedServices: [
      { name: 'api-deployment / revision 18', transactionId: 'rollout-18', waitingFor: 'worker-deployment', lock: 'ReadinessGate' },
      { name: 'worker-deployment / revision 41', transactionId: 'rollout-41', waitingFor: 'config-controller', lock: 'LeaseLock' },
    ],
    blockedChain: [
      'api-deployment rollout-18 -> worker-deployment -> config-controller',
      'config-controller -> api-deployment admission callback -> readiness loop',
    ],
    rootCause: 'Circular rollout dependency between readiness gates and controller lease ownership.',
    suggestedAction: 'Break the loop by releasing the config-controller lease and redeploy with isolated readiness dependencies.',
    lockInfo: [
      'LeaseLock config-controller held by pod config-controller-7df8',
      'ReadinessGate api-deployment blocked on queue-ready condition',
    ],
  },
  'deadlock-queue-starvation': {
    id: 'queue-worker-starvation',
    title: 'Queue Worker Starvation',
    summary: 'Long-running jobs exhaust the worker pool and starve the unlock path for dependent consumers.',
    dependencyGraph: [
      { from: 'ingest-api', to: 'jobs-queue', relation: 'waiting on worker slot' },
      { from: 'jobs-queue', to: 'reconcile-worker', relation: 'backlog > concurrency' },
      { from: 'reconcile-worker', to: 'unlock-handler', relation: 'unlock event never scheduled' },
    ],
    blockedServices: [
      { name: 'jobs-queue / tenant-ingest', transactionId: 'job-91244', waitingFor: 'reconcile-worker', lock: 'WorkerSlot' },
    ],
    blockedChain: [
      'ingest-api -> jobs-queue backlog -> reconcile-worker saturation',
      'unlock-handler deferred because no worker slot is free',
    ],
    rootCause: 'Worker starvation prevents unlock events from clearing the dependent queue chain.',
    suggestedAction: 'Drain long-running jobs, reserve a worker lane for unlock events, and rebalance queue concurrency.',
    lockInfo: [
      'WorkerSlot pool saturated at 16/16 consumers',
      'unlock-handler queued behind 1,204 reconcile jobs',
    ],
  },
  'deadlock-redis-contention': {
    id: 'redis-lock-contention',
    title: 'Redis Lock Contention',
    summary: 'A stale distributed lock blocks order processing while downstream services keep retrying.',
    dependencyGraph: [
      { from: 'order-api', to: 'redis-lock', relation: 'waiting on tenant-eu-west-1 lock' },
      { from: 'worker-sync', to: 'redis-lock', relation: 'retry storm on same lock key' },
      { from: 'redis-lock', to: 'postgres-primary', relation: 'write path frozen until lease clears' },
    ],
    blockedServices: [
      { name: 'order-api / finalize-order', transactionId: 'lock-tenant-eu-west-1', waitingFor: 'worker-sync', lock: 'RedisMutex' },
    ],
    blockedChain: [
      'order-api -> redis-lock tenant-eu-west-1 -> worker-sync retry storm',
      'postgres-primary write path remains idle until lock lease expires',
    ],
    rootCause: 'A stale Redis mutex remains held while retries amplify contention on the same tenant key.',
    suggestedAction: 'Evict the stale mutex, pause retries, and reintroduce jitter before resuming writes.',
    lockInfo: [
      'RedisMutex tenant-eu-west-1 held for 248s',
      'worker-sync retry count exceeded policy threshold',
    ],
  },
  'deadlock-api-cascade': {
    id: 'api-cascade-blocking',
    title: 'API Cascade Blocking',
    summary: 'Upstream timeout retries cascade into dependency waits across the billing path.',
    dependencyGraph: [
      { from: 'edge-api', to: 'billing-api', relation: 'retrying timeout window' },
      { from: 'billing-api', to: 'ledger-worker', relation: 'waiting on reconciliation queue' },
      { from: 'ledger-worker', to: 'postgres-primary', relation: 'blocked on stale session lock' },
    ],
    blockedServices: [
      { name: 'billing-api / charge-close', transactionId: 'req-9912', waitingFor: 'ledger-worker', lock: 'SessionLock' },
    ],
    blockedChain: [
      'edge-api retry storm -> billing-api saturation -> ledger-worker blocked',
      'ledger-worker waits on stale postgres session lock before acking queue',
    ],
    rootCause: 'Cascading retries hide a stale database session lock and amplify blocking through the API chain.',
    suggestedAction: 'Cut edge retries, kill the stale session lock, then replay billing requests in a controlled batch.',
    lockInfo: [
      'SessionLock pid 8452 held on ledger checkpoint row',
      'billing-api retry window exceeded 3x steady-state baseline',
    ],
  },
};

function cloneScenario(scenario) {
  return JSON.parse(JSON.stringify(scenario));
}

export function getDeadlockScenario(labId) {
  return cloneScenario(DEADLOCK_SCENARIOS[labId] || DEADLOCK_SCENARIOS.default);
}

export function analyzeDeadlockScenario(scenarioInput, options = {}) {
  const scenario = cloneScenario(scenarioInput || DEADLOCK_SCENARIOS.default);
  const timestamp = new Date(options.nowMs || Date.now()).toISOString();

  return {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary,
    timestamp,
    dependencyGraph: scenario.dependencyGraph.map((edge) => `${edge.from} -> ${edge.to} (${edge.relation})`),
    blockedServices: scenario.blockedServices.map((service) => ({
      name: service.name,
      transactionId: service.transactionId,
      waitingFor: service.waitingFor,
      lock: service.lock,
    })),
    blockedChain: [...scenario.blockedChain],
    rootCause: scenario.rootCause,
    suggestedAction: scenario.suggestedAction,
    lockInfo: [...scenario.lockInfo],
  };
}

export function formatDeadlockAnalysisForTerminal(analysis) {
  const lines = [
    '',
    `[${analysis.timestamp}] DEADLOCKGUARD ANALYSIS :: ${analysis.title}`,
    `Summary: ${analysis.summary}`,
    '',
    'Dependency Graph',
    ...analysis.dependencyGraph.map((line) => `  - ${line}`),
    '',
    'Blocked Services',
    ...analysis.blockedServices.map((service) => `  - ${service.name} | tx ${service.transactionId} | waiting for ${service.waitingFor} | ${service.lock}`),
    '',
    'Blocked Chain',
    ...analysis.blockedChain.map((line) => `  - ${line}`),
    '',
    `Root Cause: ${analysis.rootCause}`,
    `Suggested Fix: ${analysis.suggestedAction}`,
    '',
    'Lock Info',
    ...analysis.lockInfo.map((line) => `  - ${line}`),
    '',
  ];

  return lines.join('\r\n');
}

export function buildDeadlockGuardShellFunction(analysis) {
  const output = formatDeadlockAnalysisForTerminal(analysis).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return `analyze() {\n  cat <<'WINLAB_DEADLOCK_GUARD'\n${output}\nWINLAB_DEADLOCK_GUARD\n}\nexport -f analyze\n`;
}
