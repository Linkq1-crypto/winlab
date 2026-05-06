#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/auth-bypass-jwt-trust/auth.js"

signal() {
  echo "WINLAB_SIGNAL $1"
}

signal '{"type":"affected_services_update","services":["auth-service","jwt-verifier"],"source":"verify"}'
signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"degraded","progress":68,"source":"verify"}'
signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'

if ! grep -q 'JWT_SIGNATURE_REQUIRED=true' "${FILE}"; then
  signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"failed","progress":82,"source":"verify"}'
  signal '{"type":"verification_result","status":"failed","summary":"JWT signature enforcement marker missing.","source":"verify"}'
  exit 1
fi
if grep -q 'return payload.role || "guest"' "${FILE}"; then
  signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"failed","progress":82,"source":"verify"}'
  signal '{"type":"verification_result","status":"failed","summary":"Mutable JWT role trust is still present.","source":"verify"}'
  exit 1
fi
if ! grep -Eq 'if \(!verifySignature\)' "${FILE}"; then
  signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"failed","progress":82,"source":"verify"}'
  signal '{"type":"verification_result","status":"failed","summary":"Signature verification guard missing.","source":"verify"}'
  exit 1
fi
if ! grep -q 'return "guest"' "${FILE}"; then
  signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"failed","progress":82,"source":"verify"}'
  signal '{"type":"verification_result","status":"failed","summary":"Guest fallback not enforced after verification failure.","source":"verify"}'
  exit 1
fi

signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"recovering","progress":92,"source":"verify"}'
signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
signal '{"type":"service_health","services":["auth-service","jwt-verifier"],"status":"healthy","progress":100,"source":"verify"}'
signal '{"type":"verification_result","status":"passed","summary":"JWT trust bypass removed and signature verification is enforced.","source":"verify"}'
exit 0
