#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["edge-tls","certificate-manager"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["edge-tls","certificate-manager"],"source":"verify"}'
  signal '{"type":"service_health","services":["edge-tls","certificate-manager"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["edge-tls","certificate-manager"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["edge-tls","certificate-manager"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Edge Tls, Certificate Manager.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["edge-tls","certificate-manager"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Edge Tls, Certificate Manager.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/ssl-certificate-renewal"
CERT_FILE="${LAB_ROOT}/certs/current.pem"

grep -q "^CN=app.winlab.local$" "${CERT_FILE}" || exit 1
grep -Eq "^not_after=202[6-9]-" "${CERT_FILE}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/cert.state")" == "renewed" ]] || exit 1
