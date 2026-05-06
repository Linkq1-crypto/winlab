#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["edge-router","dns-resolver"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["edge-router","dns-resolver"],"source":"verify"}'
  signal '{"type":"service_health","services":["edge-router","dns-resolver"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["edge-router","dns-resolver"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["edge-router","dns-resolver"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Edge Router, Dns Resolver.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["edge-router","dns-resolver"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Edge Router, Dns Resolver.","source":"verify"}'
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

FILE="/opt/winlab/network-lab/routing.table"
grep -q '^api.internal via 10.0.0.10$' "${FILE}" || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/network-lab/network.state)" == "healthy" ]] || exit 1
