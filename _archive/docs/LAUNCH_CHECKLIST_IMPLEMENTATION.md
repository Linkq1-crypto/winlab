# 🚀 WINLAB CLOUD LAUNCH CHECKLIST - IMPLEMENTATION COMPLETE

## ✅ COMPLETED IMPLEMENTATIONS

### 1. ✅ 500 Seats Counter with Atomic DB Decrement
**Status**: IMPLEMENTED  
**Files**: 
- `prisma/schema.prisma` - Added `EarlyAccessSignup` model
- `src/services/earlyAccessService.js` - Atomic seat claiming with transactions
- `win_lab_full_backend_frontend_starter.js` - Added `/api/early-access/signup` and `/api/early-access/seats` endpoints

**Features**:
- ✅ Atomic transaction prevents race conditions
- ✅ Real-time seat count from database (not static HTML)
- ✅ Returns 409 when sold out
- ✅ Prevents duplicate email signups
- ✅ Tracks locked price ($5) and access date
- ✅ Activation tracking (after payment)

**API Endpoints**:
```
GET  /api/early-access/seats          - Get remaining seats (public)
POST /api/early-access/signup         - Claim early access seat
```

**Testing**:
```bash
# Get remaining seats
curl http://localhost:3000/api/early-access/seats

# Claim a seat
curl -X POST http://localhost:3000/api/early-access/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
```

---

### 2. ✅ Webhook Idempotency (Stripe & Razorpay)
**Status**: IMPLEMENTED  
**Files**:
- `prisma/schema.prisma` - Added `ProcessedWebhookEvent` model
- `src/services/webhookIdempotency.js` - Idempotency tracking service
- `win_lab_full_backend_frontend_starter.js` - Integrated into webhook handler

**Features**:
- ✅ Prevents duplicate event processing
- ✅ Tracks processed event IDs in database
- ✅ Only marks as processed AFTER successful handling
- ✅ Allows retry on handler failure
- ✅ Cleanup function for old events (30 days)
- ✅ Stats endpoint for monitoring

**How It Works**:
```javascript
// Check if already processed BEFORE handling
const alreadyProcessed = await isEventProcessed(event.id);
if (alreadyProcessed) return res.sendStatus(200);

// Handle event...

// Mark as processed AFTER successful handling
await markEventProcessed(event.id, event.type, metadata);
```

**Testing**:
```bash
# Simulate duplicate webhook delivery
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "stripe-signature: t=123456,v1=abcdef" \
  -d '{"id":"evt_test123","type":"checkout.session.completed"}'

# Second delivery should be idempotent (returns 200 immediately)
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "stripe-signature: t=123456,v1=abcdef" \
  -d '{"id":"evt_test123","type":"checkout.session.completed"}'
```

---

### 3. ✅ Razorpay Backend Endpoint (India)
**Status**: IMPLEMENTED  
**Files**:
- `win_lab_full_backend_frontend_starter.js` - Added `/api/billing/verify-razorpay` endpoint
- `.env` - Added Razorpay key configuration

**Features**:
- ✅ Signature verification (HMAC-SHA256)
- ✅ Updates user plan in database
- ✅ Records payment transaction
- ✅ Analytics tracking
- ✅ Rate limited (3 requests/min)
- ✅ Requires authentication
- ✅ Security logging for mismatches

**Configuration**:
```env
RAZORPAY_KEY_ID=rzp_test_Sd1WjWnmy9yKhm  # Your test key
RAZORPAY_KEY_SECRET=your-razorpay-secret-here  # ADD YOUR SECRET KEY
```

**API Endpoint**:
```
POST /api/billing/verify-razorpay
Headers: Authorization: Bearer <token>
Body: {
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "razorpay_signature": "signature",
  "plan": "pro",
  "amount": 19900
}
```

**Testing**:
```bash
curl -X POST http://localhost:3000/api/billing/verify-razorpay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "razorpay_payment_id": "pay_test123",
    "razorpay_order_id": "order_test123",
    "razorpay_signature": "test_signature",
    "plan": "pro",
    "amount": 19900
  }'
```

---

### 4. ✅ Early Access Email Template
**Status**: IMPLEMENTED  
**Files**:
- `src/services/earlyAccessEmail.js` - Email template and sending logic

**Features**:
- ✅ Beautiful HTML email template
- ✅ Shows locked price ($5) prominently
- ✅ Displays access date
- ✅ Lists what's included
- ✅ Branded with WinLab colors
- ✅ Text fallback version
- ✅ Email tagging for analytics
- ✅ Sold out notification template

**Email Content**:
- 🔒 **Locked Price Box**: $5 (highlighted, 74% savings vs $19)
- 📅 **Access Date**: Formatted date when they get access
- ✅ **What's Included**: 6 key features listed
- 🎯 **CTA**: Link to winlab.cloud
- 📧 **Support**: support@winlab.cloud

**Automatic Trigger**:
- Email sent automatically on successful early access signup
- Includes user's name, email, locked price, and access date
- Graceful fallback if email service fails (signup still succeeds)

---

## 🔧 STILL NEEDS CONFIGURATION FOR PRODUCTION

### Critical (Must Do Before Launch):

1. **Stripe Live Keys**
   ```env
   STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY_HERE
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET
   STRIPE_PRICE_EARLY_ACCESS=price_EARLY_ACCESS_5_DOLLARS
   ```
   - [ ] Create Stripe live mode account
   - [ ] Generate live keys
   - [ ] Create $5 early access price in Stripe Dashboard
   - [ ] Configure production webhook URL: `https://winlab.cloud/api/billing/webhook`
   - [ ] Test with `stripe listen` in production

