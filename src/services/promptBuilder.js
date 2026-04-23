import { getLabConfig } from "../config/labCatalog.js";
import { getLevelConfig } from "../config/levels.js";

function getIssueGuidance(issueType) {
  switch (issueType) {
    case "ssl":
      return "Focus on certificate paths, protocol mismatch, TLS config, and server startup errors.";
    case "database":
      return "Focus on connection settings, startup ordering, credentials, and DB readiness.";
    case "filesystem":
      return "Focus on disk pressure, cleanup logic, write failures, and recovery safety.";
    case "ui-terminal":
      return "Focus on terminal state, command handling, rendering glitches, and interaction regressions.";
    case "terminal":
      return "Focus on shell simulation, parser behavior, command execution flow, and output correctness.";
    case "performance-memory":
      return "Focus on retained references, intervals, listeners, caches, unbounded arrays, and leak sources.";
    case "network-port":
      return "Focus on binding conflicts, service startup order, exposed ports, and process collisions.";
    case "permissions":
      return "Focus on ownership, chmod/chown usage, privilege boundaries, and least-privilege fixes.";
    case "storage":
      return "Focus on degraded arrays, device state transitions, rebuild behavior, and data safety.";
    case "infra-runtime":
      return "Focus on boot/runtime failures, process startup, env assumptions, and service orchestration.";
    case "auth-directory":
      return "Focus on LDAP config, SSSD settings, PAM/NSS flow, and authentication connectivity.";
    case "auth":
      return "Focus on authorization checks, token trust boundaries, role validation, and server-side enforcement.";
    case "payments":
      return "Focus on webhook verification, signature handling, raw payload usage, and payment safety.";
    case "generic":
    default:
      return "Focus on the most likely root cause and the smallest safe fix.";
  }
}

function levelInstruction(level) {
  if (level.ai.verbosity === "high") return "Explain step by step and name the key evidence.";
  if (level.ai.verbosity === "medium") return "Explain only the key reasoning and the safest next action.";
  if (level.ai.verbosity === "low") return "Be concise. State only the root cause and minimal action.";
  return "Do not provide AI assistance for this level.";
}

function buildLevelSection(level) {
  return `
Level:
- id: ${level.id}
- label: ${level.label}
- verbosity: ${level.ai.verbosity}
- explanation: ${level.ai.explainDepth}

Level instructions:
${levelInstruction(level)}
`.trim();
}

export function buildPrompt({ lab, mode = "review", level: levelInput = "JUNIOR" }) {
  const level = getLevelConfig(levelInput?.id || levelInput);
  const scopeLines = (lab.scope || []).map((s) => `- ${s}`).join("\n");
  const entryLines = (lab.entryPoints || []).map((e) => `- ${e}`).join("\n");

  if (mode === "review") {
    return `
You are inside a real repository.

Work only on:

${scopeLines}

Start from:
${entryLines}

${buildLevelSection(level)}

Task:
Explain what this lab does and identify the root cause of the issue.

Constraints:
- do not scan the entire repository
- expand only if necessary
- be concise

Return:
1. short explanation
2. root cause
`.trim();
  }

  if (!level.ai.allowPatch) {
    throw new Error("Patch not allowed in this level");
  }

  return `
Work only on:

${scopeLines}

Entry point:
${entryLines}

${buildLevelSection(level)}

Task:
Fix the issue with a minimal patch.

Constraints:
- minimal diff
- no full repo scan
- no unrelated changes

Return only a unified diff.
`.trim();
}

export function buildLabPrompt({
  labId,
  mode = "review",
  failureContext = null,
  lab: labOverride = null,
  level: levelInput = "JUNIOR",
}) {
  const level = getLevelConfig(levelInput?.id || levelInput);
  const catalogLab = getLabConfig(labId);
  const lab = {
    ...catalogLab,
    ...(labOverride || {}),
  };

  if (!catalogLab && !labOverride) {
    throw new Error(`Unknown labId: ${labId}`);
  }

  if (!["review", "patch"].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  if (mode === "patch" && !level.ai.allowPatch) {
    throw new Error("Patch not allowed in this level");
  }

  const scopeText = (lab.scope || []).map((item) => `- ${item}`).join("\n");
  const entryText = (lab.entryPoints || []).map((item) => `- ${item}`).join("\n");
  const issueGuidance = getIssueGuidance(lab.issueType);
  const retrySection = failureContext
    ? `
Previous attempt failed verification.

Failure context:
- verifyOk: ${String(failureContext.verifyOk)}
- timeout: ${String(!!failureContext.timeout)}
- outputSnippet: ${String(failureContext.outputSnippet || "").slice(0, 400)}

Do not repeat the same mistake. Adjust the patch based on the failed verification.
`.trim()
    : "";

  if (mode === "review") {
    return `
You are inside a real repository.

Work only on:
${scopeText}

Start from:
${entryText}

${buildLevelSection(level)}

Task:
Explain what this lab does and identify the most likely root cause.

Guidance:
${issueGuidance}
${lab.verifyHint || ""}

Constraints:
- do not scan the entire repository
- expand only if necessary
- do not propose broad refactors

Return only:
1. short explanation
2. root cause
3. smallest safe fix plan
`.trim();
  }

  return `
You are inside a real repository.

Work only on:
${scopeText}

Start from:
${entryText}

${buildLevelSection(level)}

Task:
Fix the issue with a minimal patch.

Guidance:
${issueGuidance}
${lab.verifyHint || ""}

Constraints:
- minimal diff only
- no unrelated refactors
- no new dependencies
- do not modify files outside scope
- preserve project style

${retrySection}

Return ONLY a unified diff.
`.trim();
}

export const _test = { getIssueGuidance };

export default { buildLabPrompt, buildPrompt };
