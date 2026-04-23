// winlab / backend / services / resultEngine.js

const { createClient } = require("redis");

const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
redis.connect();

async function buildReport(sessionId) {
  const score = await redis.get(`session:${sessionId}:score`) || 0;
  const flags = await redis.hGetAll(`session:${sessionId}:flags`) || {};
  const timeline = await redis.lRange(`session:${sessionId}:timeline`, 0, -1) || [];

  const duration = timeline.length;

  const report = {
    sessionId,
    score: Number(score),
    level: deriveLevel(score),
    cheatFlags: Object.keys(flags).filter(k => flags[k] === "1"),
    duration,
    replay: `/api/replay/${sessionId}`,
    aiSummary: summarize(timeline)
  };

  await redis.set(`result:${sessionId}`, JSON.stringify(report));

  return report;
}

function deriveLevel(score) {
  if (score > 80) return "senior";
  if (score > 50) return "mid";
  return "junior";
}

function summarize(events) {
  // placeholder → will plug AI stream later
  return {
    strengths: [],
    weaknesses: []
  };
}

module.exports = {
  buildReport
};
