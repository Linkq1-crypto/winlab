import { getLabConfig } from "../config/labCatalog.js";

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

export function buildPrompt({ lab, mode = "review" }) {
  const scopeLines = (lab.scope || []).map((s) => `- ${s}`).join("\n");
  const entryLines = (lab.entryPoints || []).map((e) => `- ${e}`).join("\n");

  if (mode === "review") {
    return `
You are inside a real repository.

Work only on:

${scopeLines}

Start from:
${entryLines}

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

  return `
Work only on:

${scopeLines}

Entry point:
${entryLines}

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
}) {
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
