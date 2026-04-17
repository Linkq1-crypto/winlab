# 💳 WINLAB PAYMENT SYSTEMS - COMPLETE IMPLEMENTATION GUIDE

## ✅ IMPLEMENTED PAYMENT METHODS

### 1. ✅ Stripe - Global Payments (USD/EUR)
**Status**: FULLY IMPLEMENTED  
**Supports**: Subscription plans, One-time payments

#### Subscription Plans:
- **Pro**: $19/month (or ₹199/month for India)
- **Business**: $99/month (or ₹4,999/month for India)
- **7-day free trial** included

#### One-Time Payments:
- **Early Access**: $5 (locked price, one-time)
- **Lifetime**: $149 (one-time, NO auto-renewal)
- **Pay-per-Incident**: $19 per lab (or ₹20 for India)

#### Configuration:
```env
# .env file
STRIPE_SECRET_KEY=sk_test_YOUR_KEY  # Replace with sk_live_ for production
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
STRIPE_PRICE_PRO=price_pro_usd
STRIPE_PRICE_PRO_INR=price_pro_inr
STRIPE_PRICE_BUSINESS=price_business_usd
STRIPE_PRICE_BUSINESS_INR=price_business_inr
STRIPE_PRICE_EARLY_ACCESS=price_early_access_5usd  # CREATE IN STRIPE DASHBOARD
STRIPE_PRICE_LIFETIME=price_lifetime_149usd  # CREATE IN STRIPE DASHBOARD
```

#### API Endpoints:
```
POST /api/stripe/subscribe           - Subscription checkout (Pro/Business)
POST /api/stripe/pay-per-incident    - Pay-per-lab ($19)
POST /api/stripe/early-access        - Early access ($5, no auth required)
POST /api/stripe/lifetime            - Lifetime access ($149, requires auth)
POST /api/stripe/portal              - Billing portal (manage subscription)
POST /api/stripe/cancel              - Cancel subscription
POST /api/stripe/resume              - Resume canceled subscription
POST /api/billing/webhook            - Stripe webhook (idempotent ✅)
```

#### Webhook Idempotency:
✅ **IMPLEMENTED** - Prevents duplicate event processing
- Tracks processed event IDs in `ProcessedWebhookEvent` table
- Only marks as processed AFTER successful handling
- Allows retry on handler failure
- Automatic cleanup after 30 days

**Testing webhook idempotency:**
```bash
# Send same event twice - should only process once
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "stripe-signature: t=123,v1=abc" \
  -d '{"id":"evt_123","type":"checkout.session.completed"}'

# Second delivery returns 200 immediately (idempotent)
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "stripe-signature: t=123,v1=abc" \
  -d '{"id":"evt_123","type":"checkout.session.completed"}'
```

---

### 2. ✅ Razorpay - India Payments (INR)
**Status**: FULLY IMPLEMENTED  
**Supports**: Subscription plans, Pay-per-lab

#### Pricing:
- **Pro**: ₹199/month
- **Business**: ₹4,999/month
- **Pay-per-Incident**: ₹20 per lab

#### Configuration:
```env
# .env file
RAZORPAY_KEY_ID=rzp_test_Sd1WjWnmy9yKhm  # ✅ Test key added
RAZORPAY_KEY_SECRET=YOUR_SECRET_HERE  # ⚠️ GET FROM DASHBOARD
```

#### API Endpoints:
```
POST /api/billing/verify-razorpay  - Verify Razorpay payment
```

#### How It Works:
1. Frontend initializes Razorpay SDK with `RAZORPAY_KEY_ID`
2. User completes payment in Razorpay checkout
3. Razorpay calls backend with payment details
4. Backend verifies HMAC-SHA256 signature
5. Updates user plan and records payment
6. Returns success to frontend

**Signature Verification:**
```javascript
const generatedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');

if (generatedSignature !== razorpay_signature) {
  // Reject - invalid signature
}
```

#### Getting Razorpay Secret Key:
1. Go to: https://dashboard.razorpay.com/app/keys
2. Switch to **Live Mode** (complete KYC first)
3. Copy **Key Secret**
4. Update `.env` with live key

**Testing (Test Mode):**
```bash
curl -X POST http://localhost:3000/api/billing/verify-razorpay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "razorpay_payment_id": "pay_test123",
    "razorpay_order_id": "order_test123",
    "razorpay_signature": "test_signature",
    "plan": "pro",
    "amount": 19900
  }'
```

---

