// Protects code/log tokens from being translated, restores them after.
export function protect(text) {
  const tokens = [];
  let i = 0;
  const protectedText = text.replace(
    /`[^`]*`|"[^"]*"|'[^']*'|\$\{[^}]*\}|\b[A-Z][A-Z_0-9]{2,}\b|:\s*\d+|\/[a-z][a-z0-9/_.-]+/g,
    (match) => {
      const key = `__TK${i++}__`;
      tokens.push({ key, value: match });
      return key;
    }
  );
  return { protectedText, tokens };
}

export function restore(text, tokens) {
  let result = text;
  for (const t of tokens) {
    result = result.replaceAll(t.key, t.value);
  }
  return result;
}
