// realism/snapshots.node.ts - Node-only baseline file utilities

import fs from "fs";
import path from "path";

export function loadBaseline(name: string): string {
  const baselinePath = path.join(__dirname, "fixtures", "baselines", name);

  try {
    return fs.readFileSync(baselinePath, "utf-8");
  } catch {
    throw new Error(`Baseline not found: ${baselinePath}`);
  }
}

export function saveBaseline(name: string, content: string): void {
  const baselineDir = path.join(__dirname, "fixtures", "baselines");

  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  fs.writeFileSync(path.join(baselineDir, name), content, "utf-8");
}
