/**
 * I18N API Routes
 *
 * GET  /api/i18n/lab/:id          — fetch translated lab (auto-enqueues if missing)
 * POST /api/i18n/lab/:id/translate — trigger translation now (admin)
 * POST /api/i18n/batch             — batch translate all labs (admin)
 * GET  /api/i18n/labs              — list available labs + translation status
 */

import express from 'express';
import {
  loadLab, saveLab, loadMeta, listLabs, getHash,
  enqueueTranslation, batchTranslate, translateJSON,
  runStaticChecks, qaScore,
} from '../../services/i18nEngine/index.js';

const router = express.Router();

// GET /api/i18n/lab/:id?lang=en
router.get('/lab/:id', async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || 'en';

  let lab = await loadLab(id, lang);
  if (lab) return res.json({ status: 'ready', lang, lab });

  // Not yet translated — serve IT source + trigger async
  if (lang !== 'it') {
    try { await enqueueTranslation(id, lang); } catch {}
    const itLab = await loadLab(id, 'it');
    if (itLab) return res.json({ status: 'generating', lang, lab: itLab });
  }

  res.status(404).json({ error: `Lab "${id}" not found` });
});

// POST /api/i18n/lab/:id/translate  { lang, tone? }
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

// POST /api/i18n/batch  { langs?, labIds? }
router.post('/batch', async (req, res) => {
  const { langs = ['en'], labIds } = req.body;
  const allLabs = labIds || await listLabs();
  const count = await batchTranslate(allLabs, langs);
  res.json({ queued: count, labs: allLabs, langs });
});

// GET /api/i18n/labs
router.get('/labs', async (req, res) => {
  const labs = await listLabs();
  const statuses = await Promise.all(labs.map(async id => {
    const meta = await loadMeta(id);
    const itLab = await loadLab(id, 'it');
    const enLab = await loadLab(id, 'en');
    const currentHash = itLab ? getHash(itLab) : null;
    return {
      id,
      hasIT: !!itLab,
      hasEN: !!enLab,
      upToDate: !!meta && meta.hash === currentHash,
      qa: meta?.qa || null,
      lastTranslated: meta?.lastTranslated || null,
    };
  }));
  res.json(statuses);
});

export default router;
