import { applyGlossary } from './glossary.js';

// Rule-based fallback when LLM is unavailable.
export function fallbackTranslateJSON(json, _lang = 'en') {
  function translateValue(value) {
    if (typeof value === 'string') return applyGlossary(value);
    if (Array.isArray(value)) return value.map(translateValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, translateValue(v)])
      );
    }
    return value;
  }
  return translateValue(json);
}
