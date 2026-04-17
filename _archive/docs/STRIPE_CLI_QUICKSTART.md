# Stripe CLI Quickstart — WinLab (Windows)

## 1. Install Stripe CLI

### Option A: winget (Recommended)
```powershell
winget install Stripe.stripe-cli
```

### Option B: Manual Download
1. Download from: https://docs.stripe.com/stripe-cli
2. Extract and add to PATH

### Verify Installation
```powershell
stripe --version
```

## 2. Authenticate CLI
```powershell
stripe login
```
This opens a browser window — click "Authorize" when prompted.

## 3. Run Webhook Forwarding
```powershell
# Make sure your dev server is running on port 3000 first:
# npm run dev

# Then start webhook forwarding:
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

The CLI will output a webhook signing secret that looks like:
```
whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Copy this secret to your `.env` file:
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. Test Webhook Events

While `stripe listen` is running, trigger test events:

```powershell
# Test successful payment
stripe trigger checkout.session.completed

# Test subscription created
stripe trigger customer.subscription.created

# Test payment failed
stripe trigger invoice.payment_failed

# Test subscription canceled
stripe trigger customer.subscription.deleted
```

## 5. Automated Setup

Use the provided PowerShell script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stripe-setup.ps1
```

This script:
- ✅ Checks if Stripe CLI is installed
- ✅ Verifies CLI authentication
- ✅ Detects account mode (test/live)
- ✅ Starts webhook forwarding

## 6. Verify in Dashboard

Go to https://dashboard.stripe.com/test/webhooks to see:
- Webhook delivery status
- Event logs
- Failed delivery retries

## Troubleshooting

### "stripe is not recognized"
- Restart your terminal after installation
- Verify with: `where stripe`

### "Not logged in"
- Run: `stripe login`
- Check: `stripe config --list`

### "Webhook signature verification failed"
- Make sure the webhook secret in `.env` matches the one from `stripe listen`
- For production, use the webhook secret from Stripe Dashboard, not CLI

### "Port 3000 not reachable"
- Verify your dev server is running: `npm run dev`
- Check the port in your `.env`: `APP_URL=http://localhost:3000`
