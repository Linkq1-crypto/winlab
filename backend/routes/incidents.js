import express from "express";

import { LABS } from "../lib/data.js";
import { createIncident } from "../lib/incidents.js";
import { requireMockAuth } from "../lib/mockAuth.js";

const router = express.Router();

router.post("/start", requireMockAuth, (req, res) => {
  const { labSlug } = req.body || {};

  if (!labSlug || typeof labSlug !== "string") {
    res.status(400).json({
      error: {
        message: "labSlug is required",
      },
    });
    return;
  }

  const labExists = LABS.some((lab) => lab.slug === labSlug);
  if (!labExists) {
    res.status(404).json({
      error: {
        message: "Lab not found",
      },
    });
    return;
  }

  const incident = createIncident({
    labSlug,
    userId: req.session.user.id,
  });

  res.status(201).json({
    incidentId: incident.incidentId,
    labSlug: incident.labSlug,
    status: incident.status,
    terminalUrl: incident.terminalUrl,
  });
});

export default router;
