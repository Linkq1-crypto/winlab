// winlab / core / aiObserver.js

const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.connect();

async function startObserver(sessionId, onInsight) {
  let lastId = "$";

  while (true) {
    const res = await redis.xRead(
      [{ key: `stream:session:${sessionId}`, id: lastId }],
      { BLOCK: 0 }
    );

    if (!res) continue;

    for (const stream of res) {
      for (const message of stream.messages) {
        lastId = message.id;
        const data = message.message;

        const insight = analyze(data);

        if (insight) {
          onInsight(insight);
        }
      }
    }
  }
}

function analyze(event) {
  const entropy = parseFloat(event.entropy || 0);
  const time = parseInt(event.time || 0);

  if (event.type === "cheat") {
    return {
      type: "warning",
      message: "Suspicious behavior detected",
    };
  }

  if (entropy < 1.5) {
    return {
      type: "hint",
      message: "Try typing commands manually instead of pasting",
    };
  }

  if (time > 10000) {
    return {
      type: "hint",
      message: "You're stuck. Try checking file permissions or paths",
    };
  }

  return null;
}

module.exports = {
  startObserver,
};
