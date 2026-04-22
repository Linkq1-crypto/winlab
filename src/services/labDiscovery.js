import fs from "fs";
import path from "path";

function toRepoPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function findLabsRoot(repoRoot) {
  const root = path.resolve(repoRoot || process.cwd());
  const candidates = [
    path.join(root, "winlab", "labs"),
    path.join(root, "labs"),
  ];

  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  }) || null;
}

export function discoverLabs(repoRoot) {
  const root = path.resolve(repoRoot || process.cwd());
  const labsRoot = findLabsRoot(root);
  if (!labsRoot) return [];

  const dirs = fs
    .readdirSync(labsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  return dirs.map((name) => {
    const labPath = toRepoPath(path.relative(root, path.join(labsRoot, name)));

    return {
      id: name,
      title: humanize(name),
      scope: [labPath],
      entryPoints: [labPath],
      type: detectType(name),
    };
  });
}

function humanize(name) {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectType(name) {
  if (name.includes("memory")) return "performance";
  if (name.includes("disk")) return "infra";
  if (name.includes("nginx")) return "network";
  if (name.includes("permission")) return "security";
  if (name.includes("auth")) return "security";
  return "generic";
}

export default { discoverLabs };

