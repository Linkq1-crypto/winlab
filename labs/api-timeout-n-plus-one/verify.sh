#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["public-api","postgresql","node-runtime"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["public-api","postgresql","node-runtime"],"source":"verify"}'
  signal '{"type":"service_health","services":["public-api","postgresql","node-runtime"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["public-api","postgresql","node-runtime"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["public-api","postgresql","node-runtime"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Public Api, Postgresql, Node Runtime.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["public-api","postgresql","node-runtime"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Public Api, Postgresql, Node Runtime.","source":"verify"}'
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

FILE="/opt/winlab/api-timeout-n-plus-one/ordersService.js"
grep -q 'BATCHED_USER_LOOKUP=true' "${FILE}" || exit 1
grep -q 'findByIds' "${FILE}" || exit 1
if grep -q 'order.user = await db.users.findById' "${FILE}"; then
  exit 1
fi
