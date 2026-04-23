import express from "express";

import { MOCK_PROGRESS } from "../lib/data.js";
import { incidents } from "../lib/incidents.js";
import { requireMockAuth } from "../lib/mockAuth.js";

const router = express.Router();

router.get("/progress", requireMockAuth, (req, res) => {
  const activeIncidents = Array.from(incidents.values()).filter(
    (incident) => incident.userId === req.session.user.id
  );

  res.json({
    completedLabs: MOCK_PROGRESS.completedLabs,
    activeIncidents: activeIncidents.length,
    certificates: MOCK_PROGRESS.certificates,
    currentStreakDays: MOCK_PROGRESS.currentStreakDays,
    recentLabs: MOCK_PROGRESS.recentLabs,
  });
});

export default router;
