#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["kubelet","workload-pod"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["kubelet","workload-pod"],"source":"verify"}'
  signal '{"type":"service_health","services":["kubelet","workload-pod"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["kubelet","workload-pod"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["kubelet","workload-pod"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Kubelet, Workload Pod.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["kubelet","workload-pod"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Kubelet, Workload Pod.","source":"verify"}'
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

FILE="/opt/winlab/k8s-crashloop/deployment.yaml"
grep -q '^livenessProbe: healthy$' "${FILE}" || exit 1
grep -q '^imageTag: stable$' "${FILE}" || exit 1
grep -q '^podStatus: Running$' "${FILE}" || exit 1
