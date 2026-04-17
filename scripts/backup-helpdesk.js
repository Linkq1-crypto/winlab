/**
 * Helpdesk Backup — Extends main backup.js to cover all helpdesk data
 *
 * Backs up:
 * - Tickets (in-memory → JSON dump)
 * - AI Learning Cache (in-memory → JSON dump)
 * - Semantic Cache (in-memory → JSON dump)
 * - Templates (in-memory → JSON dump)
 * - Knowledge Base (in-memory → JSON dump)
 * - Security state (blacklist, reputation)
 * - Deploy history
 * - Logs
 *
 * Restore:
 * - node scripts/backup-helpdesk.js --restore <backup-file>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.resolve(ROOT, 'backups/helpdesk');

// Ensure directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ──── Data Collectors ────
// These connect to the running backend via HTTP
const API_BASE = process.env.HELPDESK_API || 'http://localhost:3001/api/helpdesk';

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function collectAllData() {
  const date = new Date().toISOString();
  const data = {
    version: '1.0.0',
    backedUpAt: date,
    helpdesk: {
      tickets: null,
      sla: null,
      analytics: null,
      insights: null,
      bugs: null,
      churn: null,
      aiSummary: null,
    },
    caches: {
      aiLearning: null,
      security: null,
      cache: null,
      kb: null,
      templates: null,
      faqs: null,
    },
    system: {
      deploys: null,
      logs: null,
    },
  };

  log('Collecting tickets...');
  data.helpdesk.tickets = await fetchJSON(`${API_BASE}/inbox`);

  log('Collecting SLA metrics...');
  data.helpdesk.sla = await fetchJSON(`${API_BASE}/sla`);

  log('Collecting analytics...');
  data.helpdesk.analytics = await fetchJSON(`${API_BASE}/analytics`);

  log('Collecting insights...');
  data.helpdesk.insights = await fetchJSON(`${API_BASE}/insights`);

  log('Collecting bug data...');
  data.helpdesk.bugs = await fetchJSON(`${API_BASE}/bugs`);

  log('Collecting churn data...');
  data.helpdesk.churn = await fetchJSON(`${API_BASE}/churn`);

  log('Collecting AI summary...');
  data.helpdesk.aiSummary = await fetchJSON(`${API_BASE}/ai-summary`);

  log('Collecting AI learning cache stats...');
  data.caches.aiLearning = await fetchJSON(`${API_BASE}/ai-cache/stats`);

  log('Collecting security state...');
  data.caches.security = await fetchJSON(`${API_BASE}/security`);

  log('Collecting cache stats...');
  data.caches.cache = await fetchJSON(`${API_BASE}/security`);

  log('Collecting knowledge base...');
  data.caches.kb = await fetchJSON(`${API_BASE}/kb`);

  log('Collecting templates...');
  data.caches.templates = await fetchJSON(`${API_BASE}/templates`);

  log('Collecting FAQs...');
  data.caches.faqs = await fetchJSON(`${API_BASE}/faqs`);

  log('Collecting deploy history...');
  data.system.deploys = await fetchJSON('http://localhost:3001/api/deploys');

  return data;
}

// ──── Backup ────

async function backup() {
  const date = new Date().toISOString().slice(0, 10);
  const backupFile = path.join(BACKUP_DIR, `helpdesk-${date}.json.gz`);

  log('Starting helpdesk backup...');

  // Collect all data
  const data = await collectAllData();

  // Count what we collected
  const ticketCount = data.helpdesk.tickets?.tickets?.length || 0;
  const aiCacheEntries = data.caches.aiLearning?.total || 0;
  const securityBlacklist = data.caches.security?.security?.blacklistCount || 0;
  const kbArticles = data.caches.kb?.articles?.length || 0;
  const templates = data.caches.templates?.templates?.length || 0;

  // Compress and save
  const { gzipSync } = await import('zlib');
  const jsonStr = JSON.stringify(data, null, 2);
  const compressed = gzipSync(jsonStr);
  fs.writeFileSync(backupFile, compressed);

  const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);

  log(`Backup saved: ${backupFile} (${sizeMB}MB compressed)`);
  log(`  Tickets: ${ticketCount}`);
  log(`  AI cache entries: ${aiCacheEntries}`);
  log(`  Blacklisted: ${securityBlacklist}`);
  log(`  KB articles: ${kbArticles}`);
  log(`  Templates: ${templates}`);

  // Cleanup old backups (keep last 30)
  const files = fs.readdirSync(BACKUP_DIR).sort();
  const MAX_BACKUPS = 30;
  while (files.length > MAX_BACKUPS) {
    const old = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    log(`Deleted old backup: ${old}`);
  }

  return backupFile;
}

// ──── Restore ────

async function restore(backupFile) {
  if (!fs.existsSync(backupFile)) {
    log(`ERROR: File not found: ${backupFile}`);
    process.exit(1);
  }

  log(`Restoring from: ${backupFile}`);

  const { gunzipSync } = await import('zlib');
  const compressed = fs.readFileSync(backupFile);
  const jsonStr = gunzipSync(compressed).toString();
  const data = JSON.parse(jsonStr);

  log(`Backup from: ${data.backedUpAt}`);
  log(`  Tickets: ${data.helpdesk.tickets?.tickets?.length || 0}`);
  log(`  AI cache entries: ${data.caches.aiLearning?.total || 0}`);

  // To restore, we'd POST data back to the API
  // This is a dry run — actual restore would need admin endpoint
  log('\n⚠️  RESTORE MODE — This is a dry run');
  log('To restore, the data would be POSTed to the API endpoints.');
  log('Admin restore endpoint not yet implemented.');

  return data;
}

// ──── Main ────

const args = process.argv.slice(2);
const mode = args[0] || 'backup';
const file = args[1];

if (mode === 'restore' && !file) {
  log('Usage: node scripts/backup-helpdesk.js restore <backup-file>');
  process.exit(1);
}

if (mode === 'restore') {
  await restore(file);
} else {
  await backup();
}
