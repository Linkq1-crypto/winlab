#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["payments-webhook","signature-verifier"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["payments-webhook","signature-verifier"],"source":"verify"}'
  signal '{"type":"service_health","services":["payments-webhook","signature-verifier"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["payments-webhook","signature-verifier"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["payments-webhook","signature-verifier"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Payments Webhook, Signature Verifier.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["payments-webhook","signature-verifier"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Payments Webhook, Signature Verifier.","source":"verify"}'
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

FILE="/opt/winlab/stripe-webhook-forgery/webhook.js"
grep -q 'STRIPE_SIGNATURE_VERIFIED=true' "${FILE}" || exit 1
grep -q 'constructEvent' "${FILE}" || exit 1
if grep -q 'JSON.parse(req.body)' "${FILE}"; then
  exit 1
fi
