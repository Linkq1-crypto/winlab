export function pickVariant(testName, variants) {
  if (typeof window === "undefined" || !Array.isArray(variants) || variants.length === 0) {
    return variants?.[0] ?? null;
  }

  const key = `ab:${testName}`;
  const existing = window.localStorage.getItem(key);

  if (existing && variants.includes(existing)) {
    return existing;
  }

  const selected = variants[Math.floor(Math.random() * variants.length)];
  window.localStorage.setItem(key, selected);
  return selected;
}
