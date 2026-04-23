export const incidents = new Map();

export function createIncident({ labSlug, userId }) {
  const incidentId = `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const incident = {
    incidentId,
    labSlug,
    userId,
    status: "live",
    terminalUrl: `/terminal/${incidentId}`,
    createdAt: new Date().toISOString(),
  };

  incidents.set(incidentId, incident);
  return incident;
}
