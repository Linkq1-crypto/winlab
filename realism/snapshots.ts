// realism/snapshots.ts — State snapshots and diff utilities

import fs from "fs";
import path from "path";

/**
 * Create a snapshot of the environment state.
 */
export function snapshot(env: any): string {
  return JSON.stringify(
    {
      services: env.services,
      storage: env.storage,
      network: env.network,
    },
    null,
    2
  );
}

/**
 * Compare two snapshots and return the diff.
 */
export function diffSnapshots(before: string, after: string): Record<string, any> {
  const beforeObj = JSON.parse(before);
  const afterObj = JSON.parse(after);

  const diff: Record<string, any> = {};

  // Compare services
  diff.services = {};
  for (const [name, beforeSvc] of Object.entries(beforeObj.services || {})) {
    const afterSvc = afterObj.services?.[name];
    if (afterSvc && JSON.stringify(beforeSvc) !== JSON.stringify(afterSvc)) {
      diff.services[name] = {
        before: beforeSvc,
        after: afterSvc,
      };
    }
  }

  // Compare storage
  if (JSON.stringify(beforeObj.storage) !== JSON.stringify(afterObj.storage)) {
    diff.storage = {
      before: beforeObj.storage,
      after: afterObj.storage,
    };
  }

  // Compare network
  if (JSON.stringify(beforeObj.network) !== JSON.stringify(afterObj.network)) {
    diff.network = {
      before: beforeObj.network,
      after: afterObj.network,
    };
  }

  return diff;
}

/**
 * Load a baseline output from fixtures.
 */
export function loadBaseline(name: string): string {
  const baselinePath = path.join(__dirname, "fixtures", "baselines", name);

  try {
    return fs.readFileSync(baselinePath, "utf-8");
  } catch (e) {
    throw new Error(`Baseline not found: ${baselinePath}`);
  }
}

/**
 * Save a baseline output to fixtures.
 */
export function saveBaseline(name: string, content: string): void {
  const baselineDir = path.join(__dirname, "fixtures", "baselines");

  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  fs.writeFileSync(path.join(baselineDir, name), content, "utf-8");
}

/**
 * Normalize output for comparison (remove non-deterministic fields).
 */
export function normalize(s: string): string {
  return s
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/g, "<ts>")
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, "<ts>")
    .replace(/pid=\d+/g, "pid=<pid>")
    .replace(/PID \d+/g, "PID <pid>")
    .replace(/\b\d{4,}\b/g, "<num>")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare normalized outputs for equality.
 */
export function compareOutputs(simulated: string, real: string): boolean {
  return normalize(simulated) === normalize(real);
}

/**
 * Generate a diff report between simulated and real outputs.
 */
export function diffReport(simulated: string, real: string): string {
  const simLines = simulated.split("\n");
  const realLines = real.split("\n");

  const report: string[] = [];

  // Compare line by line
  const maxLines = Math.max(simLines.length, realLines.length);

  for (let i = 0; i < maxLines; i++) {
    const simLine = simLines[i] || "";
    const realLine = realLines[i] || "";

    if (normalize(simLine) !== normalize(realLine)) {
      report.push(`Line ${i + 1}:`);
      report.push(`  Expected: ${realLine}`);
      report.push(`  Got:      ${simLine}`);
    }
  }

  return report.join("\n") || "Outputs match!";
}
