import express from "express";

import { getMockSession } from "../lib/mockAuth.js";

const router = express.Router();

router.get("/session", (req, res) => {
  res.json(getMockSession(req));
});

export default router;
