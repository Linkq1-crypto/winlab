import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

const LABS_DIR = new URL('../../../../labs', import.meta.url).pathname;

function labDir(id) {
  return path.join(LABS_DIR, id);
}

export function getHash(data) {
  return createHash('md5').update(JSON.stringify(data)).digest('hex');
}

export async function loadLab(id, lang) {
  const file = path.join(labDir(id), `${lang}.json`);
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveLab(id, lang, data) {
  const dir = labDir(id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${lang}.json`), JSON.stringify(data, null, 2));
}

export async function loadMeta(id) {
  try {
    const raw = await readFile(path.join(labDir(id), 'meta.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveMeta(id, data) {
  const dir = labDir(id);
  await mkdir(dir, { recursive: true });
  const existing = await loadMeta(id) || {};
  await writeFile(
    path.join(dir, 'meta.json'),
    JSON.stringify({ ...existing, ...data, updatedAt: new Date().toISOString() }, null, 2)
  );
}

export async function listLabs() {
  const { readdir } = await import('fs/promises');
  try {
    const entries = await readdir(LABS_DIR, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}
