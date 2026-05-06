#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["shell-runtime","root-filesystem"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["shell-runtime","root-filesystem"],"source":"verify"}'
  signal '{"type":"service_health","services":["shell-runtime","root-filesystem"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["shell-runtime","root-filesystem"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["shell-runtime","root-filesystem"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Shell Runtime, Root Filesystem.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["shell-runtime","root-filesystem"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Shell Runtime, Root Filesystem.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/linux-terminal"

# incident.log must have been moved to archive/
[[ -f "${LAB_ROOT}/archive/incident.log" ]] || exit 1
[[ ! -f "${LAB_ROOT}/incoming/incident.log" ]] || exit 1

# incident.log must be readable by its owner (chmod was applied)
[[ "$(stat -c "%A" "${LAB_ROOT}/archive/incident.log" | cut -c2)" == "r" ]] || exit 1

# recovery flag must exist with the exact required content
[[ -f "${LAB_ROOT}/archive/recovered.flag" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/archive/recovered.flag")" == "linux-terminal-ok" ]] || exit 1
