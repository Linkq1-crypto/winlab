import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function normalizeServiceEntry(entry) {
  if (typeof entry === "string" && entry.trim()) {
    return { name: entry.trim(), role: null };
  }
  if (!entry || typeof entry !== "object") return null;
  const name = String(entry.name || "").trim();
  if (!name) return null;
  const role = entry.role ? String(entry.role).trim() : null;
  return { name, role };
}

export function getLabScenario(labId) {
  const safeLabId = String(labId || "").trim();
  if (!safeLabId) return null;
  return safeReadJson(path.join(LABS_ROOT, safeLabId, "scenario.json"));
}

export function getLabOperationalMetadata(labId) {
  const scenario = getLabScenario(labId);
  const services = Array.isArray(scenario?.services)
    ? scenario.services.map(normalizeServiceEntry).filter(Boolean)
    : [];

  return {
    scenario,
    services,
  };
}

export function extractLabServiceNames(labId) {
  return getLabOperationalMetadata(labId).services.map((service) => service.name);
}

export default {
  getLabScenario,
  getLabOperationalMetadata,
  extractLabServiceNames,
};
