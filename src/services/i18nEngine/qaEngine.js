// Static QA — no LLM required.
export function runStaticChecks(itLab, enLab) {
  const errors = [];

  // Structure match
  const itKeys = JSON.stringify(Object.keys(itLab.content || {}));
  const enKeys = JSON.stringify(Object.keys(enLab.content || {}));
  if (itKeys !== enKeys) errors.push(`Structure mismatch: IT keys=${itKeys} EN keys=${enKeys}`);

  // Token leak
  if (JSON.stringify(enLab).includes('__TK')) errors.push('Token leak detected in output');

  // Tasks count
  if (Array.isArray(itLab.content?.tasks) && Array.isArray(enLab.content?.tasks)) {
    if (itLab.content.tasks.length !== enLab.content.tasks.length)
      errors.push('Tasks array length mismatch');
  }

  // Non-translatable preserved
  const nonTr = itLab.non_translatable || {};
  for (const [field, values] of Object.entries(nonTr)) {
    const enStr = JSON.stringify(enLab);
    for (const v of (Array.isArray(values) ? values : [values])) {
      if (!enStr.includes(v)) errors.push(`Non-translatable value missing: ${v}`);
    }
  }

  return errors;
}

export function qaScore(errors) {
  if (errors.length === 0) return 100;
  return Math.max(0, 100 - errors.length * 20);
}
