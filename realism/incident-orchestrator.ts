// ============================================================
// Incident Orchestrator — staging, correlations, validation
// ============================================================

import type { Incident, IncidentStage } from "./incident-library"

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export interface IncidentResult {
  incident: Incident
  stages: string[]
  duration: number
  violations: any[]
  environmentState: string
  success: boolean
}

interface CorrelationRule {
  name: string
  condition: (env: any) => boolean
  apply: (env: any) => void
}

export interface RunOptions {
  sequential?: boolean
  overlap?: boolean
  validateDuringStages?: boolean
  applyCorrelations?: boolean
  delayBetweenStages?: number // ms multiplier
}

// ----------------------------------------------------------
// Correlation Engine
// ----------------------------------------------------------

const CORRELATION_RULES: CorrelationRule[] = [
  {
    name: "network_latency_to_db_lag",
    condition: (env: any) => (env.network?.latencyMs ?? 0) > 1000,
    apply: (env: any) => {
      if (!env.db) env.db = {}
      env.db.lag = (env.db.lag || 0) + 2000
      if (env.logs) env.logs.push("[correlation] network latency >1000ms → adding 2000ms db lag")
    },
  },
  {
    name: "db_lag_to_upstream_timeout",
    condition: (env: any) => (env.db?.lag ?? 0) > 3000,
    apply: (env: any) => {
      if (env.logs) env.logs.push("[correlation] db lag >3000ms → upstream timeout")
      if (env.services) {
        env.services.mysql.status = "degraded"
        env.services.api.status = "degraded"
      }
    },
  },
  {
    name: "disk_io_to_mysql_degraded",
    condition: (env: any) => (env.storage?.ioLatency ?? 0) > 2000,
    apply: (env: any) => {
      if (env.services) env.services.mysql.status = "degraded"
      if (env.logs) env.logs.push("[correlation] disk ioLatency >2000ms → mysql degraded")
    },
  },
  {
    name: "network_partition_to_replication",
    condition: (env: any) => env.network?.partitionActive === true,
    apply: (env: any) => {
      if (env.db) env.db.replicationBroken = true
      if (env.services) env.services.replicator.status = "down"
      if (env.logs) env.logs.push("[correlation] network partition → replication broken")
    },
  },
  {
    name: "storage_full_to_db_readonly",
    condition: (env: any) => env.storage?.full === true,
    apply: (env: any) => {
      if (env.db) env.db.readOnly = true
      if (env.logs) env.logs.push("[correlation] storage full → db read-only mode")
    },
  },
  {
    name: "memory_pressure_to_gc",
    condition: (env: any) => (env.memory ?? 0) > 85,
    apply: (env: any) => {
      env.gcPauseMs = ((env.gcPauseMs ?? 0) + 500)
      env.cpu = Math.min(100, (env.cpu ?? 0) + 15)
      if (env.logs) env.logs.push("[correlation] memory >85% → GC pressure increasing")
    },
  },
  {
    name: "auth_down_to_app_degraded",
    condition: (env: any) => env.auth?.ldapDown === true || env.services?.auth?.status === "down",
    apply: (env: any) => {
      if (env.services) env.services.api.status = "degraded"
      if (env.logs) env.logs.push("[correlation] auth down → API degraded")
    },
  },
  {
    name: "ntp_desync_to_auth_failure",
    condition: (env: any) => (env.infra?.timeSkewMs ?? 0) > 10000,
    apply: (env: any) => {
      if (!env.auth) env.auth = {}
      env.auth.tokensExpired = true
      if (env.logs) env.logs.push("[correlation] NTP skew >10s → token validation fails")
    },
  },
  {
    name: "zombie_pid_to_service_failure",
    condition: (env: any) => (env.infra?.zombieCount ?? 0) > 30000,
    apply: (env: any) => {
      env.infra.cannotFork = true
      if (env.services) {
        Object.keys(env.services).forEach((k) => {
          if (env.services[k].status !== "down") {
            env.services[k].status = "degraded"
          }
        })
      }
      if (env.logs) env.logs.push("[correlation] zombie count >30K → services degraded")
    },
  },
  {
    name: "log_flood_to_disk_pressure",
    condition: (env: any) => (env.infra?.logRate ?? 0) > 5000,
    apply: (env: any) => {
      if (!env.storage) env.storage = {}
      env.storage.usagePct = Math.min(100, (env.storage.usagePct ?? 0) + 5)
      if (env.logs) env.logs.push("[correlation] log flood → disk pressure increasing")
    },
  },
]

// ----------------------------------------------------------
// Environment Invariants
// ----------------------------------------------------------

interface InvariantCheck {
  name: string
  check: (env: any) => string | null
}

