// winlab / core / scoringEngine.js

const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.connect();

const SCORE = {
  correct: 10,
  speedBonus: 5,
  hintPenalty: -5,
  retryPenalty: -3,
};

const LEVELS = {
  junior: 0,
  mid: 30,
  senior: 70,
};

function getLevel(score) {
  if (score < LEVELS.mid) return "junior";
  if (score < LEVELS.senior) return "mid";
  return "senior";
}

function entropy(input) {
  const map = {};
  for (let c of input) map[c] = (map[c] || 0) + 1;
  return Object.values(map).reduce((a, v) => {
    const p = v / input.length;
    return a - p * Math.log2(p);
  }, 0);
}

async function processCommand({
  userId,
  sessionId,
  command,
  correct = false,
  usedHint = false,
  isRetry = false,
  execTime = 0,
}) {
  const key = `session:${sessionId}:score`;

  let score = parseInt(await redis.get(key)) || 0;

  if (correct) score += SCORE.correct;
  if (execTime < 2000) score += SCORE.speedBonus;
  if (usedHint) score += SCORE.hintPenalty;
  if (isRetry) score += SCORE.retryPenalty;

  await redis.set(key, score, { EX: 3600 });

  const userKey = `user:${userId}:skill_score`;
  await redis.incrBy(userKey, score);

  const totalScore = parseInt(await redis.get(userKey)) || 0;
  const level = getLevel(totalScore);

  await redis.set(`user:${userId}:level`, level);

  const event = {
    cmd: command,
    score: score,
    total: totalScore,
    level,
    time: execTime,
    entropy: entropy(command).toFixed(2),
    ts: Date.now(),
  };

  await redis.xAdd(`stream:session:${sessionId}`, "*", event);

  await redis.zAdd("leaderboard:global", {
    score: totalScore,
    value: userId,
  });

  return {
    sessionScore: score,
    totalScore,
    level,
  };
}

async function flagCheat({ sessionId, type }) {
  const key = `session:${sessionId}:flags`;

  await redis.hSet(key, type, 1);

  await redis.xAdd(`stream:session:${sessionId}`, "*", {
    type: "cheat",
    reason: type,
    ts: Date.now(),
  });
}

async function getSessionScore(sessionId) {
  return parseInt(await redis.get(`session:${sessionId}:score`)) || 0;
}

async function getUserLevel(userId) {
  return await redis.get(`user:${userId}:level`);
}

module.exports = {
  processCommand,
  flagCheat,
  getSessionScore,
  getUserLevel,
};
