#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["pm2","node-api"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["pm2","node-api"],"source":"verify"}'
  signal '{"type":"service_health","services":["pm2","node-api"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["pm2","node-api"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["pm2","node-api"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Pm2, Node Api.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["pm2","node-api"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Pm2, Node Api.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/pm2-crash-recovery"

[[ -f "${LAB_ROOT}/pm2.status" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/pm2.status")" == "online" ]] || exit 1
ss -ltn 2>/dev/null | grep -q ":4001 " || exit 1
