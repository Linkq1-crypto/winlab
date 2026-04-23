// assessment basic flow

const express = require("express");
const router = express.Router();

// placeholder endpoints
router.post("/create", (req, res) => {
  res.json({ ok: true, id: "assessment-demo" });
});

router.post("/invite", (req, res) => {
  res.json({ ok: true, link: "/assessment/start/demo" });
});

router.get("/start/:token", (req, res) => {
  res.json({ ok: true, token: req.params.token });
});

router.post("/submit", (req, res) => {
  res.json({ ok: true });
});

router.get("/result/:id", (req, res) => {
  res.json({ ok: true, id: req.params.id });
});

module.exports = router;
