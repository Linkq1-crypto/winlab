// WINLAB API - Minimal production-ready backend (Express)

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store (replace with DB)
const sessions = {};
const API_KEYS = new Set(['sk_test_123']);

// 🔐 Auth middleware
function auth(req, res, next) {
  const key = req.headers.authorization?.replace('Bearer ', '');
  if (!API_KEYS.has(key)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// 🚀 Create session
app.post('/v1/sessions', auth, (req, res) => {
  const { candidate_id, scenario } = req.body;

  const id = 'sess_' + crypto.randomBytes(6).toString('hex');

  sessions[id] = {
    id,
    candidate_id,
    scenario,
    status: 'active',
    start: Date.now(),
    commands: [],
    errors: 0
  };

  res.json({
    session_id: id,
    launch_url: `http://localhost:5173/session/${id}`
  });
});

// 📊 Get results
app.get('/v1/sessions/:id', auth, (req, res) => {
  const s = sessions[req.params.id];

  if (!s) return res.status(404).json({ error: 'not found' });

  const time = s.end ? Math.floor((s.end - s.start) / 1000) : null;

  res.json({
    status: s.status,
    time,
    errors: s.errors,
    commands: s.commands,
    score: computeScore(s),
    verdict: getVerdict(computeScore(s))
  });
});

// 🧠 Complete session (called by frontend)
app.post('/v1/sessions/:id/complete', (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.status(404).end();

  s.status = 'completed';
  s.end = Date.now();
  s.commands = req.body.commands || [];
  s.errors = req.body.errors || 0;

  // TODO: webhook trigger here

  res.json({ ok: true });
});

// 🧠 scoring
function computeScore(s) {
  let score = 100;
  score -= s.errors * 10;
  score -= s.commands.length * 2;
  return Math.max(score, 0);
}

function getVerdict(score) {
  if (score > 85) return 'strong';
  if (score > 60) return 'borderline';
  return 'weak';
}

app.listen(3001, () => {
  console.log('Winlab API running on http://localhost:3001');
});
