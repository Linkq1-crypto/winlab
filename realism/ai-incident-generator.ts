import type { Incident } from "./incident-library"
import {
  NETWORK_INCIDENTS,
  DB_INCIDENTS,
  APP_INCIDENTS,
  INFRA_INCIDENTS,
  AUTH_INCIDENTS,
  STORAGE_INCIDENTS,
} from "./incident-library"

// ============================================================
// AI Incident Generator — Adaptive difficulty & mutation engine
// ============================================================

/**
 * User profile used by the adaptive difficulty system.
 * Tracks skill level, historical performance, and behavioural patterns
 * so incidents can be tailored to challenge the user appropriately.
 */
export interface UserProfile {
  /** Average time (ms) the user takes to resolve incidents. */
  avgSolveTime: number
  /** Categories of mistakes the user commonly makes. */
  commonMistakes: string[]
  /** Self-assessed or system-determined skill tier. */
  skill: "junior" | "mid" | "senior" | "expert"
  /** How much the user relies on hints (0 = none, 1 = fully dependent). */
  hintDependency: number
  /** Historical error rate when diagnosing incidents (0-1). */
  errorRate: number
}

/**
 * An incident that has been mutated from a base template.
 * Includes metadata about what changed and why.
 */
export interface MutatedIncident extends Incident {
  /** Human-readable explanation of the mutation applied. */
  mutationReason: string
  /** ID of the original incident this was derived from. */
  baseIncidentId: string
}

// ---- Internal helpers ------------------------------------------------

/**
 * Maps a skill level to the incident difficulties it should see.
 */
const DIFFICULTY_BY_SKILL: Record<UserProfile["skill"], Incident["difficulty"][]> = {
  junior: ["medium"],
  mid: ["medium", "hard"],
  senior: ["hard", "expert"],
  expert: ["expert"],
}

/**
 * Maps a skill level to the typical number of complexity layers
 * to add on top of the base incident.
 */
const LAYERS_BY_SKILL: Record<UserProfile["skill"], number> = {
  junior: 1,
  mid: 2,
  senior: 3,
  expert: 4,
}

/**
 * Returns the full incident pool from all categories.
 */
function getAllIncidents(): Incident[] {
  return [
    ...NETWORK_INCIDENTS,
    ...DB_INCIDENTS,
    ...APP_INCIDENTS,
    ...INFRA_INCIDENTS,
    ...AUTH_INCIDENTS,
    ...STORAGE_INCIDENTS,
  ]
}

/**
 * Picks a random element from an array.
 */
function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Deep-clones an incident so mutations do not affect the original.
 */
function cloneIncident(incident: Incident): Incident {
  return JSON.parse(JSON.stringify(incident))
}

// ---- Class implementation --------------------------------------------

/**
 * AI-driven incident generator that adapts difficulty, complexity, and
 * mutation strategies based on the user's profile.
 *
 * **Adaptive chaos logic:**
 * - `junior` → medium difficulty, single layer, longer delays
 * - `mid` → medium/hard, 2 layers
 * - `senior` → hard/expert, multi-layer, shorter delays
 * - `expert` → expert only, hidden secondary failures
 *
 * **Mutation strategies:**
 * - Add secondary failure stage for expert users
 * - Increase log noise for mid users
 * - Hide root cause signals for senior users
 * - Extend diagnostic window for junior users
 */
export class AIIncidentGenerator {
  /** All available incidents loaded at construction time. */
  private readonly pool: Incident[]

  constructor() {
    this.pool = getAllIncidents()
  }

  // ---- Public API ----------------------------------------------------

  /**
   * Generates a single incident adapted to the user's profile.
   * If no profile is supplied, defaults to "mid" skill with neutral stats.
   *
   * @param user - Optional user profile for adaptive difficulty.
   * @returns An {@link Incident} tailored to the user.
   */
  generate(user?: UserProfile): Incident {
    const profile = user ?? this._defaultProfile()
    let pool = this._filterByDifficulty(this.pool, profile.skill)
    pool = this._biasByMistakes(pool, profile.commonMistakes)

    if (pool.length === 0) {
      pool = this.pool
    }

    const incident = cloneIncident(randomFrom(pool))
    return this._addComplexityLayers(incident, profile.skill)
  }

