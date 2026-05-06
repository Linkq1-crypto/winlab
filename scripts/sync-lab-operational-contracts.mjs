import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const labsRoot = path.join(repoRoot, "labs");

const LAB_SERVICE_MAP = {
  "advanced-scenarios": [
    { name: "nginx", role: "edge" },
    { name: "edge-tls", role: "security" },
    { name: "mysql", role: "database" },
    { name: "cron-worker", role: "scheduler" },
    { name: "jvm-app", role: "application" },
    { name: "storage-volume", role: "storage" },
  ],
  "apache-config-error": [
    { name: "apache", role: "edge" },
  ],
  "apache-ssl": [
    { name: "apache", role: "edge" },
    { name: "edge-tls", role: "security" },
  ],
  "api-timeout-n-plus-one": [
    { name: "public-api", role: "application" },
    { name: "postgresql", role: "database" },
    { name: "node-runtime", role: "runtime" },
  ],
  "auth-bypass-jwt-trust": [
    { name: "auth-service", role: "application" },
    { name: "jwt-verifier", role: "security-control" },
  ],
  "blue-green-deploy": [
    { name: "release-controller", role: "delivery" },
    { name: "app-blue", role: "application" },
    { name: "app-green", role: "application" },
  ],
  "cicd-broken-pipeline": [
    { name: "ci-runner", role: "delivery" },
    { name: "artifact-registry", role: "delivery" },
    { name: "deploy-secrets", role: "security-control" },
  ],
  "cloudflare-cache-purge": [
    { name: "cdn-edge", role: "edge" },
    { name: "origin-web", role: "application" },
  ],
  "db-connection-failure": [
    { name: "app-api", role: "application" },
    { name: "postgresql", role: "database" },
  ],
  "db-dead": [
    { name: "postgresql", role: "database" },
    { name: "mysql", role: "database" },
  ],
  "deploy-new-version": [
    { name: "release-controller", role: "delivery" },
    { name: "app-service", role: "application" },
  ],
  "disk-full": [
    { name: "root-filesystem", role: "storage" },
  ],
  "disk-full-recovery": [
    { name: "root-filesystem", role: "storage" },
  ],
  "docker-container-crash": [
    { name: "docker-engine", role: "runtime" },
    { name: "app-container", role: "application" },
  ],
  "enhanced-terminal": [
    { name: "apache", role: "edge" },
    { name: "root-filesystem", role: "storage" },
    { name: "audit-policy", role: "security-control" },
  ],
  "env-var-update": [
    { name: "app-service", role: "application" },
    { name: "config-runtime", role: "configuration" },
  ],
  "ghost-asset-incident": [
    { name: "cdn-edge", role: "edge" },
    { name: "asset-origin", role: "application" },
  ],
  "k8s-crashloop": [
    { name: "kubelet", role: "orchestrator" },
    { name: "workload-pod", role: "application" },
  ],
  "k8s-node-notready": [
    { name: "kubelet", role: "orchestrator" },
    { name: "kube-apiserver", role: "control-plane" },
    { name: "worker-node", role: "compute" },
  ],
  "linux-terminal": [
    { name: "shell-runtime", role: "runtime" },
    { name: "root-filesystem", role: "storage" },
  ],
  "memory-leak": [
    { name: "app-service", role: "application" },
    { name: "node-runtime", role: "runtime" },
  ],
  "memory-leak-diagnosis": [
    { name: "jvm-app", role: "application" },
    { name: "memory-runtime", role: "runtime" },
  ],
  "network-lab": [
    { name: "edge-router", role: "network" },
    { name: "dns-resolver", role: "network" },
  ],
  "nginx-port-conflict": [
    { name: "nginx", role: "edge" },
    { name: "port-binding", role: "runtime" },
  ],
  "nginx-reload": [
    { name: "nginx", role: "edge" },
    { name: "config-runtime", role: "configuration" },
  ],
  "permission-denied": [
    { name: "filesystem-policy", role: "security-control" },
    { name: "application-user", role: "access" },
  ],
  "pm2-crash-recovery": [
    { name: "pm2", role: "process-manager" },
    { name: "node-api", role: "application" },
  ],
  "raid-simulator": [
    { name: "mdadm-array", role: "storage" },
    { name: "block-volume", role: "storage" },
  ],
  "real-server": [
    { name: "apache", role: "edge" },
    { name: "mysql", role: "database" },
    { name: "php-app", role: "application" },
    { name: "system-disk", role: "storage" },
  ],
  "redis-oom": [
    { name: "redis", role: "cache" },
    { name: "app-service", role: "application" },
  ],
  "rollback-failed-deploy": [
    { name: "release-controller", role: "delivery" },
    { name: "app-service", role: "application" },
  ],
  "security-audit": [
    { name: "audit-runner", role: "security-control" },
    { name: "app-service", role: "application" },
  ],
  "ssh-misconfigured": [
    { name: "sshd", role: "access" },
  ],
  "ssl-certificate-renewal": [
    { name: "edge-tls", role: "security" },
    { name: "certificate-manager", role: "security-control" },
  ],
  "sssd-ldap": [
    { name: "sssd", role: "identity-agent" },
    { name: "ldap-directory", role: "identity-store" },
    { name: "pam-auth", role: "security-control" },
  ],
  "stripe-webhook-forgery": [
    { name: "payments-webhook", role: "integration" },
    { name: "signature-verifier", role: "security-control" },
  ],
};

