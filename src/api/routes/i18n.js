/**
 * I18N API Routes
 *
 * GET  /api/i18n/lab/:id            — fetch translated lab (auto-enqueues if missing)
 * POST /api/i18n/lab/:id/translate  — translate + save (admin)
 * POST /api/i18n/lab/:id/preview    — translate but DO NOT save, return diff
 * POST /api/i18n/batch              — batch translate (EN first, then others)
 * GET  /api/i18n/labs               — list labs + translation status
 */

import express from 'express';
import {
  loadLab, saveLab, loadMeta, listLabs, getHash,
  enqueueTranslation, batchTranslate,
  translateJSON, translatePipeline,
  runStaticChecks, qaScore,
} from '../../services/i18nEngine/index.js';
import { LANG_PIPELINE } from '../../services/i18nEngine/translator.js';

const router = express.Router();

// ── GET /lab/:id?lang=en ──────────────────────────────────────────────────────
router.get('/lab/:id', async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || 'en';

  let lab = await loadLab(id, lang);
  if (lab) return res.json({ status: 'ready', lang, lab });

  if (lang !== 'it') {
    try { await enqueueTranslation(id, lang); } catch {}
    const itLab = await loadLab(id, 'it');
    if (itLab) return res.json({ status: 'generating', lang, lab: itLab });
  }

  res.status(404).json({ error: `Lab "${id}" not found` });
});

// ── POST /lab/:id/translate  { lang, tone? } ─────────────────────────────────
router.post('/lab/:id/translate', async (req, res) => {
  const { id } = req.params;
  const { lang = 'en', tone = 'aggressive' } = req.body;

  const itLab = await loadLab(id, 'it');
  if (!itLab) return res.status(404).json({ error: `No IT source for lab "${id}"` });

  try {
    const translated = await translateJSON(itLab, lang, tone);
    const errors = runStaticChecks(itLab, translated);
    const score = qaScore(errors);
    await saveLab(id, lang, translated);
    res.json({ ok: true, id, lang, qaScore: score, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /lab/:id/preview  { lang?, tone? } ───────────────────────────────────
// Translates on-the-fly but NEVER writes to disk. Returns IT source + translation + diff.
router.post('/lab/:id/preview', async (req, res) => {
  const { id } = req.params;
  const { lang = 'en', tone = 'aggressive' } = req.body;

  const itLab = await loadLab(id, 'it');
  if (!itLab) return res.status(404).json({ error: `No IT source for lab "${id}"` });

  try {
    const translated = await translateJSON(itLab, lang, tone);
    const errors = runStaticChecks(itLab, translated);
    const score = qaScore(errors);

    // Build field-level diff of content section only
    const diff = buildDiff(itLab.content || {}, translated.content || {});

    res.json({
      id,
      lang,
      qaScore: score,
      errors,
      saved: false,
      diff,
      it: itLab.content,
      [lang]: translated.content,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /batch  { langs?, labIds? } ─────────────────────────────────────────
// EN always queued first. Other languages follow in LANG_PIPELINE order.
router.post('/batch', async (req, res) => {
  const { langs, labIds } = req.body;
  const allLabs = labIds || await listLabs();

  // Enforce EN-first pipeline order
  const ordered = langs
    ? ['en', ...langs.filter(l => l !== 'en')]
    : LANG_PIPELINE;

  const count = await batchTranslate(allLabs, ordered);
  res.json({ queued: count, labs: allLabs, langs: ordered, pipeline: 'en-first' });
});

// ── GET /labs ─────────────────────────────────────────────────────────────────
router.get('/labs', async (req, res) => {
  const labs = await listLabs();
  const statuses = await Promise.all(labs.map(async id => {
    const meta   = await loadMeta(id);
    const itLab  = await loadLab(id, 'it');
    const enLab  = await loadLab(id, 'en');
    const currentHash = itLab ? getHash(itLab) : null;
    return {
      id,
      hasIT:          !!itLab,
      hasEN:          !!enLab,
      upToDate:       !!meta && meta.hash === currentHash,
      qa:             meta?.qa || null,
      lastTranslated: meta?.lastTranslated || null,
    };
  }));
  res.json(statuses);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildDiff(it, en) {
  const diff = [];
  for (const key of Object.keys(it)) {
    const itVal = it[key];
    const enVal = en[key];
    if (Array.isArray(itVal) && Array.isArray(enVal)) {
      itVal.forEach((item, i) => {
        if (item !== enVal[i]) {
          diff.push({ field: `${key}[${i}]`, it: item, en: enVal[i] });
        }
      });
    } else if (itVal !== enVal) {
      diff.push({ field: key, it: itVal, en: enVal });
    }
  }
  return diff;
}

export default router;
