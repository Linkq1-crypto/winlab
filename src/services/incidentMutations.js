import fs from "fs/promises";
import path from "path";

export async function applyIncidentMutations(workspace, incident) {
  const applied = [];
  const skipped = [];

  for (const mutation of incident?.mutations || []) {
    const relFile = normalizeRelativePath(mutation.file);
    if (!relFile || relFile.includes("..")) {
      throw new Error(`Unsafe mutation path: ${mutation.file}`);
    }

    const fullPath = path.resolve(workspace, relFile);
    if (!isInsidePath(workspace, fullPath)) {
      throw new Error(`Mutation outside workspace: ${mutation.file}`);
    }

    let content;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if (mutation.optional) {
        skipped.push({ file: relFile, reason: "missing" });
        continue;
      }
      throw error;
    }

    const replacements = Array.isArray(mutation.replace?.[0])
      ? mutation.replace
      : [mutation.replace];

    let nextContent = content;
    for (const pair of replacements) {
      const [from, to] = pair || [];
      if (typeof from !== "string" || typeof to !== "string") continue;
      nextContent = nextContent.replace(from, to);
    }

    if (nextContent === content) {
      skipped.push({ file: relFile, reason: "no_match" });
      continue;
    }

    await fs.writeFile(fullPath, nextContent, "utf8");
    applied.push(relFile);
  }

  return { applied, skipped };
}

function normalizeRelativePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function isInsidePath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

export const _test = { isInsidePath, normalizeRelativePath };

export default { applyIncidentMutations };
