// scripts/backup.js – Daily backup: MySQL dump → Backblaze B2
// Usage: node scripts/backup.js
// Cron: 0 2 * * * cd /var/www/simulator && node scripts/backup.js >> /var/log/winlab-backup.log 2>&1

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Config
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'winlab';
const B2_BUCKET = process.env.B2_BUCKET || 'winlab-backups';
const B2_KEY_ID = process.env.B2_KEY_ID || '';
const B2_APP_KEY = process.env.B2_APP_KEY || '';
const BACKUP_DIR = path.resolve(ROOT, 'backups');
const MAX_BACKUPS = 30; // Keep last 30 days

// Ensure backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function run() {
  const date = new Date().toISOString().slice(0, 10);
  const dumpFile = path.join(BACKUP_DIR, `winlab-${date}.sql.gz`);

  // ── 1. MySQL Dump ──────────────────────────────────────────────────────
  log('Starting MySQL dump...');
  try {
    const passArg = DB_PASS ? `-p${DB_PASS}` : '';
    execSync(
      `mysqldump -u ${DB_USER} ${passArg} --single-transaction --routines --triggers ${DB_NAME} | gzip > ${dumpFile}`,
      { stdio: 'inherit' }
    );
    log(`Dump created: ${dumpFile}`);
  } catch (err) {
    log(`ERROR: MySQL dump failed: ${err.message}`);
    process.exit(1);
  }

  // ── 2. Upload to Backblaze B2 ──────────────────────────────────────────
  if (B2_KEY_ID && B2_APP_KEY) {
    log('Uploading to Backblaze B2...');
    try {
      // Using b2 command-line tool
      execSync(`b2 authorize-account ${B2_KEY_ID} ${B2_APP_KEY}`, { stdio: 'inherit' });
      execSync(`b2 upload-file --threads 4 ${B2_BUCKET} ${dumpFile} ${date}/winlab.sql.gz`, { stdio: 'inherit' });
      log('Upload complete');
    } catch (err) {
      log(`WARNING: B2 upload failed: ${err.message}`);
      log('Local backup is still available.');
    }
  } else {
    log('WARNING: B2 credentials not set. Skipping cloud upload.');
  }

  // ── 3. Cleanup Old Local Backups ───────────────────────────────────────
  log('Cleaning up old backups...');
  const files = fs.readdirSync(BACKUP_DIR).sort();
  while (files.length > MAX_BACKUPS) {
    const old = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, old));
    log(`Deleted old backup: ${old}`);
  }

  // ── 4. DB Size Report ──────────────────────────────────────────────────
  log('Backup complete. Database size report:');
  try {
    const size = fs.statSync(dumpFile).size;
    log(`  Dump size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    log(`  Local backups: ${files.length} files`);
  } catch {}

  // ── 5. Helpdesk Backup ────────────────────────────────────────────────
  log('Starting helpdesk backup...');
  try {
    execSync(`node ${path.join(ROOT, 'scripts', 'backup-helpdesk.js')}`, {
      stdio: 'inherit',
      timeout: 60000, // 1 min timeout
    });
    log('Helpdesk backup complete');
  } catch (err) {
    log(`WARNING: Helpdesk backup failed: ${err.message}`);
    log('Database backup is still intact.');
  }
}

run().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
