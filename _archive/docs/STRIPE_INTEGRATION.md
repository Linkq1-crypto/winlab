# Stripe Integration Guide

This document covers the complete Stripe integration for WinLab SaaS, supporting both subscription and pay-per-incident payment models.

## Overview

The integration supports:
- **Subscription Plans**: Pro ($19/mo or ₹199/mo) and Business ($99/mo or ₹999/mo)
- **Pay-Per-Incident**: One-time lab access ($19 or ₹20 per scenario)
- **Multi-Currency**: USD for Western markets, INR for India
- **7-Day Free Trial**: All subscriptions include a trial period
- **Full Lifecycle Management**: Create, update, pause, resume, cancel subscriptions
- **Comprehensive Webhook Handling**: 10+ Stripe events handled automatically

## Setup

### 1. Stripe Dashboard Configuration

1. **Create Products & Prices** in Stripe Dashboard:
   - Product: "Pro Plan"
     - Price: $19/month USD → Save Price ID
     - Price: ₹199/month INR → Save Price ID
   - Product: "Business Plan"
     - Price: $99/month USD → Save Price ID
     - Price: ₹999/month INR → Save Price ID

2. **Get API Keys**:
   - Go to Developers → API keys
   - Copy Secret Key (sk_test_...)
   - Enable test mode for development

3. **Configure Webhooks**:
   - Go to Developers → Webhooks
   - Add endpoint: `https://yourdomain.com/api/billing/webhook`
   - Select events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.paused`
     - `customer.subscription.resumed`
     - `customer.subscription.trial_will_end`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
   - Copy Webhook Signing Secret (whsec_...)

### 2. Environment Variables

Update `.env` with your Stripe credentials:

```bash
# Stripe API Key
STRIPE_SECRET_KEY=sk_test_your-key-here

# Webhook Secret (from webhook endpoint configuration)
STRIPE_WEBHOOK_SECRET=whsec_your-secret-here

