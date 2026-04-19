import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { translateJSON } from './translator.js';
import { loadLab, saveLab, saveMeta, getHash, loadMeta } from './storage.js';
import { runStaticChecks, qaScore } from './qaEngine.js';

let _connection = null;
let _queue = null;
let _worker = null;

function getConnection() {
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _connection.on('error', () => {}); // suppress noise if Redis unavailable
  }
  return _connection;
}

export function getTranslateQueue() {
  if (!_queue) {
    _queue = new Queue('i18n-translate', { connection: getConnection() });
  }
  return _queue;
}

export async function enqueueTranslation(id, lang = 'en') {
  return getTranslateQueue().add('translate', { id, lang }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export function startI18nWorker() {
  if (_worker) return;
  _worker = new Worker('i18n-translate', async job => {
    const { id, lang } = job.data;
    const itLab = await loadLab(id, 'it');
    if (!itLab) throw new Error(`Missing IT source: labs/${id}/it.json`);

    const currentHash = getHash(itLab);
    const meta = await loadMeta(id);
    if (meta?.hash === currentHash && await loadLab(id, lang)) {
      return { skipped: true, reason: 'already up to date' };
    }

    const translated = await translateJSON(itLab, lang);

    const errors = runStaticChecks(itLab, translated);
    const score = qaScore(errors);
    if (score < 60) throw new Error(`QA failed (score ${score}): ${errors.join(', ')}`);

    await saveLab(id, lang, translated);
    await saveMeta(id, { hash: currentHash, qa: { score, errors }, lastTranslated: lang });
    return { success: true, id, lang, qaScore: score };
  }, { connection: getConnection(), concurrency: 3 });

  _worker.on('failed', (job, err) => {
    console.error(`[i18n] Job failed ${job?.data?.id}→${job?.data?.lang}:`, err.message);
  });
  _worker.on('completed', job => {
    console.log(`[i18n] ✓ ${job.data.id}→${job.data.lang}`);
  });

  console.log('[i18n] Worker started');
}

export async function batchTranslate(labIds, langs = ['en']) {
  const queue = getTranslateQueue();
  const jobs = [];
  for (const id of labIds) {
    for (const lang of langs) {
      jobs.push(await queue.add('translate', { id, lang }));
    }
  }
  return jobs.length;
}