const INVARIANT_CHECKS: InvariantCheck[] = [
  {
    name: "latency_non_negative",
    check: (env: any) => {
      if (env.network?.latencyMs !== undefined && env.network.latencyMs < 0) {
        return "network.latencyMs is negative"
      }
      return null
    },
  },
  {
    name: "db_lag_non_negative",
    check: (env: any) => {
      if (env.db?.lag !== undefined && env.db.lag < 0) {
        return "db.lag is negative"
      }
      return null
    },
  },
  {
    name: "memory_bounded",
    check: (env: any) => {
      if (env.memory !== undefined && (env.memory < 0 || env.memory > 200)) {
        return `memory out of bounds: ${env.memory}%`
      }
      return null
    },
  },
  {
    name: "cpu_bounded",
    check: (env: any) => {
      if (env.cpu !== undefined && (env.cpu < 0 || env.cpu > 150)) {
        return `cpu out of bounds: ${env.cpu}%`
      }
      return null
    },
  },
  {
    name: "storage_usage_bounded",
    check: (env: any) => {
      if (env.storage?.usagePct !== undefined && (env.storage.usagePct < 0 || env.storage.usagePct > 110)) {
        return `storage.usagePct out of bounds: ${env.storage.usagePct}%`
      }
      return null
    },
  },
  {
    name: "deadlocks_non_negative",
    check: (env: any) => {
      if (env.db?.deadlocks !== undefined && env.db.deadlocks < 0) {
        return "db.deadlocks is negative"
      }
      return null
    },
  },
  {
    name: "services_have_status",
    check: (env: any) => {
      if (env.services) {
        for (const [name, svc] of Object.entries(env.services)) {
          const s = svc as any
          if (s.status !== undefined && !["healthy", "degraded", "down", "flapping", "split-brain"].includes(s.status)) {
            return `services.${name}.status has invalid value: ${s.status}`
          }
        }
      }
      return null
    },
  },
]

export function validateInvariants(env: any): string[] {
  const violations: string[] = []
  for (const inv of INVARIANT_CHECKS) {
    const v = inv.check(env)
    if (v) violations.push(v)
  }
  return violations
}

// ----------------------------------------------------------
// Utility
// ----------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function summarizeEnvironment(env: any): string {
  const parts: string[] = []

  if (env.network) {
    const n = env.network
    parts.push(`net:latency=${n.latencyMs ?? 0}ms drops=${n.drops ?? 0} partition=${n.partitionActive ?? false}`)
  }
  if (env.db) {
    const d = env.db
    parts.push(`db:lag=${d.lag ?? 0}ms deadlocks=${d.deadlocks ?? 0} corrupted=${d.corrupted ?? "none"}`)
  }
  if (env.storage) {
    const s = env.storage
    parts.push(`storage:ioLatency=${s.ioLatency ?? 0}ms usage=${s.usagePct ?? 0}% full=${s.full ?? false}`)
  }
  if (env.auth) {
    const a = env.auth
    parts.push(`auth:ldapDown=${a.ldapDown ?? false} locked=${a.locked ?? false} sudoBroken=${a.sudoBroken ?? false}`)
  }
  if (env.services) {
    const svcStates: string[] = []
    for (const [name, svc] of Object.entries(env.services)) {
      svcStates.push(`${name}:${(svc as any).status ?? "unknown"}`)
    }
    parts.push(`services:[${svcStates.join(", ")}]`)
  }
  if (env.memory !== undefined) parts.push(`memory=${env.memory}%`)
  if (env.cpu !== undefined) parts.push(`cpu=${env.cpu}%`)
  if (env.infra) {
    const i = env.infra
    if (i.timeSkewMs) parts.push(`timeSkew=${i.timeSkewMs}ms`)
    if (i.zombieCount) parts.push(`zombies=${i.zombieCount}`)
    if (i.kernelPanic) parts.push("kernel_panic=true")
  }

  return parts.join(" | ")
}

// ----------------------------------------------------------
// Orchestrator
// ----------------------------------------------------------

export class IncidentOrchestrator {
  private correlationRules: CorrelationRule[]

  constructor(rules?: CorrelationRule[]) {
    this.correlationRules = rules ?? CORRELATION_RULES
  }

  /**
   * Run a single incident scenario against the environment.
   */
  async runScenario(env: any, scenario: Incident, options?: RunOptions): Promise<IncidentResult> {
    const stages: string[] = []
    const allViolations: any[] = []
    const startTime = Date.now()
    const applyCorrelations = options?.applyCorrelations ?? true
    const validateDuring = options?.validateDuringStages ?? true
    const delayMultiplier = options?.delayBetweenStages ?? 1

    // Initialize env sub-objects if not present
    this.ensureEnv(env)

    for (const stage of scenario.stages) {
      stages.push(stage.name)

      // Execute stage actions
      for (const action of stage.actions) {
        try {
          action(env)
        } catch (err: any) {
          if (env.logs) {
            env.logs.push(`[orchestrator] stage "${stage.name}" action error: ${err.message}`)
          }
        }
      }

      // Apply correlation rules after stage
      if (applyCorrelations) {
        this.applyCorrelations(env)
      }

      // Validate invariants during scenario
      if (validateDuring) {
        const violations = validateInvariants(env)
        allViolations.push(...violations.map((v) => ({ stage: stage.name, invariant: v })))
      }

      // Stage delay
      await sleep(stage.delay * delayMultiplier)
    }

    const duration = Date.now() - startTime
    const environmentState = summarizeEnvironment(env)

    return {
      incident: scenario,
      stages,
      duration,
      violations: allViolations,
      environmentState,
      success: allViolations.length === 0,
    }
  }

