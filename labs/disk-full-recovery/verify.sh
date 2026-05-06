#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["root-filesystem"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["root-filesystem"],"source":"verify"}'
  signal '{"type":"service_health","services":["root-filesystem"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["root-filesystem"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["root-filesystem"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Root Filesystem.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["root-filesystem"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Root Filesystem.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/disk-full-recovery"
TOTAL_MB="$(du -sm "${LAB_ROOT}" | awk '{print $1}')"

[[ "${TOTAL_MB}" -le 8 ]] || exit 1
[[ -f "${LAB_ROOT}/recovery.report" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/recovery.report")" == "cleared=true" ]] || exit 1
