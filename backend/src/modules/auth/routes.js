import express from "express";
import { generateToken } from "../../core/auth.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const { email } = req.body;

  const user = { id: Date.now().toString(), email };

  const token = generateToken(user);

  res.json({ token, user });
});

export default router;