# Price IDs from Stripe Dashboard
STRIPE_PRICE_PRO=price_xxx           # Pro plan USD
STRIPE_PRICE_PRO_INR=price_xxx       # Pro plan INR
STRIPE_PRICE_BUSINESS=price_xxx      # Business plan USD
STRIPE_PRICE_BUSINESS_INR=price_xxx  # Business plan INR
```

### 3. Local Development with Stripe CLI

For testing webhooks locally:

1. Install Stripe CLI: `stripe listen --forward-to localhost:3000/api/billing/webhook`
2. Copy the webhook signing secret from CLI output to `.env`
3. Trigger test events: `stripe trigger payment_intent.succeeded`

## Database Schema

### User Model (Stripe Fields)
- `stripeCustomerId` - Stripe customer ID
- `stripeSubscriptionId` - Active subscription ID
- `subscriptionStatus` - none | active | past_due | canceled | paused | trial
- `subscriptionPlan` - pro | business
- `subscriptionPeriodEnd` - Current billing period end
- `trialEndsAt` - Trial expiration date
- `cancelAtPeriodEnd` - Whether subscription will cancel at period end

### Subscription Model
Tracks complete subscription history with:
- Stripe IDs, plan, status, currency, amount
- Billing periods, trial dates, cancellation info

### Payment Model
Tracks all payment transactions:
- Subscription payments, one-time purchases, refunds
- Receipt URLs, invoice URLs, failure messages

## API Endpoints

### Subscription Management

#### `POST /api/stripe/subscribe`
Create checkout session for subscription
```json
{
  "plan": "pro",           // "pro" or "business"
  "currency": "usd"        // "usd" or "inr"
}
```
Returns: `{ "url": "https://checkout.stripe.com/..." }`

#### `POST /api/stripe/portal`
Create billing portal session (manage payment methods, view invoices)
Returns: `{ "url": "https://billing.stripe.com/..." }`

#### `POST /api/stripe/cancel`
Cancel subscription at end of billing period
Returns: `{ "success": true, "cancelAt": "2026-05-11T...", "message": "..." }`

#### `POST /api/stripe/resume`
Resume a canceled subscription (before period ends)
Returns: `{ "success": true, "message": "Subscription resumed successfully" }`

#### `POST /api/stripe/pause`
Pause subscription temporarily
```json
{
  "behavior": "pause_collection"  // "pause_collection" or "keep_as_draft"
}
```
Returns: `{ "success": true, "message": "Subscription paused" }`

#### `POST /api/stripe/update-subscription`
Upgrade or downgrade plan
```json
{
  "newPlan": "business",    // "pro" or "business"
  "currency": "usd"
}
```
Returns: `{ "success": true, "plan": "business" }`

#### `GET /api/stripe/subscription`
Get current subscription status
Returns: `{ "hasSubscription": true, "status": "active", "plan": "pro", ... }`

### Pay-Per-Incident

#### `POST /api/stripe/pay-per-incident`
Create checkout session for single lab access
```json
{
  "currency": "inr",    // "usd" or "inr"
  "labId": "nginx-fail" // Optional lab ID
}
```
Returns: `{ "url": "https://checkout.stripe.com/..." }`

### Payment History

#### `GET /api/stripe/payments`
Get payment history (last 50 transactions)
Returns: `{ "payments": [...] }`

#### `GET /api/stripe/invoices`
Get invoice history from Stripe
Returns: `{ "invoices": [...] }`

### Pricing

#### `GET /api/stripe/pricing`
Get current pricing information
Returns pricing structure for all plans and currencies

## Webhook Events

The integration handles these Stripe events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Updates user plan, creates payment record |
| `invoice.payment_succeeded` | Updates subscription status, creates payment record |
| `invoice.payment_failed` | Sets user status to "past_due", logs failure |
| `customer.subscription.updated` | Syncs subscription status |
| `customer.subscription.deleted` | Reverts user to "starter" plan |
| `customer.subscription.paused` | Sets user status to "paused" |
| `customer.subscription.resumed` | Sets user status to "active" |
| `customer.subscription.trial_will_end` | Logs analytics event |
| `payment_intent.succeeded` | Creates payment record |
| `payment_intent.payment_failed` | Creates failed payment record |
| `charge.refunded` | Marks payment as refunded |

## Frontend Integration Examples

### Create Subscription Checkout

```javascript
const handleSubscribe = async (plan, currency) => {
  const response = await fetch('/api/stripe/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, currency }),
  });
  
  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe Checkout
};
```

### Create Pay-Per-Incident Checkout

```javascript
const handleBuyLab = async (labId, currency) => {
  const response = await fetch('/api/stripe/pay-per-incident', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labId, currency }),
  });
  
  const { url } = await response.json();
  window.location.href = url;
};
```

### Open Billing Portal

```javascript
const handleManageBilling = async () => {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
  });
  
  const { url } = await response.json();
  window.location.href = url; // Stripe Billing Portal
};
```

### Check Subscription Status

```javascript
const checkSubscription = async () => {
  const response = await fetch('/api/stripe/subscription');
  const data = await response.json();
  
  if (data.hasSubscription) {
    console.log(`Plan: ${data.plan}, Status: ${data.status}`);
  } else {
    console.log('No active subscription');
  }
};
```

## Pricing Structure

### Subscriptions

| Plan | USD | INR |
|------|-----|-----|
| Pro | $19/mo | ₹199/mo |
| Business | $99/mo | ₹999/mo |

### Pay-Per-Incident

| Currency | Price |
|----------|-------|
| USD | $19/lab |
| INR | ₹20/lab |

## Testing

### Test Cards

Stripe provides test cards for different scenarios:

| Card Number | Use Case |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 9995 | Declined payment |
| 4000 0025 0000 3155 | Requires 3D Secure |
| 4000 0000 0000 0002 | Always fails |

### Test Webhooks Locally

```bash
# Start Stripe CLI webhook forwarding
stripe listen --forward-to http://localhost:3000/api/billing/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_failed
```

## Security

- All endpoints use rate limiting (3 requests/minute)
- JWT authentication required for all user-specific operations
- Webhook signature verification prevents forged events
- Customer IDs validated against authenticated user
- Sensitive data logged with appropriate detail levels

## Troubleshooting

### Webhook Signature Verification Fails
- Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint configuration
- For local development, use Stripe CLI's webhook secret, not dashboard webhook
- Raw body must be used (not JSON-parsed body) for webhook verification

### Price Not Found Errors
- Verify price IDs in `.env` match Stripe Dashboard
- Price IDs start with `price_`
- Ensure currency-specific prices are configured

### Subscription Not Updating
- Check webhook is properly configured in Stripe Dashboard
- Verify webhook is receiving events (check Stripe Dashboard logs)
- Ensure user has `stripeCustomerId` set

## Migration from Old System

If upgrading from previous version without Stripe fields:

1. Run `npx prisma db push` to sync schema
2. Existing users will have `stripeCustomerId: null`
3. Customer ID created on first checkout interaction
4. Old `plan` field maintained for backward compatibility

## Support

For Stripe-specific questions:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe CLI Documentation](https://stripe.com/docs/cli)
