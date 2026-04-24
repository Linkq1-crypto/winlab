#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/stripe-webhook-forgery/webhook.js"
grep -q 'STRIPE_SIGNATURE_VERIFIED=true' "${FILE}" || exit 1
grep -q 'constructEvent' "${FILE}" || exit 1
if grep -q 'JSON.parse(req.body)' "${FILE}"; then
  exit 1
fi
