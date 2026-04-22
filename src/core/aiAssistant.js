// AI Assistant: real-time command guidance based on learned patterns

import { suggest } from "./learningEngine";

export function getNextHint({ log, history }) {
  const suggestions = suggest(log);

  // avoid repeating same command
  const filtered = suggestions.filter(s => !history.includes(s));

  if (filtered.length > 0) {
    return filtered[0];
  }

  // fallback heuristics
  if (log.includes("nginx")) return "systemctl status nginx";
  if (log.includes("port")) return "lsof -i :80";
  if (log.includes("disk")) return "df -h";

  return "check logs";
}

export function shouldTriggerAI({ attempts }) {
  return attempts >= 3;
}
