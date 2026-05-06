#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["jvm-app","memory-runtime"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["jvm-app","memory-runtime"],"source":"verify"}'
  signal '{"type":"service_health","services":["jvm-app","memory-runtime"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["jvm-app","memory-runtime"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["jvm-app","memory-runtime"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Jvm App, Memory Runtime.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["jvm-app","memory-runtime"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Jvm App, Memory Runtime.","source":"verify"}'
  fi
}

emit_winlab_on_exit() {
  local status="$?"
  trap - EXIT
  emit_winlab_verify_exit "${status}"
  exit "${status}"
}

emit_winlab_initial_signals
trap emit_winlab_on_exit EXIT

LAB_ROOT="/opt/winlab/memory-leak-diagnosis"
PID_FILE="${LAB_ROOT}/leak.pid"

[[ -f "${LAB_ROOT}/incident.report" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/incident.report")" == "root_cause=memory_leak" ]] || exit 1

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}")"
  if kill -0 "${PID}" >/dev/null 2>&1; then
    exit 1
  fi
fi
