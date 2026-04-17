/**
 * Language Gate — enforces English + Hinglish only across UI strings.
 * Browser-compatible: no Node.js `fs` usage.
 */

/** Represents a single language violation found during scanning. */
export interface LanguageViolation {
  /** The file path where the violation was found. */
  file: string
  /** The offending text snippet. */
  text: string
  /** The detected non-allowed language (e.g. "it", "fr", "de", "es"). */
  detectedLang: string
  /** 1-based line number, if available. */
  line?: number
}

/** Result returned after scanning content for language compliance. */
export interface LanguageCheckResult {
  /** Whether all strings passed the language check. */
  passed: boolean
  /** List of detected violations. */
  violations: LanguageViolation[]
  /** Total number of strings examined. */
  totalStrings: number
  /** Number of strings that passed validation. */
  validStrings: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default path segments to exclude from scanning (legal/compliance pages). */
export const DEFAULT_EXCLUDED: string[] = [
  "tos",
  "privacy",
  "gdpr",
  "legal",
  "ipdata",
  "terms",
]

/** Common Hinglish word hints — if one is present the string may be Hinglish. */
export const HINGLISH_HINTS: string[] = [
  "hai",
  "kar",
  "kya",
  "nahi",
  "bhai",
  "yaar",
  "kaise",
]

/** Regex patterns that signal a non-English, non-Hinglish language. */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /non valido/i,        // Italian
  /connexion refusée/i, // French
  /fehler/i,            // German
  /error de/i,          // Spanish
  /connessione/i,       // Italian
  /configurazione/i,    // Italian
  /serveur/i,           // French
  /archivo/i,           // Spanish
  /nicht/i,             // German
]

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a text is English, Hinglish, or some other language.
 *
 * - Checks forbidden patterns first (returns `"other"` with the matched
 *   language code).
 * - Then checks Hinglish hints (returns `"hinglish"`).
 * - Falls back to `"english"`.
 */
export function detectLanguage(text: string): "english" | "hinglish" | "other" {
  // 1. Forbidden patterns → other
  const forbiddenMatch = hasForbiddenPattern(text)
  if (forbiddenMatch.matched) return "other"

  // 2. Hinglish hints → hinglish
  const lower = text.toLowerCase()
  if (HINGLISH_HINTS.some((hint) => lower.includes(hint))) return "hinglish"

  // 3. Default → english
  return "english"
}

/**
 * Check whether the text matches any forbidden pattern.
 *
 * @returns Object with `matched` flag and, when matched, the language code
 *          of the first matched pattern.
 */
export function hasForbiddenPattern(
  text: string
): { matched: boolean; pattern?: string } {
  const langMap: Record<string, string> = {
    "non valido": "it",
    "connexion refusée": "fr",
    fehler: "de",
    "error de": "es",
    connessione: "it",
    configurazione: "it",
    serveur: "fr",
    archivo: "es",
    nicht: "de",
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      const key = pattern.source.replace(/[^a-zàèéìòù ]/gi, "").toLowerCase()
      return { matched: true, pattern: langMap[key] ?? "unknown" }
    }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// String extraction & scanning
// ---------------------------------------------------------------------------

/**
 * Extract translatable strings from raw file content.
 *
 * Strategy: pulls out anything between quotes (single or double), template
 * literal fragments, and JSX text nodes. Deduplicates and filters out tokens
 * shorter than 2 characters, pure numbers, and whitespace-only strings.
 */
export function extractStringsFromContent(content: string): string[] {
  const matches: string[] = []

  // Double-quoted strings
  matches.push(...[...(content.match(/"([^"\\]|\\.)*"/g) ?? [])].map((s) =>
    s.slice(1, -1)
  ))

  // Single-quoted strings
  matches.push(...[...(content.match(/'([^'\\]|\\.)*'/g) ?? [])].map((s) =>
    s.slice(1, -1)
  ))

  // Template literal segments
  matches.push(
    ...[...(content.match(/`([^`\\]|\\.)*`/g) ?? [])].map((s) =>
      s.slice(1, -1)
    )
  )

  // JSX text nodes — between > and < (strip tags, keep inner text)
  const jsxMatches = content.match(/>([^<>{}]+)</g) ?? []
  matches.push(
    ...jsxMatches
      .map((s) => s.slice(1, -1).trim())
      .filter(Boolean)
  )

  // Deduplicate, filter noise
  const seen = new Set<string>()
  return matches.filter((s) => {
    const trimmed = s.trim()
    if (trimmed.length < 2) return false
    if (/^\d+$/.test(trimmed)) return false
    if (/^\s+$/.test(trimmed)) return false
    if (seen.has(trimmed)) return false
    seen.add(trimmed)
    return true
  })
}

/**
 * Scan file content for language violations.
 *
 * @param content   – Raw file content as a string.
 * @param filePath  – Path used for violation reporting.
 * @param options   – Optional config (excluded path segments).
 */
export function scanContent(
  content: string,
  filePath: string,
  options?: { excludedPaths?: string[] }
): LanguageCheckResult {
  const excluded = options?.excludedPaths ?? DEFAULT_EXCLUDED
  if (excluded.some((seg) => filePath.toLowerCase().includes(seg.toLowerCase()))) {
    return { passed: true, violations: [], totalStrings: 0, validStrings: 0 }
  }

  const strings = extractStringsFromContent(content)
  const violations: LanguageViolation[] = []
  let validCount = 0

  for (const str of strings) {
    const lang = detectLanguage(str)
    if (lang === "other") {
      const info = hasForbiddenPattern(str)
      violations.push({
        file: filePath,
        text: str,
        detectedLang: info.pattern ?? "unknown",
      })
    } else {
      validCount++
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    totalStrings: strings.length,
    validStrings: validCount,
  }
}

/**
 * Convenience wrapper: validate language for a single file's content.
 * Identical to `scanContent` but with a simpler signature.
 */
export function validateLanguage(
  content: string,
  filePath: string
): LanguageCheckResult {
  return scanContent(content, filePath)
}