const TOKEN_TO_SERVICES = [
  { match: /\bnginx\b/, services: [{ name: "nginx", role: "edge" }] },
  { match: /\bapache|httpd\b/, services: [{ name: "apache", role: "edge" }] },
  { match: /\bssl|certificate|certbot|tls\b/, services: [{ name: "edge-tls", role: "security" }] },
  { match: /\bauth|jwt|login\b/, services: [{ name: "auth-service", role: "application" }, { name: "jwt-verifier", role: "security-control" }] },
  { match: /\bsssd|ldap\b/, services: [{ name: "sssd", role: "identity-agent" }, { name: "ldap-directory", role: "identity-store" }] },
  { match: /\bpostgres|postgresql|database|db\b/, services: [{ name: "postgresql", role: "database" }] },
  { match: /\bmysql\b/, services: [{ name: "mysql", role: "database" }] },
  { match: /\bredis\b/, services: [{ name: "redis", role: "cache" }] },
  { match: /\bpm2\b/, services: [{ name: "pm2", role: "process-manager" }] },
  { match: /\bnode|api|timeout\b/, services: [{ name: "node-api", role: "application" }, { name: "node-runtime", role: "runtime" }] },
  { match: /\bdocker|container\b/, services: [{ name: "docker-engine", role: "runtime" }, { name: "app-container", role: "application" }] },
  { match: /\bk8s|kubernetes\b/, services: [{ name: "kubelet", role: "orchestrator" }] },
  { match: /\bdeploy|rollback|blue-green|pipeline|cicd|release\b/, services: [{ name: "release-controller", role: "delivery" }] },
  { match: /\bdisk|filesystem|storage\b/, services: [{ name: "root-filesystem", role: "storage" }] },
  { match: /\braid|mdadm\b/, services: [{ name: "mdadm-array", role: "storage" }] },
  { match: /\bmemory|oom|java\b/, services: [{ name: "app-service", role: "application" }, { name: "memory-runtime", role: "runtime" }] },
  { match: /\bnetwork|dns|router\b/, services: [{ name: "edge-router", role: "network" }] },
  { match: /\bssh\b/, services: [{ name: "sshd", role: "access" }] },
  { match: /\bstripe|webhook|payment\b/, services: [{ name: "payments-webhook", role: "integration" }] },
  { match: /\bcloudflare|cache|cdn\b/, services: [{ name: "cdn-edge", role: "edge" }] },
  { match: /\bpermission|selinux|acl\b/, services: [{ name: "filesystem-policy", role: "security-control" }] },
  { match: /\bport\b/, services: [{ name: "port-binding", role: "runtime" }] },
];

function uniqueServices(services) {
  const seen = new Set();
  const out = [];
  for (const service of services) {
    const name = String(service?.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      role: service?.role ? String(service.role).trim() : null,
    });
  }
  return out;
}

