#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["cdn-edge","asset-origin"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["cdn-edge","asset-origin"],"source":"verify"}'
  signal '{"type":"service_health","services":["cdn-edge","asset-origin"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["cdn-edge","asset-origin"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["cdn-edge","asset-origin"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Cdn Edge, Asset Origin.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["cdn-edge","asset-origin"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Cdn Edge, Asset Origin.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/ghost-asset-incident"

grep -q '"logo.svg": "present"' "${LAB_ROOT}/manifests/assets.json" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/assets/logo.svg.state")" == "restored" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/cdn.state")" == "warm" ]] || exit 1
