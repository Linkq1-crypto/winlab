export const LAB_CATALOG = {
  "advanced-scenarios": {
    title: "Advanced Scenarios",
    issueType: "generic",
    scope: ["winlab/labs/advanced-scenarios"],
    entryPoints: ["winlab/labs/advanced-scenarios"],
    verifyHint: "Make the scenario runnable and stable.",
  },
  "apache-ssl": {
    title: "Apache SSL",
    issueType: "ssl",
    scope: ["winlab/labs/apache-ssl"],
    entryPoints: ["winlab/labs/apache-ssl"],
    verifyHint: "Fix the SSL-related configuration or logic issue.",
  },
  "db-dead": {
    title: "DB Dead",
    issueType: "database",
    scope: ["winlab/labs/db-dead"],
    entryPoints: ["winlab/labs/db-dead"],
    verifyHint: "Restore database connectivity or startup behavior.",
  },
  "disk-full": {
    title: "Disk Full",
    issueType: "filesystem",
    scope: ["winlab/labs/disk-full"],
    entryPoints: ["winlab/labs/disk-full"],
    verifyHint: "Make the lab recover from disk exhaustion.",
  },
  "enhanced-terminal": {
    title: "Enhanced Terminal",
    issueType: "ui-terminal",
    scope: ["winlab/labs/enhanced-terminal"],
    entryPoints: ["winlab/labs/enhanced-terminal"],
    verifyHint: "Fix the terminal behavior without broad UI refactors.",
  },
  "linux-terminal": {
    title: "Linux Terminal",
    issueType: "terminal",
    scope: ["winlab/labs/linux-terminal"],
    entryPoints: ["winlab/labs/linux-terminal"],
    verifyHint: "Fix the shell or command simulation issue.",
  },
  "memory-leak": {
    title: "Memory Leak",
    issueType: "performance-memory",
    scope: ["winlab/labs/memory-leak"],
    entryPoints: ["winlab/labs/memory-leak/index.js"],
    verifyHint: "Stop unbounded memory growth with the smallest safe change.",
  },
  "nginx-port-conflict": {
    title: "Nginx Port Conflict",
    issueType: "network-port",
    scope: ["winlab/labs/nginx-port-conflict"],
    entryPoints: ["winlab/labs/nginx-port-conflict"],
    verifyHint: "Resolve the port conflict cleanly.",
  },
  "permission-denied": {
    title: "Permission Denied",
    issueType: "permissions",
    scope: ["winlab/labs/permission-denied"],
    entryPoints: ["winlab/labs/permission-denied"],
    verifyHint: "Fix the permission issue with minimal privilege changes.",
  },
  "raid-simulator": {
    title: "RAID Simulator",
    issueType: "storage",
    scope: ["winlab/labs/raid-simulator"],
    entryPoints: ["winlab/labs/raid-simulator"],
    verifyHint: "Restore healthy RAID simulation behavior.",
  },
  "real-server": {
    title: "Real Server",
    issueType: "infra-runtime",
    scope: ["winlab/labs/real-server"],
    entryPoints: ["winlab/labs/real-server"],
    verifyHint: "Make the server scenario boot and behave correctly.",
  },
  "sssd-ldap": {
    title: "SSSD LDAP",
    issueType: "auth-directory",
    scope: ["winlab/labs/sssd-ldap"],
    entryPoints: ["winlab/labs/sssd-ldap"],
    verifyHint: "Restore correct LDAP or SSSD authentication behavior.",
  },
};

export function getLabConfig(labId) {
  return LAB_CATALOG[labId] || null;
}

export default { LAB_CATALOG, getLabConfig };
