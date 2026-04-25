# stripe-webhook-forgery — Solution

## INCIDENT SUMMARY
The Stripe webhook handler processes events without verifying the request signature. An attacker can POST any JSON payload to the endpoint and have it treated as a legitimate Stripe event — including fake `payment_intent.succeeded` events. The code must be rewritten to call `stripe.webhooks.constructEvent()` and marked with `STRIPE_SIGNATURE_VERIFIED=true`.

## ROOT CAUSE
`/opt/winlab/stripe-webhook-forgery/webhook.js` contains:

```js
export function handleStripeWebhook(req) {
  const payload = JSON.parse(req.body);
  return processEvent(payload);
}
```

`JSON.parse(req.body)` parses the raw body without checking the `Stripe-Signature` header against the endpoint secret. Any caller can forge any event type and payload, causing the application to process fraudulent payment confirmations, refunds, or subscription changes.

## FIX

```bash
# Step 1 — inspect the vulnerable code
cat /opt/winlab/stripe-webhook-forgery/webhook.js

# Step 2 — rewrite the handler with signature verification
cat > /opt/winlab/stripe-webhook-forgery/webhook.js <<'EOF'
// STRIPE_SIGNATURE_VERIFIED=true
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export function handleStripeWebhook(req, sig, endpointSecret) {
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  return processEvent(event);
}
EOF
```

## WHY THIS FIX WORKED
`stripe.webhooks.constructEvent()` validates the `Stripe-Signature` HMAC header using the endpoint secret. A forged request without the correct secret produces a signature mismatch and throws — the payload is never processed. The `STRIPE_SIGNATURE_VERIFIED=true` comment is a searchable audit marker confirming the fix is intentional.

## PRODUCTION LESSON
Every webhook receiver must verify the request source before acting on the payload. Stripe signs requests with HMAC-SHA256; the signature is in the `Stripe-Signature` header. Always use the raw request body (not a re-serialized object) for verification — JSON re-serialization can reorder keys and break the signature. Set a short tolerance window (300 seconds is Stripe's default) to prevent replay attacks. Never trust webhook payload fields (amount, currency, customer) without first passing signature verification.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/stripe-webhook-forgery/webhook.js   # inspect the vulnerability
# Fix: use stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret)
# Add: // STRIPE_SIGNATURE_VERIFIED=true
# Remove: JSON.parse(req.body) — never parse without verifying
```

## MENTOR_HINTS
1. Payment webhook may be accepting forged events → read webhook.js to find the missing verification
2. JSON.parse(req.body) processes the payload without checking the Stripe-Signature header → this allows webhook forgery
3. Replace JSON.parse with stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret) → this validates the HMAC signature
4. Fix → rewrite webhook.js to call constructEvent and add // STRIPE_SIGNATURE_VERIFIED=true, removing JSON.parse(req.body)
