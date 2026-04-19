import Anthropic from '@anthropic-ai/sdk';
import { protect, restore } from './tokenProtect.js';
import { applyGlossary } from './glossary.js';
import { fallbackTranslateJSON } from './fallback.js';

const SYSTEM_PROMPT = `You are a localization engine for a DevOps/SRE training platform.

Rules:
- Keep JSON structure 100% identical (same keys, same types)
- Translate ONLY user-facing text strings
- DO NOT translate: code snippets, log lines, variable names, CLI commands, file paths, error codes
- Use precise DevOps/SRE terminology (incident, outage, worker, queue, pipeline, deploy)
- Tone: concise, high-pressure, incident-driven — not academic
- Preserve placeholders like {{amount}} or {{user}} exactly
- Return ONLY the translated JSON, no markdown fences, no explanation`;

const TONES = {
  aggressive:  'Short, intense, high-pressure, incident-driven. Max 8 words per sentence.',
  neutral:     'Clear and professional DevOps language.',
  educational: 'Step-by-step, explanatory, beginner-friendly SRE language.',
};

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export async function translateJSON(json, targetLang = 'en', tone = 'aggressive') {
  const raw = JSON.stringify(json, null, 2);
  const { protectedText, tokens } = protect(raw);

  const toneInstr = TONES[tone] || TONES.aggressive;
  const prompt = `Translate this JSON to ${targetLang}.\nTone: ${toneInstr}\n\nJSON:\n${protectedText}`;

  try {
    const res = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    let translated = res.content[0].text.trim();
    translated = translated.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    translated = applyGlossary(translated);
    translated = restore(translated, tokens);
    return JSON.parse(translated);
  } catch (err) {
    console.warn('[i18n] Claude Haiku failed, using fallback:', err.message);
    return fallbackTranslateJSON(json, targetLang);
  }
}
