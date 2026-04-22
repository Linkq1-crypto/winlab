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

export default { buildPrompt };
