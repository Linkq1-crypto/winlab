#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["ci-runner","artifact-registry","deploy-secrets"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["ci-runner","artifact-registry","deploy-secrets"],"source":"verify"}'
  signal '{"type":"service_health","services":["ci-runner","artifact-registry","deploy-secrets"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["ci-runner","artifact-registry","deploy-secrets"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["ci-runner","artifact-registry","deploy-secrets"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Ci Runner, Artifact Registry, Deploy Secrets.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["ci-runner","artifact-registry","deploy-secrets"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Ci Runner, Artifact Registry, Deploy Secrets.","source":"verify"}'
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

LAB_ROOT="/opt/winlab/cicd-broken-pipeline"
ENV_FILE="${LAB_ROOT}/pipeline.env"

grep -Eq "^CI_SECRET=.+$" "${ENV_FILE}" || exit 1
grep -q "^DEPLOY_ENV=production$" "${ENV_FILE}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/pipeline.state")" == "passed" ]] || exit 1
