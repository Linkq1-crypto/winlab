// ============================================================
// Log Incident Pipeline — Log → Signal → Root Cause → Incident
// ============================================================

/**
 * Raw log input wrapper.
 */
export interface LogInput {
  /** Array of raw log lines to process. */
  logs: string[]
}

/**
 * A single log line after parsing and normalization.
 */
export interface ParsedLog {
  /** The original unmodified log line. */
  original: string
  /** Lowercased, trimmed log line ready for pattern matching. */
  normalized: string
  /** Extracted ISO timestamp if present. */
  timestamp?: string
  /** Extracted log source/component if present. */
  source?: string
  /** Extracted log level (e.g. "ERROR", "WARN", "INFO"). */
  level?: string
}

/**
 * Extracted signals from parsed logs with frequency counts.
 */
export interface SignalExtraction {
  /** Distinct signal identifiers found in the logs. */
  signals: string[]
  /** How many times each signal appeared. */
  frequencies: Record<string, number>
}

/**
 * Inferred root cause with affected cascade layers.
 */
export interface RootCauseInference {
  /**
   * The root cause category:
   * - `"network"` — connectivity / latency issues
   * - `"storage"` — disk / I/O problems
   * - `"app"` — application crashes / upstream failures
   * - `"auth"` — permission / certificate issues
   * - `"unknown"` — no clear signal matched
   */
  root: "network" | "storage" | "app" | "auth" | "unknown"
  /** Ordered list of system layers affected by the cascade. */
  cascade: string[]
  /** Confidence score from 0 (speculative) to 1 (certain). */
  confidence: number
}

/**
 * A fully constructed incident ready for execution.
 */
export interface GeneratedIncident {
  /** Unique identifier for this generated incident. */
  id: string
  /** Signals that were detected in the source logs. */
  signals: string[]
  /** Inferred root cause with cascade information. */
  rootCause: RootCauseInference
  /** Execution stages with delays and environment-modifying actions. */
  stages: Array<{ delay: number; actions: ((env: any) => void)[] }>
  /** Human-readable summary of the incident. */
  description: string
}

// ---- Signal extraction rules -----------------------------------------

/**
 * Maps log text patterns to signal identifiers.
 * Ordered by specificity — more specific patterns should come first.
 */
const SIGNAL_RULES: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /connection\s+refused/i, signal: "upstream_down" },
  { pattern: /no\s+space\s+left/i, signal: "disk_full" },
  { pattern: /permission\s+denied/i, signal: "auth_issue" },
  { pattern: /i\/o\s+error/i, signal: "disk_failure" },
  { pattern: /out\s+of\s+memory/i, signal: "memory_issue" },
  { pattern: /segmentation\s+fault/i, signal: "crash" },
  { pattern: /certificate\s+expir/i, signal: "ssl_issue" },
  { pattern: /timed?\s+out/i, signal: "latency_issue" },
  { pattern: /connection\s+(?:reset|closed|dropped)/i, signal: "upstream_down" },
  { pattern: /disk\s+(?:full|error|failure)/i, signal: "disk_full" },
  { pattern: /unauthorized|forbidden|403/i, signal: "auth_issue" },
  { pattern: /oom|killed\s+by\s+oom/i, signal: "memory_issue" },
  { pattern: /segfault|core\s+dump/i, signal: "crash" },
  { pattern: /ssl|tls|handshake\s+fail/i, signal: "ssl_issue" },
]

/**
 * Maps signal identifiers to root cause categories and cascade layers.
 */
const ROOT_CAUSE_MAP: Record<
  string,
  { root: RootCauseInference["root"]; cascade: string[]; confidence: number }
> = {
  disk_full: { root: "storage", cascade: ["db", "app"], confidence: 0.9 },
  disk_failure: { root: "storage", cascade: ["db", "app"], confidence: 0.85 },
  latency_issue: { root: "network", cascade: ["db", "app"], confidence: 0.75 },
  upstream_down: { root: "app", cascade: ["db"], confidence: 0.8 },
  auth_issue: { root: "auth", cascade: ["app"], confidence: 0.85 },
  ssl_issue: { root: "auth", cascade: ["app", "network"], confidence: 0.8 },
  memory_issue: { root: "app", cascade: ["app", "db"], confidence: 0.7 },
  crash: { root: "app", cascade: ["app"], confidence: 0.9 },
}

// ---- Utility functions -----------------------------------------------

/**
 * Generates a short unique ID for incidents.
 */
function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 8)
  return `incident_${ts}_${rand}`
}

// ---- Class implementation --------------------------------------------

