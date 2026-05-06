#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["app-service","node-runtime"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["app-service","node-runtime"],"source":"verify"}'
  signal '{"type":"service_health","services":["app-service","node-runtime"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["app-service","node-runtime"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["app-service","node-runtime"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for App Service, Node Runtime.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["app-service","node-runtime"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for App Service, Node Runtime.","source":"verify"}'
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

PID_FILE="/opt/winlab/memory-leak/leak.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "memory-leak resolved"
  exit 0
fi

PID="$(cat "${PID_FILE}")"

if kill -0 "${PID}" >/dev/null 2>&1; then
  echo "memory-leak still active; process ${PID} running"
  exit 1
fi

echo "memory-leak resolved"
exit 0