function deriveServices(scenario, labName) {
  const curated = LAB_SERVICE_MAP[labName];
  if (curated) return uniqueServices(curated);

  const text = [
    labName,
    scenario?.id,
    scenario?.title,
    ...(Array.isArray(scenario?.tags) ? scenario.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const services = [];
  for (const entry of TOKEN_TO_SERVICES) {
    if (entry.match.test(text)) {
      services.push(...entry.services);
    }
  }

  if (services.length === 0) {
    services.push({ name: "app-service", role: "application" });
  }

  return uniqueServices(services);
}

function servicesEqual(left, right) {
  return JSON.stringify(uniqueServices(left)) === JSON.stringify(uniqueServices(right));
}

function updateScenarioJson(labDir) {
  const scenarioPath = path.join(labDir, "scenario.json");
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  const nextServices = deriveServices(scenario, path.basename(labDir));

  if (servicesEqual(scenario.services || [], nextServices)) {
    return false;
  }

  scenario.services = nextServices;
  fs.writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, "utf8");
  return true;
}

function sentenceCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildVerifyPrelude(serviceNames) {
  const label = serviceNames.map(sentenceCase).join(", ");
  return `
WINLAB_SERVICES='${JSON.stringify(serviceNames)}'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '${JSON.stringify({ type: "affected_services_update", services: serviceNames, source: "verify" })}'
  signal '${JSON.stringify({ type: "service_health", services: serviceNames, status: "degraded", progress: 68, source: "verify" })}'
  signal '${JSON.stringify({ type: "phase_update", phase: "validation", progress: 82, source: "verify" })}'
}

emit_winlab_verify_exit() {
  local status="\${1:-0}"
  if [[ "\${status}" -eq 0 ]]; then
    signal '${JSON.stringify({ type: "service_health", services: serviceNames, status: "recovering", progress: 92, source: "verify" })}'
    signal '${JSON.stringify({ type: "phase_update", phase: "recovery", progress: 92, source: "verify" })}'
    signal '${JSON.stringify({ type: "service_health", services: serviceNames, status: "healthy", progress: 100, source: "verify" })}'
    signal '${JSON.stringify({ type: "verification_result", status: "passed", summary: `Validation checks passed for ${label}.`, source: "verify" })}'
  else
    signal '${JSON.stringify({ type: "service_health", services: serviceNames, status: "failed", progress: 82, source: "verify" })}'
    signal '${JSON.stringify({ type: "verification_result", status: "failed", summary: `Validation checks failed for ${label}.`, source: "verify" })}'
  fi
}

emit_winlab_on_exit() {
  local status="$?"
  trap - EXIT
  emit_winlab_verify_exit "\${status}"
  exit "\${status}"
}

emit_winlab_initial_signals
trap emit_winlab_on_exit EXIT
`.trim();
}

function updateVerifyScript(labDir) {
  const verifyPath = path.join(labDir, "verify.sh");
  let content = fs.readFileSync(verifyPath, "utf8");

  const scenario = JSON.parse(fs.readFileSync(path.join(labDir, "scenario.json"), "utf8"));
  const serviceNames = uniqueServices(Array.isArray(scenario.services) ? scenario.services : deriveServices(scenario, path.basename(labDir)))
    .map((service) => service.name);
  const prelude = buildVerifyPrelude(serviceNames);

  if (content.includes("emit_winlab_initial_signals()")) {
    const replaced = content.replace(
      /WINLAB_SERVICES='[\s\S]*?trap emit_winlab_on_exit EXIT\s*/m,
      `${prelude}\n\n`
    );
    if (replaced === content) return false;
    fs.writeFileSync(verifyPath, replaced, "utf8");
    return true;
  }

  if (content.includes("WINLAB_SIGNAL")) return false;

  const marker = "set -euo pipefail";
  const idx = content.indexOf(marker);
  if (idx >= 0) {
    const insertAt = idx + marker.length;
    content = `${content.slice(0, insertAt)}\n\n${prelude}\n${content.slice(insertAt)}`;
  } else if (content.startsWith("#!/")) {
    const firstNewline = content.indexOf("\n");
    content = `${content.slice(0, firstNewline + 1)}\n${prelude}\n${content.slice(firstNewline + 1)}`;
  } else {
    content = `${prelude}\n\n${content}`;
  }

  fs.writeFileSync(verifyPath, content, "utf8");
  return true;
}

function main() {
  const labDirs = fs.readdirSync(labsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(labsRoot, entry.name));

  let scenariosUpdated = 0;
  let verifyUpdated = 0;

  for (const labDir of labDirs) {
    const scenarioPath = path.join(labDir, "scenario.json");
    const verifyPath = path.join(labDir, "verify.sh");
    if (fs.existsSync(scenarioPath) && updateScenarioJson(labDir)) scenariosUpdated += 1;
    if (fs.existsSync(verifyPath) && updateVerifyScript(labDir)) verifyUpdated += 1;
  }

  console.log(JSON.stringify({ scenariosUpdated, verifyUpdated }, null, 2));
}

main();