/**
 * Pipeline that transforms raw log lines into a structured, executable
 * incident through four stages:
 *
 * 1. **Parse** — Normalize and extract metadata from each log line.
 * 2. **Extract Signals** — Match patterns to known signal identifiers.
 * 3. **Infer Root Cause** — Map dominant signals to root cause categories.
 * 4. **Build Incident** — Construct an executable incident with stages.
 *
 * Browser-compatible — no Node.js `fs` or process APIs used.
 */
export class LogIncidentPipeline {
  // ---- Stage 1: Parse ------------------------------------------------

  /**
   * Parses raw log strings into structured {@link ParsedLog} objects.
   *
   * Extracts timestamps, sources, and log levels where recognizable,
   * and produces a normalized lowercased version for pattern matching.
   *
   * @param logs - Array of raw log line strings.
   * @returns Parsed and normalized log entries.
   */
  parseLogs(logs: string[]): ParsedLog[] {
    return logs.map((raw) => {
      const trimmed = raw.trim()
      const normalized = trimmed.toLowerCase()

      const timestamp = this._extractTimestamp(trimmed)
      const source = this._extractSource(trimmed)
      const level = this._extractLevel(trimmed)

      return { original: trimmed, normalized, timestamp, source, level }
    })
  }

  // ---- Stage 2: Extract Signals --------------------------------------

  /**
   * Scans parsed logs against the signal rule set and returns
   * all matched signals with their frequencies.
   *
   * @param parsedLogs - Parsed log entries from {@link parseLogs}.
   * @returns Extracted signals and their occurrence counts.
   */
  extractSignals(parsedLogs: ParsedLog[]): SignalExtraction {
    const freq: Record<string, number> = {}

    for (const log of parsedLogs) {
      for (const rule of SIGNAL_RULES) {
        if (rule.pattern.test(log.normalized)) {
          freq[rule.signal] = (freq[rule.signal] || 0) + 1
          // Each log line only fires its first matching rule
          break
        }
      }
    }

    // Sort by frequency descending, then alphabetically for ties
    const signals = Object.keys(freq).sort((a, b) => {
      const diff = freq[b] - freq[a]
      return diff !== 0 ? diff : a.localeCompare(b)
    })

    return { signals, frequencies: freq }
  }

  // ---- Stage 3: Infer Root Cause -------------------------------------

  /**
   * Determines the most likely root cause from the extracted signals.
   *
   * Uses the highest-frequency signal as the primary indicator.
   * If multiple signals tie in frequency, picks the one with higher
   * confidence in the root cause map.
   *
   * @param signals - Extracted signals from {@link extractSignals}.
   * @returns Inferred root cause with cascade and confidence.
   */
  inferRootCause(signals: SignalExtraction): RootCauseInference {
    if (signals.signals.length === 0) {
      return { root: "unknown", cascade: [], confidence: 0 }
    }

    // Score each signal by frequency * base confidence
    let bestSignal = signals.signals[0]
    let bestScore = 0

    for (const signal of signals.signals) {
      const freq = signals.frequencies[signal] || 0
      const mapping = ROOT_CAUSE_MAP[signal]
      const confidence = mapping?.confidence ?? 0.5
      const score = freq * confidence

      if (score > bestScore) {
        bestScore = score
        bestSignal = signal
      }
    }

    const mapping = ROOT_CAUSE_MAP[bestSignal]
    if (!mapping) {
      return { root: "unknown", cascade: [], confidence: 0.3 }
    }

    // Build combined cascade from all matched signals
    const cascade = this._mergeCascades(signals.signals)

    return {
      root: mapping.root,
      cascade,
      confidence: Math.min(1, mapping.confidence * (1 + Math.log10(bestScore + 1)) * 0.5),
    }
  }

  // ---- Stage 4: Build Incident ---------------------------------------

  /**
   * Constructs a fully formed {@link GeneratedIncident} from signals
   * and root cause inference.
   *
   * @param signals - Extracted signals.
   * @param rootCause - Inferred root cause.
   * @returns A generated incident ready for execution.
   */
  buildIncident(signals: SignalExtraction, rootCause: RootCauseInference): GeneratedIncident {
    const stages = this._buildStages(rootCause, signals)
    const description = this._buildDescription(rootCause, signals)

    return {
      id: generateId(),
      signals: signals.signals,
      rootCause,
      stages,
      description,
    }
  }

  // ---- Full Pipeline -------------------------------------------------

