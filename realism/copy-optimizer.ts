// ============================================================
// Copy Optimizer — UX copy classification, rewriting, variant
// generation, and scoring.
// ============================================================

export type CopyType = "error" | "cta" | "tooltip" | "generic";

export interface CopyVariant {
  text: string;
  score: number;
  type: CopyType;
}

export interface OptimizationResult {
  original: string;
  optimized: string;
  type: CopyType;
  variants: CopyVariant[];
  score: number;
}

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

const ERROR_PATTERNS = [/error/i, /failed/i, /broken/i];
const CTA_PATTERNS = [/^start/i, /^try/i, /^run/i, /^click/i, /now/i, /here/i];
const TOOLTIP_MAX = 80;

// ---------------------------------------------------------------------------
// Rewrite maps
// ---------------------------------------------------------------------------

const ERROR_REWRITES: [RegExp, string][] = [
  [/an error occurred while processing your request/i, "Something went wrong"],
  [/please try again later/i, "Try again"],
  [/the server has encountered an error/i, "Server error"],
  [/connection was refused/i, "Connection refused"],
];

const CTA_REWRITES: [RegExp, string][] = [
  [/click here to start the simulation/i, "Start now"],
  [/please proceed to the next step/i, "Continue"],
  [/you can try the demo/i, "Try the demo"],
  [/click here to view details/i, "View details"],
];

const TOOLTIP_MAX_CHARS = 40;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const ACTION_VERBS = [
  "start", "run", "try", "check", "fix", "open", "continue", "save",
  "cancel", "delete", "create", "edit", "update", "remove", "add",
  "view", "download", "upload", "send", "confirm",
];

const FLUFF_WORDS = ["very", "really"];

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class CopyOptimizer {
  // ---- Full pipeline ---------------------------------------------------

  /**
   * Run the full optimisation pipeline on a single string.
   */
  optimize(text: string): OptimizationResult {
    const type = this.classify(text);
    const variants = this.generateVariants(text, type).map((v) => ({
      text: v,
      score: this.score(v),
      type,
    }));
    const optimized = this.pickBestFromVariants(variants);
    return {
      original: text,
      optimized,
      type,
      variants,
      score: this.score(optimized),
    };
  }

  // ---- Individual steps ------------------------------------------------

  /**
   * Classify a string into one of the four copy types.
   */
  classify(text: string): CopyType {
    if (ERROR_PATTERNS.some((p) => p.test(text))) return "error";
    if (CTA_PATTERNS.some((p) => p.test(text))) return "cta";
    if (text.length < TOOLTIP_MAX) return "tooltip";
    return "generic";
  }

  /**
   * Rewrite a string according to its classified type.
   */
  rewrite(text: string, type: CopyType): string {
    let result = text;

    if (type === "error") {
      for (const [pattern, replacement] of ERROR_REWRITES) {
        result = result.replace(pattern, replacement);
      }
    }

    if (type === "cta") {
      for (const [pattern, replacement] of CTA_REWRITES) {
        result = result.replace(pattern, replacement);
      }
    }

    if (type === "tooltip") {
      // Truncate to first sentence
      const firstSentence = result.split(/[.!?]/)[0]?.trim() ?? result;
      result = firstSentence;
      // Remove trailing punctuation
      result = result.replace(/[.,;:!?]+$/, "");
      // Max 40 chars
      if (result.length > TOOLTIP_MAX_CHARS) {
        result = result.slice(0, TOOLTIP_MAX_CHARS).trim();
      }
    }

    return result;
  }

  /**
   * Generate candidate variants for a string.
   */
  generateVariants(text: string, type: CopyType): string[] {
    const variants: string[] = [];

    // Always include the rewritten version
    variants.push(this.rewrite(text, type));

    // Generate additional variants based on type
    if (type === "error") {
      variants.push(text.replace(/please /gi, "").replace(/the /gi, "").trim());
      variants.push(text.charAt(0).toUpperCase() + text.slice(1));
    }

    if (type === "cta") {
      // Strip leading polite words
      variants.push(text.replace(/^(please |kindly )/i, "").trim());
      // Shortened version
      const words = text.split(/\s+/);
      if (words.length > 3) {
        variants.push(words.slice(0, 3).join(" "));
      }
    }

    if (type === "tooltip") {
      variants.push(text.split(/\s+/).slice(0, 5).join(" "));
      variants.push(text.toLowerCase());
    }

    if (type === "generic") {
      variants.push(text.replace(/\b(very|really)\b/gi, "").replace(/\s+/g, " ").trim());
      variants.push(text.charAt(0).toUpperCase() + text.slice(1));
    }

    // Deduplicate
    return [...new Set(variants)];
  }

  /**
   * Score a string on a 0–1 scale.
   *
   * - length < 40 → +0.3
   * - starts with action verb → +0.3
   * - no "very"/"really" → +0.2
   * - no "please" → +0.2
   */
  score(text: string): number {
    let s = 0;

    if (text.length < 40) s += 0.3;

    const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (ACTION_VERBS.includes(firstWord)) s += 0.3;

    const lower = text.toLowerCase();
    if (!FLUFF_WORDS.some((w) => lower.includes(w))) s += 0.2;
    if (!lower.includes("please")) s += 0.2;

    return Math.min(1, s);
  }

  /**
   * Pick the highest-scoring variant from a list of strings.
   */
  pickBest(variants: string[]): string {
    if (variants.length === 0) return "";
    if (variants.length === 1) return variants[0];

    let best = variants[0];
    let bestScore = this.score(best);

    for (let i = 1; i < variants.length; i++) {
      const s = this.score(variants[i]);
      if (s > bestScore) {
        best = variants[i];
        bestScore = s;
      }
    }
    return best;
  }

  /**
   * Pick the highest-scoring variant from scored CopyVariant objects.
   */
  private pickBestFromVariants(variants: CopyVariant[]): string {
    if (variants.length === 0) return "";
    let best = variants[0];
    for (let i = 1; i < variants.length; i++) {
      if (variants[i].score > best.score) best = variants[i];
    }
    return best.text;
  }

  // ---- Batch optimization ----------------------------------------------

  /**
   * Optimize a batch of strings in one call.
   */
  optimizeBatch(texts: string[]): OptimizationResult[] {
    return texts.map((t) => this.optimize(t));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCopyOptimizer(): CopyOptimizer {
  return new CopyOptimizer();
}