### 3. ✅ Paystack - Africa Payments (NGN/GHS/KES/ZAR)
**Status**: FULLY IMPLEMENTED  
**Supports**: One-time payments, Subscriptions  
**Countries**: Nigeria 🇳🇬, Ghana 🇬🇭, Kenya 🇰🇪, South Africa 🇿🇦

#### Supported Currencies:
| Country | Currency | Code | Symbol |
|---------|----------|------|--------|
| Nigeria | Naira | NGN | ₦ |
| Ghana | Cedi | GHS | GH₵ |
| Kenya | Shilling | KES | KSh |
| South Africa | Rand | ZAR | R |

#### Auto-Detection:
- Uses Cloudflare `cf-ipcountry` header
- Automatically selects appropriate currency
- Defaults to NGN (Nigeria) if not detected

#### Configuration:
```env
# .env file
PAYSTACK_SECRET_KEY=sk_test_your_paystack_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_key_here
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
```

#### API Endpoints:
```
POST /api/billing/paystack/initialize  - Initialize payment
POST /api/billing/paystack/webhook     - Payment webhook
```

#### How It Works:
1. User from Africa selects plan
2. Backend detects country from `cf-ipcountry` header
3. Initializes Paystack payment with local currency
4. User completes payment via Paystack checkout
5. Paystack webhook confirms payment
6. Backend updates user plan and records payment

**Initialize Payment:**
```bash
curl -X POST http://localhost:3000/api/billing/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "pro",
    "amount": 199  # Will be converted to local currency
  }'
```

**Response:**
```json
{
  "authorizationUrl": "https://checkout.paystack.com/...",
  "accessCode": "abc123",
  "reference": "ref_xyz789",
  "currency": "NGN"
}
```

#### Getting Paystack Keys:
1. Sign up: https://dashboard.paystack.com
2. Go to: Settings → API Keys & Webhooks
3. Copy **Secret Key** and **Public Key**
4. Create webhook endpoint with signing secret
5. Update `.env` with keys

**For Production (Live Mode):**
- Complete Paystack KYC verification
- Switch to Live Mode in dashboard
- Replace test keys with live keys
- Configure live webhook URL: `https://winlab.cloud/api/billing/paystack/webhook`

---

## 🔧 PAYMENT FLOW DIAGRAMS

### Global User (USA/Europe):
```
User visits winlab.cloud
  ↓
Geo-detection → Not India/Africa
  ↓
Stripe checkout (USD/EUR)
  ↓
  ├─ Subscription ($19/$99 per month)
  ├─ Early Access ($5 one-time)
  ├─ Lifetime ($149 one-time)
  └─ Pay-per-lab ($19 per scenario)
  ↓
Stripe webhook (idempotent)
  ↓
User plan updated in database
```

### Indian User:
```
User visits winlab.cloud
  ↓
Geo-detection → India (timezone/language)
  ↓
Razorpay checkout (INR)
  ↓
  ├─ Pro Plan (₹199/month)
  ├─ Business Plan (₹4,999/month)
  └─ Pay-per-lab (₹20 per scenario)
  ↓
Backend verifies signature
  ↓
User plan updated in database
```

### African User (Nigeria/Ghana/Kenya/South Africa):
```
User visits winlab.cloud
  ↓
Geo-detection → African country (cf-ipcountry header)
  ↓
Paystack checkout (Local currency)
  ↓
  ├─ Pro Plan (local currency equivalent)
  └─ Pay-per-lab (local currency equivalent)
  ↓
Paystack webhook confirms payment
  ↓
User plan updated in database
```

---

## 🎯 LIFETIME $149 - ONE-TIME PAYMENT (NO AUTO-RENEWAL)

### Critical Configuration:

**Stripe Dashboard Setup:**
1. Create new product: "WinLab Lifetime Access"
2. Set pricing: **One-time** payment of $149
3. **DO NOT** enable subscriptions for this product
4. Create price ID (will look like: `price_xxxxxxxx`)
5. Add to `.env`: `STRIPE_PRICE_LIFETIME=price_xxxxxxxx`

**Backend Implementation:**
```javascript
// Uses mode: 'payment' (NOT 'subscription')
const session = await stripe.checkout.sessions.create({
  mode: 'payment',  // ✅ One-time payment
  // NOT mode: 'subscription'
  line_items: [{
    price_data: {
      unit_amount: 14900,  // $149 in cents
      currency: 'usd',
    },
    quantity: 1,
  }],
});
```

**Verification:**
- ✅ No `subscription_data` in checkout session
- ✅ Mode is `payment`, not `subscription`
- ✅ No recurring billing metadata
- ✅ Webhook handler does NOT create subscription record

---

## 🚨 PRE-LAUNCH CHECKLIST

