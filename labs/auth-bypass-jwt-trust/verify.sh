#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/auth-bypass-jwt-trust/auth.js"
grep -q 'JWT_SIGNATURE_REQUIRED=true' "${FILE}" || exit 1
if grep -q 'return payload.role || "guest"' "${FILE}"; then
  exit 1
fi
grep -Eq 'if \(!verifySignature\)' "${FILE}" || exit 1
grep -q 'return "guest"' "${FILE}" || exit 1
