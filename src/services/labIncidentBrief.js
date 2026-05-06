import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLabOperationalMetadata } from "./labMetadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const LABS_ROOT = path.join(REPO_ROOT, "labs");

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function titleCase(value, fallback = "Unknown") {
  const raw = String(value || "").trim().replace(/[-_]+/g, " ");
  if (!raw) return fallback;
  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectHints(scenario, locale) {
  const scenarioHints = Array.isArray(scenario?.hints) ? scenario.hints : [];
  const localeHints = Object.entries(locale || {})
    .filter(([key, value]) => /^hint_\d+$/.test(key) && typeof value === "string" && value.trim())
    .sort((a, b) => Number(a[0].split("_")[1]) - Number(b[0].split("_")[1]))
    .map(([, value]) => value.trim());
  return scenarioHints.length > 0 ? scenarioHints : localeHints;
}

function extractSuggestedCommands(hints) {
  const commands = [];
  const seen = new Set();

  hints.forEach((hint) => {
    const text = String(hint || "").trim();
    if (!text) return;

    const match = text.match(/:\s*(.+)$/);
    const candidate = (match ? match[1] : text)
      .replace(/[–—]/g, "-")
      .trim();

    if (!candidate) return;
    if (!/[\/.=]|&&|\b(cat|sed|echo|ss|pgrep|nohup|apache2ctl|systemctl|grep|python3|sshd)\b/i.test(candidate)) {
      return;
    }

    if (!seen.has(candidate)) {
      seen.add(candidate);
      commands.push(candidate);
    }
  });

  return commands;
}

function buildNeutralBrief(labId, labTitle) {
  return {
    labId,
    labTitle,
    incidentType: "Incident Brief Pending",
    symptoms: "",
    objective: "",
    successCondition: "",
    suggestedCommands: [],
    hints: [],
  };
}

export function getLabIncidentBrief(labId) {
  const safeLabId = String(labId || "").trim();
  const labDir = path.join(LABS_ROOT, safeLabId);
  const scenario = safeReadJson(path.join(labDir, "scenario.json"));
  const locale = safeReadJson(path.join(labDir, "locales", "en.json"));
  const metadata = getLabOperationalMetadata(safeLabId);

  const fallbackTitle = titleCase(safeLabId, "Unknown Lab");
  const labTitle = String(scenario?.title || fallbackTitle).trim() || fallbackTitle;
  if (!scenario && !locale) {
    return buildNeutralBrief(safeLabId, labTitle);
  }

  const hints = collectHints(scenario, locale);
  const description = typeof locale?.description === "string" ? locale.description.trim() : "";
  const lesson = typeof locale?.lesson === "string" ? locale.lesson.trim() : "";
  const success = typeof locale?.success === "string" ? locale.success.trim() : "";

  const objective = lesson || `Resolve the ${labTitle} incident and restore the service to a healthy state.`;

  return {
    labId: safeLabId,
    labTitle,
    incidentType: labTitle,
    symptoms: description,
    objective,
    successCondition: success || "Incident resolved.",
    suggestedCommands: extractSuggestedCommands(hints),
    hints,
    affectedServices: metadata.services.map((service) => service.name),
  };
}