  /**
   * Generates a mutated variant of a specific incident template.
   * Useful when you want to re-use a known incident but make it
   * feel fresh for repeat play.
   *
   * @param template - The base incident to mutate.
   * @param user - Optional user profile for adaptive mutation.
   * @returns A {@link MutatedIncident} with mutation metadata.
   */
  generateFromTemplate(template: Incident, user?: UserProfile): MutatedIncident {
    const profile = user ?? this._defaultProfile()
    const mutated = cloneIncident(template) as MutatedIncident

    // Override the read-only `id` by creating a derived id
    ;(mutated as any).id = `${template.id}_mutated_${Date.now()}`
    ;(mutated as any).baseIncidentId = template.id

    const { incident: result, reason } = this._mutateIncident(mutated, profile)
    result.mutationReason = reason
    result.baseIncidentId = template.id

    return result
  }

  /**
   * Generates an incident that spans multiple named services,
   * with complexity layers scaled by difficulty.
   *
   * @param services - List of service names to involve in the incident.
   * @param difficulty - Optional override for difficulty selection.
   * @returns A multi-service {@link Incident}.
   */
  generateMultiLayer(services: string[], difficulty?: string): Incident {
    const diff = (difficulty as Incident["difficulty"]) ?? "hard"
    const pool = this._filterByDifficulty(this.pool, this._skillFromDifficulty(diff))
    const base = pool.length > 0 ? cloneIncident(randomFrom(pool)) : cloneIncident(randomFrom(this.pool))

    // Inject service context into the incident description
    const serviceList = services.join(", ")
    const enriched = {
      ...base,
      description: `[Multi-service] Affected services: ${serviceList}. ${base.description}`,
    }

    const skill = this._skillFromDifficulty(diff)
    return this._addComplexityLayers(enriched, skill)
  }

  // ---- Private methods -----------------------------------------------

  /**
   * Filters the incident pool to only those matching the user's skill
   * difficulty band.
   */
  private _filterByDifficulty(pool: Incident[], skill: UserProfile["skill"]): Incident[] {
    const allowed = DIFFICULTY_BY_SKILL[skill]
    return pool.filter((i) => allowed.includes(i.difficulty))
  }

  /**
   * Biases selection toward incidents whose root causes overlap with
   * the user's common mistakes — reinforcing learning in weak areas.
   */
  private _biasByMistakes(pool: Incident[], mistakes: string[]): Incident[] {
    if (mistakes.length === 0) return pool

    const matching = pool.filter((incident) => {
      const causes = incident.rootCauses.map((c) => c.toLowerCase())
      return mistakes.some((m) => causes.some((c) => c.includes(m.toLowerCase())))
    })

    // Return matching incidents with 70% probability, fall back to full pool otherwise
    return matching.length > 0 && Math.random() < 0.7 ? matching : pool
  }

  /**
   * Mutates an incident based on the user's profile.
   * Different profiles trigger different mutation strategies.
   *
   * @returns The mutated incident and a human-readable reason.
   */
  private _mutateIncident(
    incident: Incident,
    user: UserProfile
  ): { incident: Incident; reason: string } {
    const mutated = cloneIncident(incident)

    switch (user.skill) {
      case "expert":
        return this._addSecondaryFailure(mutated)
      case "senior":
        return this._hideRootCauseSignals(mutated)
      case "mid":
        return this._increaseLogNoise(mutated)
      case "junior":
      default:
        return this._extendDiagnosticWindow(mutated)
    }
  }

  /**
   * Adds a hidden secondary failure stage after the primary stages.
   * Expert users must discover this additional failure while resolving
   * the primary incident.
   */
  private _addSecondaryFailure(incident: Incident): { incident: Incident; reason: string } {
    const secondaryActions: ((env: any) => void)[] = [
      (env: any) => {
        if (!env.services) env.services = {}
        env.services.secondaryFailure = true
        if (Array.isArray(env.logs)) {
          env.logs.push("[hidden] secondary degradation on monitoring agent")
        }
      },
    ]

    mutated.stages = [
      ...mutated.stages,
      {
        name: "hidden_secondary_failure",
        delay: 3000,
        actions: secondaryActions,
      },
    ]

    mutated.difficulty = "expert"

    return {
      incident: mutated,
      reason: "Added hidden secondary failure stage — monitoring agent degradation " +
        "occurs during resolution, masking the primary issue.",
    }
  }

  /**
   * Obscures root cause signals by shuffling stage order and injecting
   * misleading log entries.
   */
  private _hideRootCauseSignals(incident: Incident): { incident: Incident; reason: string } {
    const shuffle = [...incident.stages]
    // Swap last two stages to change expected progression
    if (shuffle.length >= 2) {
      const len = shuffle.length
      ;[shuffle[len - 1], shuffle[len - 2]] = [shuffle[len - 2], shuffle[len - 1]]
    }

    mutated.stages = shuffle.map((stage) => ({
      ...stage,
      actions: [
        ...stage.actions,
        (env: any) => {
          if (Array.isArray(env.logs)) {
            env.logs.push("[noise] unrelated service health check OK")
            env.logs.push("[noise] routine log rotation completed")
          }
        },
      ],
    }))

    return {
      incident: mutated,
      reason: "Shuffled stage order and injected noise logs to obscure root cause signals.",
    }
  }

