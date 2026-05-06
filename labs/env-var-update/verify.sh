#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["app-service","config-runtime"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["app-service","config-runtime"],"source":"verify"}'
  signal '{"type":"service_health","services":["app-service","config-runtime"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["app-service","config-runtime"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["app-service","config-runtime"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for App Service, Config Runtime.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["app-service","config-runtime"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for App Service, Config Runtime.","source":"verify"}'
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

ENV_FILE="/opt/winlab/env-var-update/app.env"

grep -q "^APP_MODE=production$" "${ENV_FILE}" || exit 1
grep -q "^FEATURE_LOGIN=enabled$" "${ENV_FILE}" || exit 1