  /**
   * Runs the complete pipeline from raw logs to a generated incident.
   *
   * Equivalent to calling `parseLogs → extractSignals → inferRootCause → buildIncident`.
   *
   * @param input - Raw log input.
   * @returns A generated incident.
   */
  process(input: LogInput): GeneratedIncident {
    const parsed = this.parseLogs(input.logs)
    const signals = this.extractSignals(parsed)
    const rootCause = this.inferRootCause(signals)
    return this.buildIncident(signals, rootCause)
  }

  // ---- Private helpers -----------------------------------------------

  /**
   * Attempts to extract an ISO-like timestamp from a log line.
   * Matches patterns like `2024-01-15T10:30:00Z`, `2024-01-15 10:30:00`,
   * or common syslog formats.
   */
  private _extractTimestamp(line: string): string | undefined {
    // ISO 8601
    const iso = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/)
    if (iso) return iso[0]

    // Syslog-style "Apr 12 10:30:00"
    const syslog = line.match(/[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/)
    if (syslog) return syslog[0]

    // Unix timestamp
    const unix = line.match(/\b(1[7-9]\d{8}|[2-9]\d{9})\b/)
    if (unix) return new Date(parseInt(unix[0], 10) * 1000).toISOString()

    return undefined
  }

  /**
   * Extracts the log source/component from bracketed notation.
   * Matches `[nginx]`, `[db]`, `[app]`, etc.
   */
  private _extractSource(line: string): string | undefined {
    const match = line.match(/\[([^\]]+)\]/)
    return match ? match[1] : undefined
  }

  /**
   * Extracts the log level from common prefixes.
   */
  private _extractLevel(line: string): string | undefined {
    const upper = line.toUpperCase()
    for (const lvl of ["CRITICAL", "FATAL", "ERROR", "WARN", "WARNING", "INFO", "DEBUG", "TRACE"]) {
      if (upper.includes(lvl)) {
        return lvl === "WARNING" ? "WARN" : lvl
      }
    }
    return undefined
  }

  /**
   * Merges cascade layers from all matched signals, removing duplicates
   * while preserving order.
   */
  private _mergeCascades(signals: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []

    for (const signal of signals) {
      const mapping = ROOT_CAUSE_MAP[signal]
      if (mapping) {
        for (const layer of mapping.cascade) {
          if (!seen.has(layer)) {
            seen.add(layer)
            result.push(layer)
          }
        }
      }
    }

    return result
  }

  /**
   * Builds executable stages from root cause and signal data.
   * Each signal contributes at least one stage with environment-modifying actions.
   */
  private _buildStages(
    rootCause: RootCauseInference,
    signals: SignalExtraction
  ): Array<{ delay: number; actions: ((env: any) => void)[] }> {
    const stages: Array<{ delay: number; actions: ((env: any) => void)[] }> = []

    // Root cause stage
    stages.push({
      delay: 2000,
      actions: [applyRoot(rootCause.root)],
    })

    // Cascade stages
    for (let i = 0; i < rootCause.cascade.length; i++) {
      stages.push({
        delay: 2000 + (i + 1) * 1500,
        actions: [applyCascade(rootCause.cascade[i])],
      })
    }

    // Signal-specific stages
    for (let i = 0; i < signals.signals.length; i++) {
      const signal = signals.signals[i]
      stages.push({
        delay: 3000 + i * 2000,
        actions: [applySignal(signal, signals.frequencies[signal] || 1)],
      })
    }

    return stages
  }

  /**
   * Builds a human-readable description from root cause and signals.
   */
  private _buildDescription(rootCause: RootCauseInference, signals: SignalExtraction): string {
    const rootLabel = rootCause.root.charAt(0).toUpperCase() + rootCause.root.slice(1)
    const cascadeStr = rootCause.cascade.length > 0 ? rootCause.cascade.join(" → ") : "none"
    const signalStr = signals.signals.join(", ") || "none detected"

    return (
      `Root cause: ${rootLabel} (confidence: ${(rootCause.confidence * 100).toFixed(0)}%). ` +
      `Affected cascade: ${cascadeStr}. ` +
      `Detected signals: ${signalStr}.`
    )
  }
}

// ---- Action factories ------------------------------------------------

/**
 * Creates an action that applies the root cause to the environment.
 *
 * @param root - The root cause category.
 * @returns An environment-modifying function.
 */
