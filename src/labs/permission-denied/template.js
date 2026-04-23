export const permissionDeniedTemplate = {
  id: "permission-denied",
  title: "Permission Denied",
  rootCauses: [
    {
      id: "state_path_owner",
      description: "The service user cannot write its state file because ownership drifted.",
      mutations: [],
      signals: [
        "permission denied: /var/lib/app/state.json",
        "worker failed to write checkpoint",
      ],
      verify: {
        mustContain: ["state write restored"],
      },
    },
    {
      id: "overly_strict_mode",
      description: "A directory mode change removed write permission from the runtime group.",
      mutations: [],
      signals: [
        "checkpoint directory not writable",
        "recovery loop entered",
      ],
      verify: {
        mustContain: ["least privilege restored"],
      },
    },
  ],
  baseLogs: [
    "service degraded",
    "write attempts blocked",
    "recovery controller active",
  ],
};

export default permissionDeniedTemplate;
