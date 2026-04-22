import { createLabContainer } from "../../infra/docker.js";
import { scheduleDestroy } from "../../infra/ttl.js";

export async function startLab(req, res) {
  const userId = "demo";
  const labId = "lab1";

  const container = createLabContainer(userId, labId);

  scheduleDestroy(container);

  res.json({ success: true, container });
}