export function applyRoot(root: RootCauseInference["root"]): (env: any) => void {
  switch (root) {
    case "network":
      return (env: any) => {
        if (!env.network) env.network = {}
        env.network.rootCause = "network"
        env.network.latencyMs = (env.network.latencyMs || 0) + 100
        if (Array.isArray(env.logs)) {
          env.logs.push("[root-cause] network degradation detected — elevated latency baseline")
        }
      }
    case "storage":
      return (env: any) => {
        if (!env.storage) env.storage = {}
        env.storage.rootCause = "storage"
        env.storage.iopsDegraded = true
        if (Array.isArray(env.logs)) {
          env.logs.push("[root-cause] storage subsystem degradation — IOPS dropping")
        }
      }
    case "app":
      return (env: any) => {
        if (!env.services) env.services = {}
        env.services.rootCause = "app"
        env.services.appStatus = "degraded"
        if (Array.isArray(env.logs)) {
          env.logs.push("[root-cause] application layer failure detected")
        }
      }
    case "auth":
      return (env: any) => {
        if (!env.auth) env.auth = {}
        env.auth.rootCause = "auth"
        env.auth.authFailures = true
        if (Array.isArray(env.logs)) {
          env.logs.push("[root-cause] authentication subsystem failure")
        }
      }
    case "unknown":
    default:
      return (env: any) => {
        if (Array.isArray(env.logs)) {
          env.logs.push("[root-cause] unable to determine root cause — manual investigation required")
        }
      }
  }
}

/**
 * Creates an action that applies cascade effects to a specific layer.
 *
 * @param layer - The affected system layer (e.g. "db", "app", "network").
 * @returns An environment-modifying function.
 */
export function applyCascade(layer: string): (env: any) => void {
  return (env: any) => {
    switch (layer.toLowerCase()) {
      case "db":
        if (!env.db) env.db = {}
        env.db.cascadeAffected = true
        env.db.lag = (env.db.lag || 0) + 500
        if (Array.isArray(env.logs)) {
          env.logs.push("[cascade] database layer affected — replication lag increasing")
        }
        break
      case "app":
        if (!env.services) env.services = {}
        env.services.cascadeAffected = true
        env.services.appStatus = env.services.appStatus === "down" ? "down" : "degraded"
        if (Array.isArray(env.logs)) {
          env.logs.push("[cascade] application layer degradation propagating")
        }
        break
      case "network":
        if (!env.network) env.network = {}
        env.network.cascadeAffected = true
        env.network.latencyMs = (env.network.latencyMs || 0) + 200
        if (Array.isArray(env.logs)) {
          env.logs.push("[cascade] network layer affected — additional latency introduced")
        }
        break
      case "storage":
        if (!env.storage) env.storage = {}
        env.storage.cascadeAffected = true
        env.storage.usagePct = Math.min(100, (env.storage.usagePct || 0) + 5)
        if (Array.isArray(env.logs)) {
          env.logs.push("[cascade] storage layer affected — disk usage climbing")
        }
        break
      default:
        if (Array.isArray(env.logs)) {
          env.logs.push(`[cascade] unknown layer "${layer}" affected`)
        }
    }
  }
}

/**
 * Creates an action that applies a specific signal to the environment.
 *
 * @param signal - The signal identifier.
 * @param frequency - How many times this signal was detected.
 * @returns An environment-modifying function.
 */
function applySignal(signal: string, frequency: number): (env: any) => void {
  return (env: any) => {
    if (!env.signals) env.signals = {}
    env.signals[signal] = (env.signals[signal] || 0) + frequency

    const logMsgs: Record<string, string> = {
      upstream_down: `[signal] upstream_down detected (${frequency}x) — connection refused`,
      latency_issue: `[signal] latency_issue detected (${frequency}x) — timeout patterns`,
      disk_full: `[signal] disk_full detected (${frequency}x) — no space left on device`,
      auth_issue: `[signal] auth_issue detected (${frequency}x) — permission denied`,
      disk_failure: `[signal] disk_failure detected (${frequency}x) — I/O errors`,
      memory_issue: `[signal] memory_issue detected (${frequency}x) — out of memory`,
      crash: `[signal] crash detected (${frequency}x) — segmentation fault`,
      ssl_issue: `[signal] ssl_issue detected (${frequency}x) — certificate expired`,
    }

    const msg = logMsgs[signal] || `[signal] ${signal} detected (${frequency}x)`
    if (Array.isArray(env.logs)) {
      env.logs.push(msg)
    }
  }
}

// ---- Factory export --------------------------------------------------

/**
 * Creates a new {@link LogIncidentPipeline} instance.
 *
 * @returns A ready-to-use log-to-incident pipeline.
 */
export function createLogIncidentPipeline(): LogIncidentPipeline {
  return new LogIncidentPipeline()
}
