#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["mdadm-array","block-volume"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["mdadm-array","block-volume"],"source":"verify"}'
  signal '{"type":"service_health","services":["mdadm-array","block-volume"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["mdadm-array","block-volume"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["mdadm-array","block-volume"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Mdadm Array, Block Volume.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["mdadm-array","block-volume"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Mdadm Array, Block Volume.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/raid-simulator"
DETAIL="${LAB_ROOT}/mdadm.detail"

grep -q "^       State : clean$" "${DETAIL}" || exit 1
grep -q "^     Total Devices : 2$" "${DETAIL}" || exit 1
grep -q "^Failed Devices : 0$" "${DETAIL}" || exit 1
grep -q "active sync   /dev/sdb1" "${DETAIL}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/array.state")" == "rebuilt" ]] || exit 1
