#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["release-controller","app-blue","app-green"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["release-controller","app-blue","app-green"],"source":"verify"}'
  signal '{"type":"service_health","services":["release-controller","app-blue","app-green"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["release-controller","app-blue","app-green"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["release-controller","app-blue","app-green"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Release Controller, App Blue, App Green.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["release-controller","app-blue","app-green"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Release Controller, App Blue, App Green.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/blue-green-deploy"

[[ "$(tr -d '\r\n' < "${LAB_ROOT}/green.health")" == "healthy" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/live_slot")" == "green" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/deploy.state")" == "switched" ]] || exit 1
