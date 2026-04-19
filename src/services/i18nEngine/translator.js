import OpenAI from 'openai';
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
  aggressive:   'Short, intense, high-pressure, incident-driven. Max 8 words per sentence.',
  neutral:      'Clear and professional DevOps language.',
  educational:  'Step-by-step, explanatory, beginner-friendly SRE language.',
};

let _openai = null;
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function translateJSON(json, targetLang = 'en', tone = 'aggressive') {
  const raw = JSON.stringify(json, null, 2);
  const { protectedText, tokens } = protect(raw);

  const toneInstr = TONES[tone] || TONES.aggressive;
  const prompt = `Translate this JSON to ${targetLang}.\nTone: ${toneInstr}\n\nJSON:\n${protectedText}`;

  try {
    const res = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    });

    let translated = res.choices[0].message.content.trim();
    // strip markdown fences if model wraps anyway
    translated = translated.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    translated = applyGlossary(translated);
    translated = restore(translated, tokens);
    return JSON.parse(translated);
  } catch (err) {
    console.warn('[i18n] LLM failed, using fallback:', err.message);
    return fallbackTranslateJSON(json, targetLang);
  }
}