### Stripe:
- [ ] Create **$5 Early Access** product in Stripe Dashboard (one-time payment)
- [ ] Create **$149 Lifetime** product in Stripe Dashboard (one-time payment)
- [ ] Update `.env` with actual price IDs
- [ ] Replace `sk_test_` with `sk_live_` keys
- [ ] Configure production webhook: `https://winlab.cloud/api/billing/webhook`
- [ ] Test webhook idempotency with duplicate events
- [ ] Verify 7-day trial is working for subscriptions

### Razorpay (India):
- [ ] Complete KYC verification
- [ ] Switch to **Live Mode** in dashboard
- [ ] Get live **Key ID** and **Key Secret**
- [ ] Update `.env` with live keys
- [ ] Configure webhook URL (if available)
- [ ] Test end-to-end payment flow

### Paystack (Africa):
- [ ] Create Paystack account and complete verification
- [ ] Get **Secret Key** and **Public Key**
- [ ] Create webhook endpoint and get signing secret
- [ ] Update `.env` with all keys
- [ ] Test payment from each supported country
- [ ] Verify currency auto-detection works

### Database:
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify `EarlyAccessSignup` table created
- [ ] Verify `ProcessedWebhookEvent` table created
- [ ] Test early access signup flow
- [ ] Test webhook idempotency tracking

### Frontend:
- [ ] Add $5 Early Access button to pricing page
- [ ] Add $149 Lifetime button to pricing page
- [ ] Replace Razorpay test key with live key in `index.html`
- [ ] Add Paystack checkout for African users
- [ ] Test geo-detection routes payments correctly

---

## 🧪 TESTING COMMANDS

### Test All Payment Endpoints:
```bash
# Run automated tests
node scripts/test-launch-checklist.js
```

### Manual Testing:
```bash
# 1. Test Early Access ($5)
curl -X POST http://localhost:3000/api/stripe/early-access \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# 2. Test Lifetime ($149)
curl -X POST http://localhost:3000/api/stripe/lifetime \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. Test Razorpay Verification
curl -X POST http://localhost:3000/api/billing/verify-razorpay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "razorpay_payment_id": "pay_test123",
    "razorpay_order_id": "order_test123",
    "razorpay_signature": "test_signature",
    "plan": "pro"
  }'

# 4. Test Paystack Initialization
curl -X POST http://localhost:3000/api/billing/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "plan": "pro",
    "amount": 199
  }'
```

---

## 📊 PAYMENT ROUTING LOGIC

```javascript
// Region detection → Payment gateway
function getPaymentGateway(req) {
  const country = req.headers['cf-ipcountry']?.toUpperCase();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // India → Razorpay
  if (timezone.includes('Kolkata') || country === 'IN') {
    return 'razorpay';
  }
  
  // Africa → Paystack
  if (['NG', 'GH', 'KE', 'ZA'].includes(country)) {
    return 'paystack';
  }
  
  // Rest of world → Stripe
  return 'stripe';
}
```

---

## 🔐 SECURITY FEATURES

### All Payment Gateways:
✅ **Signature Verification** - HMAC-SHA256/SHA512  
✅ **Rate Limiting** - 3 requests/min on billing endpoints  
✅ **Idempotency** - Prevents duplicate charges  
✅ **Security Logging** - All failures logged  
✅ **Input Validation** - Email, amount, plan validation  
✅ **HTTPS Required** - All endpoints require SSL  

### Webhook Security:
✅ **Signature Verification** - Verify source authenticity  
✅ **Idempotency Checks** - Prevent duplicate processing  
✅ **Error Handling** - Failed events can be retried  
✅ **Event Tracking** - All events logged to database  

---

## 💡 IMPORTANT NOTES

### Stripe:
- **One-time payments** use `mode: 'payment'` (NOT subscription)
- **Subscriptions** use `mode: 'subscription'` with auto-renewal
- **Early Access** and **Lifetime** are ONE-TIME (no renewals)
- Webhook idempotency prevents double-charging on retries

### Razorpay:
- Test mode uses `rzp_test_` prefix
- Live mode uses `rzp_live_` prefix
- Amount in paisa (₹1 = 100 paisa)
- Signature verification is MANDATORY

### Paystack:
- Test mode uses `sk_test_` prefix
- Live mode uses `sk_live_` prefix
- Amount in kobo/cents (₦1 = 100 kobo)
- Supports 4 African countries
- Auto-detects currency from Cloudflare header

---

**Last Updated**: April 13, 2026  
**Payment Gateways**: 3/3 Implemented ✅  
**Ready for**: Production launch (pending live keys)
