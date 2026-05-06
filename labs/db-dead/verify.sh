#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["postgresql","mysql"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["postgresql","mysql"],"source":"verify"}'
  signal '{"type":"service_health","services":["postgresql","mysql"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["postgresql","mysql"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["postgresql","mysql"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Postgresql, Mysql.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["postgresql","mysql"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Postgresql, Mysql.","source":"verify"}'
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

pgrep -f "fake_db.py" >/dev/null 2>&1 || exit 1
ss -ltn 2>/dev/null | grep -q ":5432 " || exit 1
