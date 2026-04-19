#!/usr/bin/env node
/**
 * WinLab I18N batch runner — no Redis required.
 * Reads labs/{id}/it.json → translates → writes labs/{id}/{lang}.json
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/run-i18n.js
 *   node scripts/run-i18n.js --langs en          (only English)
 *   node scripts/run-i18n.js --labs real-server   (single lab)
 *   node scripts/run-i18n.js --force              (re-translate even if already done)
 */

import { readdir, readFile, writeFile, mkdir, access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LABS_DIR  = path.resolve(__dirname, '../labs');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const LANGS_ARG  = getArg('--langs')?.split(',') || ['en'];
const LABS_ARG   = getArg('--labs')?.split(',')  || null;
const FORCE      = hasFlag('--force');

// ── Anthropic client ──────────────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not set');
  process.exit(1);
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Glossary (applied post-translation) ──────────────────────────────────────
const GLOSSARY = {
  'coda': 'queue', 'ambiente': 'environment', 'servizio': 'service',
  'istanza': 'instance', 'errore': 'error', 'incidente': 'incident',
  'saturo': 'saturated', 'bloccato': 'hung', 'lentissimo': 'very slow',
  'scenario': 'scenario', 'scenari': 'scenarios',
};

function applyGlossary(text) {
  let out = text;
  for (const [it, en] of Object.entries(GLOSSARY)) {
    out = out.replace(new RegExp(`\\b${it}\\b`, 'gi'), en);
  }
  return out;
}

// ── Token protection ──────────────────────────────────────────────────────────
function protect(text) {
  const tokens = [];
  let i = 0;
  const protectedText = text.replace(/`[^`]*`|"[^"]*"|__TOKEN_\d+__|{{[^}]+}}/g, match => {
    const key = `__TOKEN_${i++}__`;
    tokens.push({ key, value: match });
    return key;
  });
  return { protectedText, tokens };
}

function restore(text, tokens) {
  let result = text;
  for (const { key, value } of tokens) result = result.replaceAll(key, value);
  return result;
}

// ── Translate one lab JSON ────────────────────────────────────────────────────
async function translateLab(itJson, targetLang) {
  const raw = JSON.stringify(itJson, null, 2);
  const { protectedText, tokens } = protect(raw);

  const system = `You are a localization engine for a DevOps/SRE training platform.
Rules:
- Return ONLY the translated JSON — no markdown fences, no explanation
- Keep JSON structure 100% identical (same keys, same types, same array lengths)
- Translate ONLY user-facing text strings
- DO NOT translate: code, CLI commands, log lines, file paths, error codes, variable names
- Tone: concise, high-pressure, incident-driven
- Preserve placeholders like {{amount}} exactly`;

  const prompt = `Translate the following JSON to ${targetLang.toUpperCase()}.\n\n${protectedText}`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  let translated = res.content[0].text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '');

  translated = applyGlossary(translated);
  translated = restore(translated, tokens);
  return JSON.parse(translated);
}

// ── Exists check ──────────────────────────────────────────────────────────────
async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let labIds;
  if (LABS_ARG) {
    labIds = LABS_ARG;
  } else {
    const entries = await readdir(LABS_DIR, { withFileTypes: true });
    labIds = entries.filter(e => e.isDirectory()).map(e => e.name);
  }

  console.log(`\n🌍 WinLab I18N Engine`);
  console.log(`   Labs:  ${labIds.join(', ')}`);
  console.log(`   Langs: ${LANGS_ARG.join(', ')}`);
  console.log(`   Force: ${FORCE}\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const id of labIds) {
    const itPath = path.join(LABS_DIR, id, 'it.json');
    if (!(await exists(itPath))) {
      console.warn(`   ⚠  ${id}: no it.json — skipping`);
      continue;
    }

    const itJson = JSON.parse(await readFile(itPath, 'utf8'));

    for (const lang of LANGS_ARG) {
      if (lang === 'it') continue;
      const outPath = path.join(LABS_DIR, id, `${lang}.json`);

      if (!FORCE && await exists(outPath)) {
        console.log(`   ⏭  ${id} → ${lang} (already exists)`);
        skipped++;
        continue;
      }

      process.stdout.write(`   ⏳  ${id} → ${lang} … `);
      try {
        const translated = await translateLab(itJson, lang);
        await mkdir(path.join(LABS_DIR, id), { recursive: true });
        await writeFile(outPath, JSON.stringify(translated, null, 2));
        console.log('✅');
        ok++;
      } catch (err) {
        console.log(`❌  ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n✅ ${ok} translated  ⏭ ${skipped} skipped  ❌ ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
