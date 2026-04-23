import express from "express";

import { PUBLIC_HOME_PAYLOAD } from "../lib/data.js";

const router = express.Router();

router.get("/home", (req, res) => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(PUBLIC_HOME_PAYLOAD);
});

export default router;
