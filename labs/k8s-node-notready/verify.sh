#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["kubelet","kube-apiserver","worker-node"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["kubelet","kube-apiserver","worker-node"],"source":"verify"}'
  signal '{"type":"service_health","services":["kubelet","kube-apiserver","worker-node"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["kubelet","kube-apiserver","worker-node"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["kubelet","kube-apiserver","worker-node"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Kubelet, Kube Apiserver, Worker Node.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["kubelet","kube-apiserver","worker-node"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Kubelet, Kube Apiserver, Worker Node.","source":"verify"}'
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

FILE="/opt/winlab/k8s-node-notready/node.status"
grep -q '^Ready=True$' "${FILE}" || exit 1
grep -q '^Kubelet=running$' "${FILE}" || exit 1
