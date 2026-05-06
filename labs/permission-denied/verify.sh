#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["filesystem-policy","application-user"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["filesystem-policy","application-user"],"source":"verify"}'
  signal '{"type":"service_health","services":["filesystem-policy","application-user"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["filesystem-policy","application-user"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["filesystem-policy","application-user"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Filesystem Policy, Application User.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["filesystem-policy","application-user"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Filesystem Policy, Application User.","source":"verify"}'
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

TARGET="/opt/winlab/permission-denied/data/.verify"

if su -s /bin/bash -c "touch '${TARGET}'" winlabapp >/dev/null 2>&1; then
  rm -f "${TARGET}"
  echo "permission-denied resolved"
  exit 0
fi

echo "permission-denied still active"
exit 1
