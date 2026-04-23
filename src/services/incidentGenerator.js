import { getLevelConfig } from "../config/levels.js";
import { apiTimeoutTemplate } from "../labs/api-timeout/template.js";
import { nginxPortConflictTemplate } from "../labs/nginx-port-conflict/template.js";
import { permissionDeniedTemplate } from "../labs/permission-denied/template.js";

const LAB_TEMPLATES = {
  "api-timeout": apiTimeoutTemplate,
  "memory-leak": apiTimeoutTemplate,
  "nginx-port-conflict": nginxPortConflictTemplate,
  "permission-denied": permissionDeniedTemplate,
};

export function hasIncidentTemplate(labId) {
  return Boolean(LAB_TEMPLATES[labId]);
}

export function generateIncident({
  labId,
  seed = null,
  level: levelInput = "JUNIOR",
}) {
  const template = LAB_TEMPLATES[labId];
  if (!template) throw new Error(`Unknown incident template: ${labId}`);

  const level = getLevelConfig(levelInput?.id || levelInput);
  const normalizedSeed = String(seed || `${labId}:${Date.now()}`);
  const rng = createSeededRng(normalizedSeed);
  const rootCauseCount = level.id === "SRE"
    ? Math.min(2, template.rootCauses.length)
    : 1;
  const rootCauses = pickRootCauses(template.rootCauses, rootCauseCount, rng);
  const logs = buildLogs(template, rootCauses, rng, level);

  return {
    labId,
    templateId: template.id,
    seed: normalizedSeed,
    rootCauseId: rootCauses.map((item) => item.id).join("+"),
    rootCauseIds: rootCauses.map((item) => item.id),
    description: rootCauses.map((item) => item.description).join(" "),
    logs,
    mutations: rootCauses.flatMap((item) => item.mutations || []),
    verify: mergeVerify(rootCauses),
    level: level.id,
  };
}

function buildLogs(template, rootCauses, rng, level) {
  const sourceLogs = [
    ...template.baseLogs,
    ...rootCauses.flatMap((item) => item.signals || []),
  ];
  const logs = [];

  for (const log of sourceLogs) {
    if (rng() < level.noiseLevel) {
      logs.push(pickNoise(rng));
    }

    if (level.logClarity < 0.5 && rng() > level.logClarity) {
      logs.push(log.replace(/\b(timeout|failed|denied|exhausted|conflict)\b/gi, "signal"));
    } else {
      logs.push(log);
    }
  }

  return logs;
}

function pickRootCauses(items, count, rng) {
  const pool = [...items];
  const picked = [];

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function mergeVerify(rootCauses) {
  return {
    mustContain: [...new Set(rootCauses.flatMap((item) => item.verify?.mustContain || []))],
  };
}

function pickNoise(rng) {
  const noise = [
    "[noise] background metric scrape delayed",
    "[noise] unrelated cron job completed",
    "[noise] access log rotated",
    "[noise] stale health probe ignored",
  ];
  return noise[Math.floor(rng() * noise.length)];
}

function createSeededRng(seed) {
  let state = 2166136261;
  for (const char of String(seed)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const _test = { createSeededRng, buildLogs, pickRootCauses };

export default {
  generateIncident,
  hasIncidentTemplate,
};
