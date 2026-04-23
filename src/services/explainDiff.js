export function explainDiff(diff) {
  const lines = String(diff || "").split("\n");
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }

  return `
Patch summary:
- ${added} lines added
- ${removed} lines removed

Focus:
- minimal change strategy
- likely bug fix in scoped files

Review manually for:
- logic correctness
- edge cases
- unintended side effects
`.trim();
}

export default explainDiff;
