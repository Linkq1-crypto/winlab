#!/usr/bin/env node
/**
 * gen-lab.js — WinLab lab artifact generator
 *
 * Reads labs/<id>/solution.md and generates:
 *   mentor/step*.txt   — progressive AI mentor hints
 *   locales/en.json    — English UX microcopy
 *   locales/it.json    — Italian skeleton (TODO markers)
 *
 * Usage:
 *   node scripts/gen-lab.js <lab-id> [--force] [--dry-run]
 *
 * Flags:
 *   --force    overwrite existing files
 *   --dry-run  print output, write nothing
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LABS_DIR  = join(__dirname, '..', 'labs');

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const labId   = args.find(a => !a.startsWith('--'));
const force   = args.includes('--force');
const dryRun  = args.includes('--dry-run');

if (!labId) {
  console.error('Usage: node scripts/gen-lab.js <lab-id> [--force] [--dry-run]');
  process.exit(1);
}

const labDir      = join(LABS_DIR, labId);
const solutionPath = join(labDir, 'solution.md');

if (!existsSync(solutionPath)) {
  console.error(`solution.md not found: ${solutionPath}`);
  process.exit(1);
}

// ─── PARSER ──────────────────────────────────────────────────────────────────

function parseSections(md) {
  const sections = {};
  const re = /^## (.+)$/gm;
  const hits = [];
  let m;

  while ((m = re.exec(md)) !== null) {
    hits.push({ title: m[1].trim(), pos: m.index + m[0].length });
  }

  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].pos - hits[i + 1].title.length - 4 : md.length;
    sections[hits[i].title] = md.slice(hits[i].pos, end).trim();
  }

  return sections;
}

function parseMentorHints(section) {
  // Strips fenced code block if present, then parses numbered lines:
  // 1. Symptom → Action
  const raw = section.replace(/^```[\s\S]*?^```/gm, s => s.replace(/^```\w*\n?/gm, '').replace(/^```\n?$/gm, ''));
  return raw
    .split('\n')
    .map(l => l.match(/^\d+\.\s+(.+)$/))
    .filter(Boolean)
    .map(m => m[1].trim());
}

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^>\s*/gm, '')
    .trim();
}

function firstSentence(text) {
  const clean = stripMarkdown(text.split('\n')[0]);
  return clean.endsWith('.') ? clean : clean + '.';
}

// ─── GENERATORS ──────────────────────────────────────────────────────────────

function genMentorSteps(hints) {
  return hints.map((hint, i) => {
    const [left, right] = hint.split('→').map(s => s.trim());

    let content;
    if (right) {
      // "symptom → action"
      content = `${left}.\n\n→ ${right}.`;
    } else {
      content = left;
    }

    return { filename: `step${i + 1}.txt`, content: content + '\n' };
  });
}

function genEnJson(sections, hints) {
  const lesson = sections['LESSON']
    ?.split('\n')
    .find(l => l.startsWith('>'))
    ?.replace(/^>\s*/, '')
    .trim() ?? '';

  const out = {
    title: 'TODO: short title',
    description: firstSentence(sections['ROOT CAUSE'] ?? ''),
    lesson: stripMarkdown(lesson),
  };

  hints.forEach((hint, i) => {
    const action = (hint.split('→')[1] ?? hint).trim();
    out[`hint_${i + 1}`] = stripMarkdown(action);
  });

  out.success = 'Incident resolved.';
  out.fail    = 'Still failing. Check the logs.';

  return out;
}

function genItJson(enJson) {
  const out = {};
  for (const key of Object.keys(enJson)) {
    out[key] = key === 'title' ? 'TODO: titolo breve'
             : key === 'description' ? 'TODO: descrizione una riga'
             : key === 'lesson' ? 'TODO: lezione'
             : key === 'success' ? 'TODO: messaggio successo'
             : key === 'fail'    ? 'TODO: messaggio fallimento'
             : `TODO: ${enJson[key]}`;
  }
  return out;
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

function writeFile(path, content) {
  if (dryRun) {
    console.log(`\n[dry-run] ${path}\n${'-'.repeat(60)}\n${content}`);
    return;
  }
  if (existsSync(path) && !force) {
    console.log(`skip (exists): ${path}  — use --force to overwrite`);
    return;
  }
  writeFileSync(path, content, 'utf8');
  console.log(`wrote: ${path}`);
}

function ensureDir(dir) {
  if (!dryRun) mkdirSync(dir, { recursive: true });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const md       = readFileSync(solutionPath, 'utf8');
const sections = parseSections(md);
const hintsRaw = sections['MENTOR_HINTS'];

if (!hintsRaw) {
  console.error('solution.md is missing a ## MENTOR_HINTS section');
  process.exit(1);
}

const hints       = parseMentorHints(hintsRaw);
const steps       = genMentorSteps(hints);
const enJson      = genEnJson(sections, hints);
const itJson      = genItJson(enJson);

console.log(`\ngen-lab: ${labId} (${hints.length} hints found)\n`);

// mentor/
const mentorDir = join(labDir, 'mentor');
ensureDir(mentorDir);
for (const { filename, content } of steps) {
  writeFile(join(mentorDir, filename), content);
}

// locales/
const localesDir = join(labDir, 'locales');
ensureDir(localesDir);
writeFile(join(localesDir, 'en.json'), JSON.stringify(enJson, null, 2) + '\n');
writeFile(join(localesDir, 'it.json'), JSON.stringify(itJson, null, 2) + '\n');

console.log('\ndone.');
