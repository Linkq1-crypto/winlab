import { LAB_CATALOG } from "../config/labCatalog";
import { CODEX_INCIDENT_LABS } from "./codexIncidentLabs";
import { opsLabScenarios } from "../opsPlaybookScenarios";

const STARTER_TIER_IDS = [
  "linux-terminal",
  "enhanced-terminal",
  "disk-full",
  "nginx-port-conflict",
];

const PRO_TIER_IDS = [
  "permission-denied",
  "raid-simulator",
  "memory-leak",
  "db-dead",
  "sssd-ldap",
  "advanced-scenarios",
  "real-server",
];

const CODEX_LAB_IDS = [
  "api-timeout-n-plus-one",
  "auth-bypass-jwt-trust",
  "stripe-webhook-forgery",
];

const OPS_PLAYBOOK_IDS = [
  "deploy-new-version",
  "rollback-failed-deploy",
  "nginx-reload",
  "pm2-crash-recovery",
  "ssl-certificate-renewal",
  "cloudflare-cache-purge",
  "memory-leak-diagnosis",
  "db-connection-failure",
  "env-var-update",
  "docker-container-crash",
  "k8s-crashloop",
  "redis-oom",
];

export const CATALOG_TOTALS = Object.freeze({
  starterLabs: 4,
  proLabs: 7,
  codexIncidentLabs: 3,
  opsPlaybookScenarios: 17,
  businessPlaceholders: 3,
  totalCatalogItems: 34,
});

const catalogIndex = LAB_CATALOG;
const codexIndex = Object.fromEntries(CODEX_INCIDENT_LABS.map((lab) => [lab.id, lab]));
const opsIndex = Object.fromEntries(opsLabScenarios.map((lab) => [lab.id, lab]));

const LEVEL_TRACKS = Object.freeze({
  Novice: Object.freeze({
    difficulty: "easy",
    hints: "guided",
    aiMentor: "patch available",
    trackLabel: "Starter Tier",
    previewLabIds: ["linux-terminal", "disk-full", "nginx-port-conflict", "enhanced-terminal"],
    primaryLabId: "nginx-port-conflict",
    commands: ["systemctl status nginx", "journalctl -u nginx -n 20 --no-pager"],
    metrics: Object.freeze([
      { label: "free labs available", value: String(CATALOG_TOTALS.starterLabs) },
    ]),
  }),
  Junior: Object.freeze({
    difficulty: "medium",
    hints: "available",
    aiMentor: "patch available",
    trackLabel: "Junior Operator",
    previewLabIds: ["nginx-port-conflict", "disk-full", "permission-denied", "raid-simulator", "enhanced-terminal"],
    primaryLabId: "nginx-port-conflict",
    commands: ["systemctl status nginx", "journalctl -u nginx -n 20 --no-pager"],
    metrics: Object.freeze([
      { label: "free labs available", value: "4" },
      { label: "pro labs preview", value: "2" },
    ]),
  }),
  Mid: Object.freeze({
    difficulty: "medium/hard",
    hints: "limited",
    aiMentor: "review + patch",
    trackLabel: "Production Debugger",
    previewLabIds: ["permission-denied", "raid-simulator", "memory-leak", "db-dead", "advanced-scenarios"],
    primaryLabId: "permission-denied",
    commands: ["systemctl status myapp", "journalctl -u myapp -n 40 --no-pager"],
    metrics: Object.freeze([
      { label: "pro labs available", value: String(CATALOG_TOTALS.proLabs) },
    ]),
  }),
  Senior: Object.freeze({
    difficulty: "hard",
    hints: "limited",
    aiMentor: "review only",
    trackLabel: "Senior Incident Response",
    previewLabIds: ["memory-leak", "db-dead", "sssd-ldap", "advanced-scenarios", "real-server"],
    primaryLabId: "memory-leak",
    commands: ["systemctl status myapp", "journalctl -u myapp -n 40 --no-pager"],
    metrics: Object.freeze([
      { label: "real server scenarios", value: "12" },
    ]),
  }),
  SRE: Object.freeze({
    difficulty: "expert",
    hints: "disabled",
    aiMentor: "disabled",
    trackLabel: "SRE Pressure Mode",
    previewLabIds: [
      "real-server",
      "api-timeout-n-plus-one",
      "auth-bypass-jwt-trust",
      "stripe-webhook-forgery",
      "k8s-crashloop",
    ],
    primaryLabId: "real-server",
    commands: ["kubectl get pods -n production", "kubectl logs -n production -l app=myapp --previous"],
    metrics: Object.freeze([
      { label: "ops scenarios available", value: String(CATALOG_TOTALS.opsPlaybookScenarios) },
      { label: "codex incident labs", value: String(CATALOG_TOTALS.codexIncidentLabs) },
    ]),
  }),
});

export function getOnboardingTrack(level = "Junior") {
  const track = LEVEL_TRACKS[level] || LEVEL_TRACKS.Junior;
  const previewLabs = track.previewLabIds.map(getLabEntry).filter(Boolean);
  const primaryLab = getLabEntry(track.primaryLabId) || previewLabs[0] || null;

  return {
    level,
    difficulty: track.difficulty,
    hints: track.hints,
    aiMentor: track.aiMentor,
    trackLabel: track.trackLabel,
    commands: track.commands,
    previewLabs,
    primaryLab,
    metrics: track.metrics,
  };
}

function getLabEntry(labId) {
  const catalogLab = catalogIndex[labId];
  if (catalogLab) {
    return {
      id: labId,
      slug: labId,
      title: catalogLab.title,
      source: resolveSourceLabel(labId),
      summary: catalogLab.verifyHint,
    };
  }

  const codexLab = codexIndex[labId];
  if (codexLab) {
    return {
      id: labId,
      slug: labId,
      title: codexLab.title,
      source: "Codex Labs",
      summary: codexLab.goal,
    };
  }

  const opsLab = opsIndex[labId];
  if (opsLab) {
    return {
      id: labId,
      slug: labId,
      title: opsLab.title,
      source: "Ops Playbook",
      summary: opsLab.objective,
    };
  }

  return null;
}

function resolveSourceLabel(labId) {
  if (STARTER_TIER_IDS.includes(labId)) return "Starter Tier";
  if (PRO_TIER_IDS.includes(labId)) return "Pro Tier";
  return "WinLab";
}

export default getOnboardingTrack;
