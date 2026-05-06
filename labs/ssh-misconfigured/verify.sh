#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["sshd"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["sshd"],"source":"verify"}'
  signal '{"type":"service_health","services":["sshd"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["sshd"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["sshd"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Sshd.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["sshd"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Sshd.","source":"verify"}'
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

# sshd config must be valid
/usr/sbin/sshd -t || exit 1

# sshd must be running
pgrep -x sshd > /dev/null || exit 1

# sshd must be listening on port 22 (not 2222)
ss -tlnp | grep -q ':22 ' || exit 1

# PasswordAuthentication must be enabled
/usr/sbin/sshd -T 2>/dev/null | grep -q '^passwordauthentication yes' || exit 1
