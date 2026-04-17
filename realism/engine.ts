// realism/engine.ts — Core execution engine

import { parse, type CommandAST } from "./parsers";
import { applyEffects, type ExecutionResult } from "./effects";
import { genLogs } from "./logs";
import { schedule } from "./timing";
import { snapshot, diffSnapshots, normalize } from "./snapshots";
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

/**
 * Execute a command against the environment.
 * 
 * This is the main entry point for the realism engine.
 * It:
 * 1. Parses the command into an AST
 * 2. Takes a before snapshot
 * 3. Applies effects (state mutations)
 * 4. Generates logs
 * 5. Schedules realistic delays
 * 6. Takes an after snapshot
 * 7. Returns output with diff
 */
export async function exec(cmd: string, env: Env): Promise<ExecutionOutput> {
  const startedAt = Date.now();

  // Step 1: Parse command
  const ast = parse(cmd);

  // Step 2: Before snapshot
  const before = snapshot(env);

  // Step 3: Apply effects (state mutations + side-effects)
  const result = await applyEffects(ast, env);

  // Step 4: Generate realistic logs
  genLogs(ast, env, result);

  // Step 5: Schedule realistic timing/delays
  const timingStart = Date.now();
  await schedule(ast, env);
  const timingEnd = Date.now();

  // Step 6: After snapshot
  const after = snapshot(env);

  // Step 7: Calculate diff
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

/**
 * Execute multiple commands in sequence.
 */
export async function execBatch(commands: string[], env: Env): Promise<ExecutionOutput[]> {
  const results: ExecutionOutput[] = [];

  for (const cmd of commands) {
    const result = await exec(cmd, env);
    results.push(result);
  }

  return results;
}

/**
 * Execute a command and compare output against a baseline.
 */
export async function execAndCompare(
  cmd: string,
  env: Env,
  baselineName: string
): Promise<{ output: ExecutionOutput; matches: boolean; diff: string }> {
  const output = await exec(cmd, env);

  try {
    const baseline = require("./snapshots").loadBaseline(baselineName);
    const matches = normalize(output.stdout) === normalize(baseline);

    return {
      output,
      matches,
      diff: require("./snapshots").diffReport(output.stdout, baseline),
    };
  } catch (e) {
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
export { snapshot, diffSnapshots, loadBaseline, saveBaseline, normalize } from "./snapshots";
