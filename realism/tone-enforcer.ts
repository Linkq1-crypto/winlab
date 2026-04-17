/**
 * Tone Enforcer — enforces UX writing rules modelled after Stripe / Linear.
 * Browser-compatible: no Node.js `fs` usage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single tone rule that can be evaluated against a string. */
export interface ToneRule {
  /** Unique identifier for the rule. */
  id: string
  /** Human-readable name. */
  name: string
  /** Returns `true` when the text passes the rule. */
  check: (text: string) => boolean
  /** Optional fix function that returns corrected text. */
  fix?: (text: string) => string
  /** Severity — `"error"` blocks, `"warn"` is advisory. */
  severity: "warn" | "error"
}

/** A single tone violation detected during enforcement. */
export interface ToneViolation {
  /** The rule that was violated. */
  rule: string
  /** The offending text. */
  text: string
  /** Corrected text, if a fix function was available. */
  fixed?: string
  /** Severity of the violation. */
  severity: "warn" | "error"
}

/** Result returned after running tone enforcement on a string. */
export interface ToneResult {
  /** Whether all rules passed. */
  passed: boolean
  /** List of violations found. */
  violations: ToneViolation[]
  /** Additional human-readable suggestions. */
  suggestions: string[]
}

// ---------------------------------------------------------------------------
// Default rewrite maps
// ---------------------------------------------------------------------------

/** Error-phrase rewrites. */
const ERROR_REWRITES: [RegExp, string][] = [
  [/an error occurred/i, "Something went wrong"],
  [/please try again/i, "Try again"],
  [/connection refused/i, "Connection refused"],
  [/server error occurred/i, "Server error"],
]

/** CTA-phrase rewrites. */
const CTA_REWRITES: [RegExp, string][] = [
  [/click here to start/i, "Start now"],
  [/proceed/i, "Continue"],
  [/click here/i, "Open"],
]

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

/** Build the default set of tone rules. */
function defaultRules(): ToneRule[] {
  const fluffWords = ["very", "really", "just", "please"]
  const jargonWords = ["utilize", "facilitate", "leverage"]
  const actionVerbs = ["start", "run", "try", "check", "fix", "open", "continue", "save", "cancel", "delete", "create", "edit", "update", "remove", "add", "view", "download", "upload", "send", "confirm"]

  return [
    {
      id: "max_12_words",
      name: "Maximum 12 words",
      check: (text: string) => text.split(/\s+/).filter(Boolean).length <= 12,
      severity: "warn",
    },
    {
      id: "no_fluff",
      name: "No fluff words",
      check: (text: string) => {
        const lower = text.toLowerCase()
        return !fluffWords.some((w) => lower.includes(w))
      },
      severity: "warn",
    },
    {
      id: "action_first",
      name: "CTA starts with a verb",
      check: (text: string) => {
        const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
        return actionVerbs.includes(firstWord)
      },
      severity: "warn",
    },
    {
      id: "no_passive",
      name: "Avoid passive voice",
      check: (text: string) => {
        const lower = text.toLowerCase()
        return !/is being|was |has been|have been|were /i.test(lower)
      },
      severity: "warn",
    },
    {
      id: "error_friendly",
      name: "Friendly error messages",
      check: (text: string) => {
        const lower = text.toLowerCase()
        return !/an error occurred|please try again|server error occurred/i.test(
          lower
        )
      },
      fix: (text: string) => {
        let result = text
        for (const [pattern, replacement] of ERROR_REWRITES) {
          result = result.replace(pattern, replacement)
        }
        return result
      },
      severity: "error",
    },
    {
      id: "no_jargon",
      name: "No corporate jargon",
      check: (text: string) => {
        const lower = text.toLowerCase()
        return !jargonWords.some((w) => lower.includes(w))
      },
      severity: "warn",
    },
    {
      id: "capitalize_first",
      name: "First letter must be uppercase",
      check: (text: string) => {
        const trimmed = text.trim()
        return trimmed.length === 0 || trimmed[0] === trimmed[0].toUpperCase()
      },
      severity: "warn",
    },
  ]
}

// ---------------------------------------------------------------------------
// ToneEnforcer class
// ---------------------------------------------------------------------------

/**
 * Enforces UX writing tone rules on strings.
 *
 * Ships with a default set of rules modelled after Stripe/Linear style.
 * Custom rules can be added via `addRule()`.
 */
export class ToneEnforcer {
  private rules: ToneRule[]

  constructor() {
    this.rules = defaultRules()
  }

  /**
   * Apply all rules to the given text and return a result.
   */
  enforce(text: string): ToneResult {
    const violations: ToneViolation[] = []
    const suggestions: string[] = []

    for (const rule of this.rules) {
      if (!rule.check(text)) {
        const violation: ToneViolation = {
          rule: rule.name,
          text,
          severity: rule.severity,
        }
        if (rule.fix) {
          violation.fixed = rule.fix(text)
        }
        violations.push(violation)
      }
    }

    // Apply error & CTA rewrites as suggestions even when no rule fires
    for (const [pattern, replacement] of [...ERROR_REWRITES, ...CTA_REWRITES]) {
      if (pattern.test(text)) {
        suggestions.push(`Consider: "${text.replace(pattern, replacement)}"`)
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      suggestions,
    }
  }

  /**
   * Fix text by applying every applicable `fix` function from all rules.
   *
   * Also applies the global error and CTA rewrite maps.
   */
  fixText(text: string): string {
    let result = text

    // Apply per-rule fixes
    for (const rule of this.rules) {
      if (rule.fix && !rule.check(result)) {
        result = rule.fix(result)
      }
    }

    // Apply global rewrites
    for (const [pattern, replacement] of [...ERROR_REWRITES, ...CTA_REWRITES]) {
      result = result.replace(pattern, replacement)
    }

    return result
  }

  /**
   * Add a custom rule to the enforcement set.
   */
  addRule(rule: ToneRule): void {
    this.rules.push(rule)
  }

  /**
   * Return a copy of all currently registered rules.
   */
  getRules(): ToneRule[] {
    return [...this.rules]
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a `ToneEnforcer` instance pre-loaded with all default rules.
 */
export function createToneEnforcer(): ToneEnforcer {
  return new ToneEnforcer()
}
