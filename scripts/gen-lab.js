#!/usr/bin/env node
/**
 * gen-lab.js — WinLab lab artifact generator
 *
 * Reads labs/<id>/solution.md and scenario.json and generates:
 *   mentor/step*.txt   — progressive AI mentor hints
 *   locales/en.json    — English UX microcopy
 *   locales/it.json    — Italian skeleton (TODO markers)
 *   boot.json          — per-lab boot sequence (typed lines)
 *
 * Usage:
 *   node scripts/gen-lab.js <lab-id> [--force] [--dry-run]
 *   node scripts/gen-lab.js --all    [--force] [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LABS_DIR  = join(__dirname, '..', 'labs');

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const labId  = args.find(a => !a.startsWith('--'));
const force  = args.includes('--force');
const dryRun = args.includes('--dry-run');
const all    = args.includes('--all');

if (!labId && !all) {
  console.error('Usage: node scripts/gen-lab.js <lab-id> [--force] [--dry-run]');
  console.error('       node scripts/gen-lab.js --all   [--force] [--dry-run]');
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

const TAG_WARNINGS = {
  nginx:      '⚠  nginx.service in FAILED state',
  port:       '⚠  Port conflict detected on eth0',
  disk:       '⚠  Filesystem at 100% — writes blocked',
  storage:    '⚠  Storage I/O errors detected',
  apache:     '⚠  Apache service misconfiguration detected',
  ssl:        '⚠  SSL certificate validation failed',
  ldap:       '⚠  LDAP bind failure — auth service down',
  auth:       '⚠  Authentication service unreachable',
  mysql:      '⚠  MySQL connection refused',
  memory:     '⚠  Memory usage critical — OOM imminent',
  redis:      '⚠  Redis OOM — eviction storm in progress',
  k8s:        '⚠  Kubernetes pod in CrashLoopBackOff',
  docker:     '⚠  Container health check failing',
  security:   '⚠  Security misconfiguration detected',
  jwt:        '⚠  JWT validation bypass detected',
  webhook:    '⚠  Webhook signature forgery detected',
  sql:        '⚠  Database query timeout — N+1 detected',
  api:        '⚠  API response time critically degraded',
  git:        '⚠  Repository state inconsistent',
  cicd:       '⚠  CI/CD pipeline failure — deploy blocked',
  raid:       '⚠  RAID array degraded — disk failure detected',
  network:    '⚠  Network packet loss detected',
  chmod:      '⚠  Permission denied — ACL misconfiguration',
  selinux:    '⚠  SELinux policy blocking critical access',
  nodejs:     '⚠  Node.js process memory leak detected',
  debugging:  '⚠  Unknown regression — root cause unclear',
  production: '⚠  Production service degraded',
};

function generateBootSequence(scenario) {
  const lines = [];

  lines.push({ type: 'system', text: `${(scenario.title ?? scenario.id ?? 'UNKNOWN').toUpperCase()} [v4.2.0]` });

  const seen = new Set();
  for (const tag of (scenario.tags ?? [])) {
    const msg = TAG_WARNINGS[tag];
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      lines.push({ type: 'warning', text: msg });
    }
  }

  const hint0 = scenario.hints?.[0] ?? '';
  if (hint0) {
    const afterDash = hint0.split('—')[1]?.trim();
    const raw = afterDash ?? hint0.replace(/^[^:]+:\s*`?[^\s`]+`?\s*/i, '').trim();
    const infoText = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/\.$/, '') + '.';
    if (infoText.length > 2) {
      lines.push({ type: 'info', text: 'ℹ  ' + infoText });
    }
  }

  lines.push({ type: 'prompt', text: 'Press any key to begin...' });

  return lines;
}

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
    description: firstSentence(sections['INCIDENT SUMMARY'] ?? sections['ROOT CAUSE'] ?? ''),
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

function runForLab(id) {
  const labDir       = join(LABS_DIR, id);
  const solutionPath = join(labDir, 'solution.md');
  const scenarioPath = join(labDir, 'scenario.json');

  if (!existsSync(solutionPath)) {
    console.error(`skip ${id}: solution.md not found`);
    return false;
  }
  if (!existsSync(scenarioPath)) {
    console.error(`skip ${id}: scenario.json not found`);
    return false;
  }

  const md       = readFileSync(solutionPath, 'utf8');
  const sections = parseSections(md);
  const hintsRaw = sections['MENTOR_HINTS'];

  if (!hintsRaw) {
    console.error(`skip ${id}: solution.md missing ## MENTOR_HINTS`);
    return false;
  }

  const hints    = parseMentorHints(hintsRaw);
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));
  } catch {
    console.error(`skip ${id}: scenario.json is not valid JSON`);
    return false;
  }
  const steps    = genMentorSteps(hints);
  const enJson   = genEnJson(sections, hints);
  const itJson   = genItJson(enJson);
  const boot     = generateBootSequence(scenario);

  console.log(`\ngen-lab: ${id} (${hints.length} hints found)\n`);

  const mentorDir = join(labDir, 'mentor');
  ensureDir(mentorDir);
  for (const { filename, content } of steps) {
    writeFile(join(mentorDir, filename), content);
  }

  const localesDir = join(labDir, 'locales');
  ensureDir(localesDir);
  writeFile(join(localesDir, 'en.json'), JSON.stringify(enJson, null, 2) + '\n');
  writeFile(join(localesDir, 'it.json'), JSON.stringify(itJson, null, 2) + '\n');

  writeFile(join(labDir, 'boot.json'), JSON.stringify(boot, null, 2) + '\n');

  return true;
}

if (all) {
  const labs = readdirSync(LABS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  let ok = 0, fail = 0;
  for (const id of labs) {
    if (runForLab(id)) ok++; else fail++;
  }
  console.log(`\ndone: ${ok} ok, ${fail} skipped.`);
} else {
  if (!runForLab(labId)) process.exit(1);
  console.log('\ndone.');
}
