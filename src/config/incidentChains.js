export const INCIDENT_CHAINS = {
  "web-stack-recovery": {
    id: "web-stack-recovery",
    title: "Web Stack Recovery",
    difficulty: "mid",
    steps: [
      {
        id: "port-conflict",
        labId: "nginx-port-conflict",
        successMessage: "Edge listener restored.",
      },
      {
        id: "upstream-down",
        labId: "permission-denied",
        successMessage: "Application process restored.",
      },
      {
        id: "db-pool",
        labId: "memory-leak",
        variantLabId: "api-timeout",
        successMessage: "Latency stabilized.",
      },
    ],
    finalMessage: "Customer traffic recovered.",
  },

  "auth-recovery-chain": {
    id: "auth-recovery-chain",
    title: "Auth Recovery Chain",
    difficulty: "senior",
    steps: [
      {
        id: "permission-denied",
        labId: "permission-denied",
        successMessage: "Write path restored.",
      },
      {
        id: "sssd-auth",
        labId: "sssd-ldap",
        successMessage: "Directory auth responding.",
      },
    ],
    finalMessage: "Authentication flow stabilized.",
  },

  "infra-degradation-chain": {
    id: "infra-degradation-chain",
    title: "Infra Degradation Chain",
    difficulty: "sre",
    steps: [
      {
        id: "disk-pressure",
        labId: "disk-full",
        successMessage: "Disk pressure contained.",
      },
      {
        id: "restart-loop",
        labId: "real-server",
        successMessage: "Restart loop stopped.",
      },
      {
        id: "memory-leak",
        labId: "memory-leak",
        variantLabId: "api-timeout",
        successMessage: "Runtime memory stabilized.",
      },
    ],
    finalMessage: "Infrastructure degradation cleared.",
  },
};

export function getIncidentChain(chainId) {
  return INCIDENT_CHAINS[chainId] || null;
}

export function listIncidentChains() {
  return Object.values(INCIDENT_CHAINS);
}

export default { INCIDENT_CHAINS, getIncidentChain, listIncidentChains };
