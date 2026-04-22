// report endpoint (download)

const express = require("express");
const router = express.Router();

router.get("/:sessionId", async (req, res) => {
  res.json({ ok: true, sessionId: req.params.sessionId });
});

module.exports = router;
