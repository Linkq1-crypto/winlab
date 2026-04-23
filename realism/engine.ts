// realism/engine.ts - Core execution engine

import { parse, type CommandAST } from "./parsers";
import { applyEffects, type ExecutionResult } from "./effects";
import { genLogs } from "./logs";
import { schedule } from "./timing";
import { diffReport, diffSnapshots, normalize, snapshot } from "./snapshots";
import type { Env } from "./state";

export interface ExecutionOutput {
  stdout: string;
  stderr: string;
  code: number;
  diff: Record<string, any>;
  timing: {
    delayMs: number;
    startedAt: number;
    completedAt: number;
  };
}

export async function exec(cmd: string, env: Env): Promise<ExecutionOutput> {
  const startedAt = Date.now();
  const ast = parse(cmd);
  const before = snapshot(env);
  const result = await applyEffects(ast, env);

  genLogs(ast, env, result);

  const timingStart = Date.now();
  await schedule(ast, env);
  const timingEnd = Date.now();
  const after = snapshot(env);
  const diff = diffSnapshots(before, after);

  return {
    stdout: result.stdout,
    stderr: result.stderr || "",
    code: result.code ?? 0,
    diff,
    timing: {
      delayMs: timingEnd - timingStart,
      startedAt,
      completedAt: Date.now(),
    },
  };
}

export async function execBatch(commands: string[], env: Env): Promise<ExecutionOutput[]> {
  const results: ExecutionOutput[] = [];

  for (const cmd of commands) {
    const result = await exec(cmd, env);
    results.push(result);
  }

  return results;
}

export async function execAndCompare(
  cmd: string,
  env: Env,
  baselineName: string
): Promise<{ output: ExecutionOutput; matches: boolean; diff: string }> {
  const output = await exec(cmd, env);

  try {
    const { loadBaseline } = await import("./snapshots.node");
    const baseline = loadBaseline(baselineName);
    const matches = normalize(output.stdout) === normalize(baseline);

    return {
      output,
      matches,
      diff: diffReport(output.stdout, baseline),
    };
  } catch {
    return {
      output,
      matches: false,
      diff: `Baseline not found: ${baselineName}`,
    };
  }
}

export { parse } from "./parsers";
export type { CommandAST } from "./parsers";
export type { Env, ServiceState, LogEntry, LogLevel } from "./state";
export { Env, createDefaultEnv } from "./state";
export { DependencyGraph, createDefaultDependencyGraph } from "./deps";
export { Noise, createDefaultNoise, createTestNoise } from "./noise";
export { emitLog, genLogs, queryLogs, formatLog } from "./logs";
export { snapshot, diffSnapshots, normalize } from "./snapshots";
