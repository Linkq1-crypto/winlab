export const skillTree = {
  systems: {
    label: "Systems",
    nodes: ["apache_down", "nginx_down"]
  },
  debugging: {
    label: "Debugging",
    unlocks: ["systems"],
    nodes: ["port_conflict", "disk_full"]
  },
  infra: {
    label: "Infrastructure",
    unlocks: ["debugging"],
    nodes: ["infra_drift"]
  }
};