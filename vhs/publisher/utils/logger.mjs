import { writeFileSync, appendFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const LOG_DIR = resolve(import.meta.dirname ?? ".", "../logs");
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function ts() {
  return new Date().toISOString();
}

function write(level, msg, meta = {}) {
  const line = JSON.stringify({ ts: ts(), level, msg, ...meta });
  const file = `${LOG_DIR}/publisher-${new Date().toISOString().slice(0, 10)}.log`;
  try { appendFileSync(file, line + "\n"); } catch {}

  const colors = { info: "\x1b[36m", ok: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
  const c = colors[level] || "";
  console.log(`${c}[${level.toUpperCase()}]\x1b[0m ${ts().slice(11, 19)} ${msg}`, Object.keys(meta).length ? meta : "");
}

export const log = {
  info:  (msg, meta) => write("info",  msg, meta),
  ok:    (msg, meta) => write("ok",    msg, meta),
  warn:  (msg, meta) => write("warn",  msg, meta),
  error: (msg, meta) => write("error", msg, meta),
};
