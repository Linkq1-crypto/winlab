import nginx from "../incidents/nginx_down";
import disk from "../incidents/disk_full";
import port from "../incidents/nginx_port_conflict";

const registry = {
  nginx_down: nginx,
  disk_full: disk,
  nginx_port_conflict: port
};

export function loadIncident(id) {
  const incident = registry[id];

  if (!incident) {
    return {
      id: "fallback",
      initialState: {},
      state: {},
      handle: () => ({
        output: "incident not found",
        state: {}
      }),
      isSolved: () => false
    };
  }

  return {
    ...incident,
    state: incident.initialState
  };
}
