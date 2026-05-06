import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLabOperationalMetadata } from "./labMetadata.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const LABS_ROOT = path.join(REPO_ROOT, "labs");
const SITE_RUNTIME_IMAGE = "winlab-lab-runner:latest";

const TIER_TO_CATEGORY = {
  starter: "Starter",
  pro: "Pro",
  codex: "Codex",
  ops: "Ops",
  business: "Business",
};

const DIFFICULTY_LABELS = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const TIER_XP_BASE = {
  starter: 100,
  pro: 250,
  ops: 350,
  codex: 500,
  business: 300,
};

const DIFFICULTY_XP_BONUS = {
  easy: 50,
  medium: 150,
  hard: 300,
};

function titleCase(value, fallback = "Unknown") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function estimateXp({ tier, difficulty, duration }) {
  const base = TIER_XP_BASE[tier] ?? 200;
  const difficultyBonus = DIFFICULTY_XP_BONUS[difficulty] ?? 100;
  const durationBonus = Math.max(0, Number(duration) || 0) * 10;
  return base + difficultyBonus + durationBonus;
}

function readScenario(labDir) {
  const scenarioPath = path.join(labDir, "scenario.json");
  const raw = fs.readFileSync(scenarioPath, "utf8");
  return JSON.parse(raw);
}

function hasRuntimeFiles(labDir) {
  const required = ["scenario.json", "seed.sh", "verify.sh", "reset.sh"];
  return required.every((file) => fs.existsSync(path.join(labDir, file)));
}

function toSiteLab(labName, scenario) {
  const metadata = getLabOperationalMetadata(scenario.id || labName);
  const tier = String(scenario.tier || "pro").toLowerCase();
  const difficulty = String(scenario.difficulty || "medium").toLowerCase();
  const duration = Number(scenario.duration) || 15;

  return {
    id: scenario.id || labName,
    title: scenario.title || titleCase(labName.replace(/-/g, " ")),
    tier: titleCase(tier, "Pro"),
    category: TIER_TO_CATEGORY[tier] || "Pro",
    difficulty: DIFFICULTY_LABELS[difficulty] || titleCase(difficulty, "Medium"),
    duration,
    durationLabel: `${duration}m`,
    xp: estimateXp({ tier, difficulty, duration }),
    tags: Array.isArray(scenario.tags) ? scenario.tags : [],
    status: scenario.status || "runnable",
    runtimeType: scenario.type || "ubuntu",
    runtimeImage: SITE_RUNTIME_IMAGE,
    services: metadata.services,
  };
}

export function listSiteLabs() {
  const entries = fs.readdirSync(LABS_ROOT, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const labDir = path.join(LABS_ROOT, entry.name);
      if (!hasRuntimeFiles(labDir)) return null;
      return toSiteLab(entry.name, readScenario(labDir));
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getSiteLabCatalog() {
  const labs = listSiteLabs();
  const starterIds = labs.filter((lab) => lab.category === "Starter").map((lab) => lab.id);

  return {
    total: labs.length,
    runtimeImages: [SITE_RUNTIME_IMAGE],
    starterIds,
    labs,
  };
}

export const _test = {
  estimateXp,
  hasRuntimeFiles,
  toSiteLab,
};
