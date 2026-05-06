#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["apache","root-filesystem","audit-policy"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["apache","root-filesystem","audit-policy"],"source":"verify"}'
  signal '{"type":"service_health","services":["apache","root-filesystem","audit-policy"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["apache","root-filesystem","audit-policy"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["apache","root-filesystem","audit-policy"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Apache, Root Filesystem, Audit Policy.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["apache","root-filesystem","audit-policy"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Apache, Root Filesystem, Audit Policy.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/enhanced-terminal"

[[ ! -f "${LAB_ROOT}/tmp/cache.fill" ]] || exit 1
[[ -w "${LAB_ROOT}/app" ]] || exit 1
[[ -f "${LAB_ROOT}/app/.mentor" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/app/.mentor")" == "status=ready" ]] || exit 1
