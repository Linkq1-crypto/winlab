// winlab / backend / routes / replay.js

const express = require("express");
const router = express.Router();

const { getSessionReplay, getReplayChunk } = require("../../core/replayEngine");

// full replay
router.get("/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const data = await getSessionReplay(sessionId);

  res.json(data);
});

// chunked replay (streaming)
router.get("/:sessionId/chunk", async (req, res) => {
  const { sessionId } = req.params;
  const { lastId } = req.query;

  const data = await getReplayChunk(sessionId, lastId);

  res.json(data);
});

module.exports = router;