2. **Razorpay Live Keys**
   ```env
   RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_HERE
   RAZORPAY_KEY_SECRET=your_live_secret_key
   ```
   - [ ] Get live keys from Razorpay Dashboard
   - [ ] Replace test keys in `.env`
   - [ ] Test end-to-end payment flow

3. **Resend Email API**
   ```env
   RESEND_API_KEY=re_YOUR_RESEND_KEY
   ```
   - [ ] Create Resend account
   - [ ] Get API key
   - [ ] Configure domain for email sending (SPF, DKIM, DMARC)
   - [ ] Test email delivery

4. **Database Migration (Production)**
   ```bash
   # Run on production server
   npx prisma migrate deploy
   ```
   - [ ] Backup production database
   - [ ] Run migration
   - [ ] Verify new tables created
   - [ ] Test early access signup flow

5. **Frontend Updates**
   - [ ] Replace `rzp_test_placeholder` with live Razorpay key in frontend
   - [ ] Add early access counter display to landing page
   - [ ] Add "Sold Out" messaging when seats run out
   - [ ] Test geo-detection for India (Hindi/English switch)

---

## 🧪 TESTING CHECKLIST

### Early Access Counter:
- [ ] Signup with valid email
- [ ] Verify email received with $5 locked price
- [ ] Try duplicate signup (should return existing record)
- [ ] Check seat count decreases by 1
- [ ] Test concurrent signups (race condition protection)
- [ ] Test sold out scenario (when 500 reached)

### Webhook Idempotency:
- [ ] Send webhook event once
- [ ] Send same event again (should return 200 immediately)
- [ ] Verify only ONE payment record created
- [ ] Check `ProcessedWebhookEvent` table has entry
- [ ] Test with Stripe CLI: `stripe trigger checkout.session.completed`

### Razorpay Payment:
- [ ] Initiate payment from frontend (India region)
- [ ] Complete test payment
- [ ] Verify signature validation
- [ ] Check user plan updated in database
- [ ] Verify payment record created
- [ ] Check analytics event logged

### Email Delivery:
- [ ] Signup for early access
- [ ] Verify email received within 60 seconds
- [ ] Check locked price shows $5
- [ ] Check access date is 30 days from now
- [ ] Test on Gmail, Outlook, Yahoo
- [ ] Verify mobile rendering (iOS/Android)
- [ ] Check spam score

---

## 📊 MONITORING & ANALYTICS

### Endpoints to Monitor:
```
GET /api/early-access/seats          - Real-time seat availability
GET /api/analytics                   - Event tracking dashboard
```

### Key Metrics:
- Early access signups (target: 500)
- Razorpay conversions (India market)
- Stripe conversions (Global market)
- Webhook processing latency
- Email delivery rate
- Duplicate webhook events caught

### Database Tables to Watch:
- `EarlyAccessSignup` - Seat count and activation rate
- `ProcessedWebhookEvent` - Idempotency tracking
- `Payment` - Success/failure rate
- `Analytics` - Event tracking

---

## 🚨 LAUNCH DAY PROTOCOL

### 24 Hours Before:
1. [ ] Deploy all code to production
2. [ ] Run database migration
3. [ ] Configure live keys (Stripe, Razorpay, Resend)
4. [ ] Test early access signup flow end-to-end
5. [ ] Verify webhook idempotency with live Stripe test
6. [ ] Send test email to team
7. [ ] Monitor error logs for 1 hour

### 1 Hour Before:
1. [ ] Verify all 3 PM2 nodes running
2. [ ] Check Nginx load balancer active
3. [ ] Test SSL certificate
4. [ ] Verify database replica synced
5. [ ] Check rate limiting active
6. [ ] Monitor server load < 50%

### Launch:
1. [ ] Enable early access signup endpoint
2. [ ] Monitor first 10 signups closely
3. [ ] Verify emails sending correctly
4. [ ] Check webhook processing < 100ms
5. [ ] Monitor Razorpay payments (India)
6. [ ] Monitor Stripe payments (Global)
7. [ ] Track seat count in real-time

### Post-Launch (First 24 Hours):
- [ ] Check error rate < 1%
- [ ] Verify email delivery > 95%
- [ ] Monitor webhook idempotency catches duplicates
- [ ] Track conversion rate (visitors → signups)
- [ ] Monitor server response time < 200ms
- [ ] Check database replication lag < 1s
- [ ] Review analytics dashboard every 4 hours

---

## 📝 NOTES

### Razorpay Configuration:
- Current key: `rzp_test_Sd1WjWnmy9yKhm` (TEST MODE)
- Need to get: Live key from Dashboard
- Secret key: Must be added to `.env`
- Webhook: Configure in Razorpay Dashboard for payment confirmations

### Stripe Configuration:
- Need $5 early access price ID (create in Stripe Dashboard)
- Webhook events to enable:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.*`

### Email Configuration:
- Using Resend for delivery
- From address: `support@winlab.cloud`
- Need to verify domain in Resend Dashboard
- Templates: Early access confirmation, sold out notification

### Database:
- SQLite for local dev (auto-migrated)
- MySQL/PostgreSQL for production
- Migration name: `add_early_access_and_webhook_idempotency`
- Tables added: `EarlyAccessSignup`, `ProcessedWebhookEvent`

---

**Last Updated**: April 13, 2026  
**Implementation Status**: 4/4 CRITICAL FEATURES COMPLETE ✅  
**Ready for**: Testing phase, then production launch
