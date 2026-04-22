// winlab/src/services/aiRouter.js
import crypto from "crypto";

/**
 * In-memory cache semplice.
 * In produzione puoi sostituirla con Redis.
 */
const responseCache = new Map();

/**
 * Cache TTL default: 10 minuti
 */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * Crea una chiave cache stabile.
 */
function makeCacheKey({
  tenantId,
  labId,
  mode,
  repoCommit,
  scope,
  promptVersion = "v1",
  promptSignature = "",
  contextSignature = "",
}) {
  const raw = JSON.stringify({
    tenantId,
    labId,
    mode,
    repoCommit,
    scope: [...scope].sort(),
    promptVersion,
    promptSignature,
    contextSignature,
  });

  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getCached(key) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value, ttlMs = DEFAULT_TTL_MS) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Normalizza e limita scope.
 * Regola forte: max 3 file/path per chiamata.
 */
function normalizeScope(scope = [], maxItems = 3) {
  if (!Array.isArray(scope)) return [];
  return scope
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Crea una firma leggera del contesto.
 * Evita di mettere dentro log enormi.
 */
function buildContextSignature(context = {}) {
  const compact = {
    error: context.error || "",
    endpoint: context.endpoint || "",
    latency: context.latency || "",
    statusCode: context.statusCode || "",
    fileHint: context.fileHint || "",
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(compact))
    .digest("hex");
}

/**
 * Template review: stretto, niente refactor larghi.
 */
function buildReviewPrompt({ lab, scope, context }) {
  return `
You are reviewing a bounded incident lab.

Allowed scope:
${scope.map((s) => `- ${s}`).join("\n")}

Lab:
- id: ${lab.id}
- title: ${lab.title || lab.id}

Incident context:
- error: ${context.error || "n/a"}
- endpoint: ${context.endpoint || "n/a"}
- latency: ${context.latency || "n/a"}
- statusCode: ${context.statusCode || "n/a"}
- fileHint: ${context.fileHint || "n/a"}

Goal:
- identify the single most likely root cause
- suggest the smallest safe fix

Rules:
- do not propose broad refactors
- do not touch files outside allowed scope
- be concise

Return only:
1. root cause
2. minimal fix plan
3. files to inspect
`.trim();
}

/**
 * Template patch: diff minimo, niente dipendenze nuove.
 */
function buildPatchPrompt({ lab, scope, context }) {
  return `
You are patching a bounded incident lab.

Allowed scope:
${scope.map((s) => `- ${s}`).join("\n")}

Lab:
- id: ${lab.id}
- title: ${lab.title || lab.id}

Incident context:
- error: ${context.error || "n/a"}
- endpoint: ${context.endpoint || "n/a"}
- latency: ${context.latency || "n/a"}
- statusCode: ${context.statusCode || "n/a"}
- fileHint: ${context.fileHint || "n/a"}

Constraints:
- minimal diff only
- no new dependencies
- no changes outside allowed scope
- preserve project style
- do not add network calls
- do not access secrets

Return only a unified diff.
`.trim();
}

/**
 * Routing:
 * - review: può essere cachata aggressivamente
 * - patch: cachata ma con TTL più corto
 */
export function createAIRouter({
  runCodexReview,
  runCodexPatch,
  getRepoCommit,
  logger = console,
}) {
  if (typeof runCodexReview !== "function") {
    throw new Error("runCodexReview is required");
  }
  if (typeof runCodexPatch !== "function") {
    throw new Error("runCodexPatch is required");
  }
  if (typeof getRepoCommit !== "function") {
    throw new Error("getRepoCommit is required");
  }

  return {
    /**
     * input:
     * {
     *   tenantId,
     *   userId,
     *   lab,
     *   mode: "review" | "patch",
     *   context
     * }
     */
    async run(input) {
      const { tenantId, userId, lab, mode, context = {}, customPrompt } = input || {};

      if (!tenantId) throw new Error("tenantId is required");
      if (!userId) throw new Error("userId is required");
      if (!lab?.id) throw new Error("lab.id is required");
      if (mode !== "review" && mode !== "patch") {
        throw new Error("mode must be review or patch");
      }

      const scope = normalizeScope(lab.scope || []);
      if (scope.length === 0) {
        throw new Error(`Lab ${lab.id} has empty scope`);
      }

      const customPromptText = String(customPrompt || "").trim();
      const promptSignature = customPromptText
        ? crypto.createHash("sha256").update(customPromptText).digest("hex")
        : "";
      const repoCommit = await getRepoCommit(lab);
      const contextSignature = buildContextSignature(context);

      const cacheKey = makeCacheKey({
        tenantId,
        labId: lab.id,
        mode,
        repoCommit,
        scope,
        promptVersion: customPromptText ? "custom:v1" : "v1",
        promptSignature,
        contextSignature,
      });

      const cached = getCached(cacheKey);
      if (cached) {
        logger.info?.({
          event: "ai.cache_hit",
          tenantId,
          userId,
          labId: lab.id,
          mode,
        });

        return {
          ...cached,
          cached: true,
        };
      }

      const prompt = customPromptText || (
        mode === "review"
          ? buildReviewPrompt({ lab, scope, context })
          : buildPatchPrompt({ lab, scope, context })
      );

      const startedAt = Date.now();
      let result;

      if (mode === "review") {
        result = await runCodexReview({
          tenantId,
          userId,
          labId: lab.id,
          scope,
          prompt,
          repoRoot: lab.repoRoot,
        });
      } else {
        result = await runCodexPatch({
          tenantId,
          userId,
          labId: lab.id,
          scope,
          prompt,
          repoRoot: lab.repoRoot,
        });
      }

      const durationMs = Date.now() - startedAt;

      const response = {
        mode,
        labId: lab.id,
        scope,
        repoCommit,
        durationMs,
        result,
        cached: false,
      };

      setCached(cacheKey, response, mode === "review" ? 15 * 60 * 1000 : 3 * 60 * 1000);

      logger.info?.({
        event: "ai.run_success",
        tenantId,
        userId,
        labId: lab.id,
        mode,
        durationMs,
        scopeCount: scope.length,
      });

      return response;
    },
  };
}

export default { createAIRouter };
