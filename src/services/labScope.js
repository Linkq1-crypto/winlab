import fs from "fs";
import path from "path";

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function backendScope(repoRoot) {
  const root = path.resolve(repoRoot || process.cwd());
  const candidates = [
    ["winlab/backend", path.join(root, "winlab", "backend")],
    ["backend", path.join(root, "backend")],
  ];

  const found = candidates.find(([, absPath]) => {
    try {
      return fs.statSync(absPath).isDirectory();
    } catch {
      return false;
    }
  });

  return found?.[0] || "winlab/backend";
}

export function enhanceScope(lab, { repoRoot } = {}) {
  const needsBackend =
    lab.id.includes("memory") ||
    lab.id.includes("api") ||
    lab.id.includes("auth");

  if (!needsBackend) return lab;

  return {
    ...lab,
    scope: unique([...(lab.scope || []), backendScope(repoRoot)]),
  };
}

export default { enhanceScope };

