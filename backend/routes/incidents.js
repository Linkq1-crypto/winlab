import express from "express";

import { LABS } from "../lib/data.js";
import { createIncident } from "../lib/incidents.js";
import { requireMockAuth } from "../lib/mockAuth.js";

const router = express.Router();

// Labs available without login — homepage sequence labs 1-3
const GUEST_LABS = ["nginx-port-conflict", "disk-full", "permission-denied"];

router.post("/start", requireMockAuth, (req, res) => {
  const { labSlug } = req.body || {};

  if (!labSlug || typeof labSlug !== "string") {
    res.status(400).json({ error: { message: "labSlug is required" } });
    return;
  }

  const labExists = LABS.some((lab) => lab.slug === labSlug);
  if (!labExists) {
    res.status(404).json({ error: { message: "Lab not found" } });
    return;
  }

  const incident = createIncident({ labSlug, userId: req.session.user.id });

  res.status(200).json({
    incidentId: incident.incidentId,
    labSlug: incident.labSlug,
    status: incident.status,
    terminalUrl: `/labs/${incident.labSlug}/incidents/${incident.incidentId}`,
  });
});

// Guest route — no auth required, only GUEST_LABS allowed
router.post("/start-guest", (req, res) => {
  const { labSlug } = req.body || {};

  if (!labSlug || typeof labSlug !== "string") {
    res.status(400).json({ error: { message: "labSlug is required" } });
    return;
  }

  if (!GUEST_LABS.includes(labSlug)) {
    res.status(403).json({ error: { message: "Lab requires an account" } });
    return;
  }

  const guestId = `guest_${Date.now().toString(36)}`;
  const incident = createIncident({ labSlug, userId: guestId });

  res.status(200).json({
    incidentId: incident.incidentId,
    labSlug: incident.labSlug,
    status: incident.status,
    terminalUrl: `/labs/${incident.labSlug}/incidents/${incident.incidentId}`,
    guest: true,
  });
});

export default router;
