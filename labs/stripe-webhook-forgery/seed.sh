#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/stripe-webhook-forgery"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/webhook.js" <<'EOF'
export function handleStripeWebhook(req) {
  const payload = JSON.parse(req.body);
  return processEvent(payload);
}
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Fix Stripe webhook verification:
1. Add raw body signature verification before processing
2. Add marker STRIPE_SIGNATURE_VERIFIED=true
EOF
