#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["sssd","ldap-directory","pam-auth"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["sssd","ldap-directory","pam-auth"],"source":"verify"}'
  signal '{"type":"service_health","services":["sssd","ldap-directory","pam-auth"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["sssd","ldap-directory","pam-auth"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["sssd","ldap-directory","pam-auth"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Sssd, Ldap Directory, Pam Auth.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["sssd","ldap-directory","pam-auth"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Sssd, Ldap Directory, Pam Auth.","source":"verify"}'
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

grep -q "^ldap_uri = ldap://directory.winlab.local$" /etc/sssd/sssd.conf || exit 1
grep -q "^cache_credentials = true$" /etc/sssd/sssd.conf || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/sssd-ldap/directory.state)" == "online" ]] || exit 1
