import { franc } from 'franc'
import langs from 'langs'

// Normalizza testo UI (rimuove rumore)
export function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim()
}

// Rileva lingua ISO (en, it, hi...)
export function detectLanguage(text: string): string {
  const clean = normalizeText(text)

  if (clean.length < 20) return 'unknown' // evita falsi positivi

  const code3 = franc(clean)

  if (code3 === 'und') return 'unknown'

  const lang = langs.where('3', code3)
  return lang?.['1'] || 'unknown'
}

// Heuristic mix lingua
export function detectMixedLanguage(text: string): boolean {
  const hasItalian = /\b(il|lo|la|gli|uno|una|scegli|avanzati|digita|scenari)\b/i.test(text)
  const hasEnglish = /\b(the|and|start|select|scenario|continue)\b/i.test(text)

  return hasItalian && hasEnglish
}
