#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["app-api","postgresql"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["app-api","postgresql"],"source":"verify"}'
  signal '{"type":"service_health","services":["app-api","postgresql"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["app-api","postgresql"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["app-api","postgresql"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for App Api, Postgresql.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["app-api","postgresql"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for App Api, Postgresql.","source":"verify"}'
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

ENV_FILE="/opt/winlab/db-connection-failure/app.env"

grep -q "^DB_HOST=127.0.0.1$" "${ENV_FILE}" || exit 1
grep -q "^DB_PORT=5432$" "${ENV_FILE}" || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/db-connection-failure/connection.state)" == "connected" ]] || exit 1
