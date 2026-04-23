import express from "express";

import { LABS } from "../lib/data.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    labs: LABS,
  });
});

export default router;
