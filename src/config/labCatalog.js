export const LAB_CATALOG = {
  "advanced-scenarios": {
    title: "Advanced Scenarios",
    issueType: "generic",
    scope: ["labs/advanced-scenarios"],
    entryPoints: ["labs/advanced-scenarios"],
    verifyHint: "Make the scenario runnable and stable.",
  },
  "apache-ssl": {
    title: "Apache SSL",
    issueType: "ssl",
    scope: ["labs/apache-ssl"],
    entryPoints: ["labs/apache-ssl"],
    verifyHint: "Fix the SSL-related configuration or logic issue.",
  },
  "db-dead": {
    title: "DB Dead",
    issueType: "database",
    scope: ["labs/db-dead"],
    entryPoints: ["labs/db-dead"],
    verifyHint: "Restore database connectivity or startup behavior.",
  },
  "disk-full": {
    title: "Disk Full",
    issueType: "filesystem",
    scope: ["labs/disk-full"],
    entryPoints: ["labs/disk-full"],
    verifyHint: "Make the lab recover from disk exhaustion.",
  },
  "enhanced-terminal": {
    title: "Enhanced Terminal",
    issueType: "ui-terminal",
    scope: ["labs/enhanced-terminal"],
    entryPoints: ["labs/enhanced-terminal"],
    verifyHint: "Fix the terminal behavior without broad UI refactors.",
  },
  "linux-terminal": {
    title: "Linux Terminal",
    issueType: "terminal",
    scope: ["labs/linux-terminal"],
    entryPoints: ["labs/linux-terminal"],
    verifyHint: "Fix the shell or command simulation issue.",
  },
  "memory-leak": {
    title: "Memory Leak",
    issueType: "performance-memory",
    scope: ["labs/memory-leak"],
    entryPoints: ["labs/memory-leak/index.js"],
    verifyHint: "Stop unbounded memory growth with the smallest safe change.",
    verifyCommand: {
      cmd: "npm",
      args: ["run", "verify:memory-leak"],
      timeoutMs: 15_000,
    },
  },
  "nginx-port-conflict": {
    title: "Nginx Port Conflict",
    issueType: "network-port",
    scope: ["labs/nginx-port-conflict"],
    entryPoints: ["labs/nginx-port-conflict"],
    verifyHint: "Resolve the port conflict cleanly.",
    verifyCommand: {
      cmd: "npm",
      args: ["run", "verify:nginx-port-conflict"],
      timeoutMs: 15_000,
    },
  },
  "permission-denied": {
    title: "Permission Denied",
    issueType: "permissions",
    scope: ["labs/permission-denied"],
    entryPoints: ["labs/permission-denied"],
    verifyHint: "Fix the permission issue with minimal privilege changes.",
    verifyCommand: {
      cmd: "npm",
      args: ["run", "verify:permission-denied"],
      timeoutMs: 15_000,
    },
  },
  "raid-simulator": {
    title: "RAID Simulator",
    issueType: "storage",
    scope: ["labs/raid-simulator"],
    entryPoints: ["labs/raid-simulator"],
    verifyHint: "Restore healthy RAID simulation behavior.",
  },
  "real-server": {
    title: "Real Server",
    issueType: "infra-runtime",
    scope: ["labs/real-server"],
    entryPoints: ["labs/real-server"],
    verifyHint: "Make the server scenario boot and behave correctly.",
    verifyCommand: {
      cmd: "npm",
      args: ["run", "verify:real-server"],
      timeoutMs: 20_000,
    },
  },
  "sssd-ldap": {
    title: "SSSD LDAP",
    issueType: "auth-directory",
    scope: ["labs/sssd-ldap"],
    entryPoints: ["labs/sssd-ldap"],
    verifyHint: "Restore correct LDAP or SSSD authentication behavior.",
    verifyCommand: {
      cmd: "npm",
      args: ["run", "verify:sssd-ldap"],
      timeoutMs: 20_000,
    },
  },
};

export function getLabConfig(labId) {
  return LAB_CATALOG[labId] || null;
}

export default { LAB_CATALOG, getLabConfig };
