// winlab / core / replayEngine.js

const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.connect();

async function getSessionReplay(sessionId) {
  const stream = `stream:session:${sessionId}`;

  const data = await redis.xRange(stream, "-", "+");

  return data.map((entry) => ({
    id: entry.id,
    ...entry.message,
  }));
}

async function getReplayChunk(sessionId, lastId = "0-0") {
  const stream = `stream:session:${sessionId}`;

  const data = await redis.xRange(stream, lastId, "+", {
    COUNT: 50,
  });

  return data.map((entry) => ({
    id: entry.id,
    ...entry.message,
  }));
}

module.exports = {
  getSessionReplay,
  getReplayChunk,
};