  /**
   * Run multiple incident scenarios.
   * - sequential: run one after another
   * - overlap: run concurrently (simultaneous incidents)
   */
  async runMultiple(
    env: any,
    scenarios: Incident[],
    options?: RunOptions
  ): Promise<IncidentResult[]> {
    const results: IncidentResult[] = []
    const sequential = options?.sequential ?? true
    const applyCorrelations = options?.applyCorrelations ?? true

    this.ensureEnv(env)

    if (sequential) {
      for (const scenario of scenarios) {
        const result = await this.runScenario(env, { ...scenario }, options)
        results.push(result)

        // Correlations between incidents
        if (applyCorrelations) {
          this.applyCrossIncidentCorrelations(env, scenario)
        }
      }
    } else {
      // Concurrent execution — simulate overlapping incidents
      const promises = scenarios.map((scenario) => {
        const clonedScenario = { ...scenario, stages: scenario.stages.map((s) => ({ ...s, actions: [...s.actions] })) }
        return this.runScenario(env, clonedScenario, {
          ...options,
          applyCorrelations: false, // correlations applied after all complete
        })
      })
      results.push(...(await Promise.all(promises)))

      // Apply correlations after all complete
      if (applyCorrelations) {
        this.applyCorrelations(env)
        // Re-validate
        const violations = validateInvariants(env)
        results.forEach((r) => {
          r.violations.push(...violations.map((v) => ({ invariant: v, source: "post-correlation" })))
        })
      }
    }

    return results
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private ensureEnv(env: any): void {
    if (!env.network) env.network = {}
    if (!env.db) env.db = {}
    if (!env.services) env.services = {}
    if (!env.storage) env.storage = {}
    if (!env.auth) env.auth = {}
    if (!env.infra) env.infra = {}
    if (!env.app) env.app = {}
    if (!env.logs) env.logs = []
    if (env.memory === undefined) env.memory = 35
    if (env.cpu === undefined) env.cpu = 15
    if (!env.services.mysql) env.services.mysql = { status: "healthy" }
    if (!env.services.api) env.services.api = { status: "healthy" }
    if (!env.services.redis) env.services.redis = { status: "healthy" }
    if (!env.services.auth) env.services.auth = { status: "healthy" }
    if (!env.services.replicator) env.services.replicator = { status: "healthy" }
    if (!env.services.consensus) env.services.consensus = { status: "healthy" }
    if (!env.services.appBackend) env.services.appBackend = { status: "healthy", restarts: 0 }
  }

  private applyCorrelations(env: any): void {
    for (const rule of this.correlationRules) {
      try {
        if (rule.condition(env)) {
          rule.apply(env)
        }
      } catch {
        // Silently skip correlation rules that fail
      }
    }
  }

  /**
   * Apply cross-incident correlations when running multiple scenarios.
   */
  private applyCrossIncidentCorrelations(env: any, scenario: Incident): void {
    // Network → DB
    if (scenario.category === "network" && (env.network?.latencyMs ?? 0) > 1000) {
      if (!env.db) env.db = {}
      env.db.lag = (env.db.lag || 0) + 2000
      if (env.logs) env.logs.push("[cross-correlation] network incident → db lag +2000ms")
    }

    // DB → App
    if (scenario.category === "db" && (env.db?.lag ?? 0) > 3000) {
      if (env.services) env.services.api.status = "degraded"
      if (env.logs) env.logs.push("[cross-correlation] db incident → API degraded")
    }

    // Disk → DB
    if (scenario.category === "storage" && (env.storage?.ioLatency ?? 0) > 2000) {
      if (env.services) env.services.mysql.status = "degraded"
      if (env.logs) env.logs.push("[cross-correlation] storage incident → mysql degraded")
    }

    // Auth → App
    if (scenario.category === "auth" && (env.auth?.ldapDown || env.services?.auth?.status === "down")) {
      if (env.services) env.services.api.status = "degraded"
      if (env.logs) env.logs.push("[cross-correlation] auth incident → API degraded")
    }

    // Infra → Everything
    if (scenario.category === "infra") {
      if (env.infra?.kernelPanic) {
        if (env.services) {
          Object.keys(env.services).forEach((k) => {
            env.services[k].status = "down"
          })
        }
        if (env.logs) env.logs.push("[cross-correlation] kernel panic → all services down")
      }
      if (env.infra?.timeSkewMs && env.infra.timeSkewMs > 10000) {
        if (!env.auth) env.auth = {}
        env.auth.tokensExpired = true
        if (env.logs) env.logs.push("[cross-correlation] NTP desync → tokens expired")
      }
    }
  }

  /**
   * Validate during scenario — check invariants at each stage boundary.
   */
  private validateDuringScenario(env: any): string[] {
    return validateInvariants(env)
  }
}

// ----------------------------------------------------------
// Factory
// ----------------------------------------------------------

export function createOrchestrator(rules?: CorrelationRule[]): IncidentOrchestrator {
  return new IncidentOrchestrator(rules)
}