  /**
   * Injects additional log noise into every stage, making it harder
   * to separate signal from noise.
   */
  private _increaseLogNoise(incident: Incident): { incident: Incident; reason: string } {
    const noiseLogs = [
      "[info] cron job completed successfully",
      "[info] healthcheck ping: 200 OK",
      "[debug] GC pause: 12ms",
      "[info] SSL cert valid for 89 days",
    ]

    mutated.stages = incident.stages.map((stage) => ({
      ...stage,
      actions: [
        (env: any) => {
          if (Array.isArray(env.logs)) {
            const noise = noiseLogs[Math.floor(Math.random() * noiseLogs.length)]
            env.logs.push(noise)
          }
        },
        ...stage.actions,
      ],
    }))

    return {
      incident: mutated,
      reason: "Increased log noise with routine informational messages to dilute signal.",
    }
  }

  /**
   * Extends delays between stages to give junior users more time
   * to observe and diagnose each phase.
   */
  private _extendDiagnosticWindow(incident: Incident): { incident: Incident; reason: string } {
    mutated.stages = incident.stages.map((stage) => ({
      ...stage,
      delay: stage.delay + 3000,
    }))

    return {
      incident: mutated,
      reason: "Extended diagnostic windows by 3s per stage for longer observation time.",
    }
  }

  /**
   * Adds complexity layers by extending stages with additional actions
   * and adjusting timing based on skill level.
   */
  private _addComplexityLayers(incident: Incident, skill: UserProfile["skill"]): Incident {
    const layers = LAYERS_BY_SKILL[skill]
    const result = cloneIncident(incident)

    const timingMultiplier = skill === "junior" ? 1.5 : skill === "expert" ? 0.6 : 1.0

    // Adjust delays based on skill
    result.stages = result.stages.map((stage) => ({
      ...stage,
      delay: Math.round(stage.delay * timingMultiplier),
    }))

    // Add extra complexity stages
    for (let i = 0; i < layers - 1; i++) {
      const complexityStage = this._createComplexityStage(skill, i)
      result.stages.push(complexityStage)
    }

    return result
  }

  /**
   * Creates an additional complexity stage appropriate for the skill level.
   */
  private _createComplexityStage(skill: UserProfile["skill"], index: number): Incident["stages"][number] {
    const delayBase = skill === "junior" ? 8000 : skill === "expert" ? 2000 : 4000

    const actions: ((env: any) => void)[] = []

    switch (skill) {
      case "expert":
        actions.push((env: any) => {
          env.cpu = Math.min(100, (env.cpu || 0) + 15)
          if (Array.isArray(env.logs)) {
            env.logs.push(`[complexity-${index}] intermittent CPU throttling detected`)
          }
        })
        break
      case "senior":
        actions.push((env: any) => {
          if (!env.services) env.services = {}
          env.services.cascadingDegradation = true
          if (Array.isArray(env.logs)) {
            env.logs.push(`[complexity-${index}] cascading degradation on dependent service`)
          }
        })
        break
      case "mid":
        actions.push((env: any) => {
          if (Array.isArray(env.logs)) {
            env.logs.push(`[complexity-${index}] memory pressure warning — approaching threshold`)
          }
        })
        break
      case "junior":
      default:
        actions.push((env: any) => {
          if (Array.isArray(env.logs)) {
            env.logs.push(`[complexity-${index}] baseline metrics showing gradual drift`)
          }
        })
        break
    }

    return {
      name: `complexity_layer_${index}`,
      delay: delayBase + index * 2000,
      actions,
    }
  }

  /**
   * Creates a default neutral profile for when no user data is available.
   */
  private _defaultProfile(): UserProfile {
    return {
      avgSolveTime: 300000,
      commonMistakes: [],
      skill: "mid",
      hintDependency: 0.5,
      errorRate: 0.3,
    }
  }

  /**
   * Converts a difficulty string to the closest skill level.
   */
  private _skillFromDifficulty(difficulty: string): UserProfile["skill"] {
    switch (difficulty) {
      case "medium":
        return "mid"
      case "hard":
        return "senior"
      case "expert":
        return "expert"
      default:
        return "mid"
    }
  }
}

// ---- Factory export --------------------------------------------------

/**
 * Creates a new {@link AIIncidentGenerator} instance.
 *
 * @returns A ready-to-use incident generator.
 */
export function createAIIncidentGenerator(): AIIncidentGenerator {
  return new AIIncidentGenerator()
}
