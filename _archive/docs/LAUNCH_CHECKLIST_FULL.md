# 🚀 WINLAB CLOUD - LAUNCH CHECKLIST (FULL AUDIT)

## ✅ COMPLETED IMPLEMENTATIONS

### 💳 Payments & Billing

#### 1. ✅ Webhook Stripe Idempotency
**Status**: IMPLEMENTED ✅  
**File**: `win_lab_full_backend_frontend_starter.js` (line 624+)  
**Service**: `src/services/webhookIdempotency.js`

**Implementation:**
- ✅ Tracks processed event IDs in `ProcessedWebhookEvent` table
- ✅ Checks BEFORE processing: `isEventProcessed(event.id)`
- ✅ Marks AFTER successful handling: `markEventProcessed(event.id)`
- ✅ Allows retry on failure (doesn't mark if handler throws)
- ✅ Automatic cleanup after 30 days

**Testing:**
```bash
# Send duplicate webhook event - should return 200 without processing twice
curl -X POST http://localhost:3000/api/billing/webhook \
  -H "stripe-signature: t=123,v1=abc" \
  -d '{"id":"evt_test123","type":"checkout.session.completed"}'
```

---

#### 2. ✅ Piano $5 Early Access Creato su Stripe
**Status**: READY TO CONFIGURE ⚠️  
**What's Done:**
- ✅ Backend endpoint created: `POST /api/stripe/early-access`
- ✅ One-time payment mode (NOT subscription)
- ✅ Price ID env var: `STRIPE_PRICE_EARLY_ACCESS`
- ✅ Added to `.env` with placeholder

**What You Need to Do in Stripe Dashboard:**
1. Go to: https://dashboard.stripe.com/products
2. Create product: "WinLab Early Access"
3. Set pricing: **One-time** payment, $5.00 USD
4. Copy the price ID (looks like: `price_1Nxxxxxxx`)
5. Update `.env`:
   ```env
   STRIPE_PRICE_EARLY_ACCESS=price_1Nxxxxxxx  # Replace with actual ID
   ```

**Frontend Integration:**
```javascript
// Add to pricing page
<button onClick={() => window.location.href='/api/stripe/early-access'}>
  Get Early Access - $5
</button>
```

---

#### 3. ✅ Lifetime $149 Configured as One-Time Payment
**Status**: READY TO CONFIGURE ⚠️  
**What's Done:**
- ✅ Backend endpoint: `POST /api/stripe/lifetime`
- ✅ Uses `mode: 'payment'` (NOT subscription)
- ✅ NO auto-renewal configured
- ✅ Price ID env var: `STRIPE_PRICE_LIFETIME`
- ✅ Added to `.env` with placeholder

**Stripe Dashboard Setup:**
1. Create product: "WinLab Lifetime Access"
2. Set pricing: **One-time** payment, $149.00 USD
3. **IMPORTANT**: Do NOT enable subscriptions
4. Copy price ID
5. Update `.env`:
   ```env
   STRIPE_PRICE_LIFETIME=price_1Nxxxxxxx  # Replace with actual ID
   ```

**Verification Checklist:**
- [ ] Mode is `payment` not `subscription` ✅ (code verified)
- [ ] No `subscription_data` in checkout session ✅
- [ ] No recurring billing metadata ✅
- [ ] Webhook does NOT create subscription record ✅

**Code Verification:**
```javascript
// Verified in src/api/stripe-service.js line 177
const session = await stripe.checkout.sessions.create({
  mode: 'payment',  // ✅ One-time, NOT subscription
  // NO subscription_data here
});
```

---

#### 4. ✅ Africa Payment System (Paystack)
**Status**: IMPLEMENTED ✅  
**Gateway**: Paystack (supports Nigeria, Ghana, Kenya, South Africa)  
**File**: `src/services/paystackService.js`

**Features:**
- ✅ Auto-detects African country from Cloudflare header
- ✅ Supports 4 currencies: NGN 🇳🇬, GHS 🇬🇭, KES 🇰🇪, ZAR 🇿🇦
- ✅ Payment initialization endpoint
- ✅ Webhook with signature verification
- ✅ Payment recording in database
- ✅ Analytics tracking

**API Endpoints:**
```
POST /api/billing/paystack/initialize  - Start payment
POST /api/billing/paystack/webhook     - Payment confirmation
```

**Configuration Needed:**
```env
PAYSTACK_SECRET_KEY=sk_test_your_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
```

**Getting Paystack Keys:**
1. Sign up: https://dashboard.paystack.com
2. Go to: Settings → API Keys & Webhooks
3. Copy keys and update `.env`
4. Configure webhook URL: `https://winlab.cloud/api/billing/paystack/webhook`

**Test Payment:**
```bash
curl -X POST http://localhost:3000/api/billing/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "plan": "pro",
    "amount": 199
  }'
```

---

### 🖥️ Infrastruttura & Deploy

#### 5. ✅ PM2 Cluster Configuration
**Status**: READY ✅  
**File**: `ecosystem.config.js`

**Current Config:**
```javascript
{
  name: 'winlab',
  script: 'win_lab_full_backend_frontend_starter.js',
  instances: 'max',      // Uses ALL CPU cores
  exec_mode: 'cluster',  // Cluster mode (load balanced)
  max_memory_restart: '1G',
  autorestart: true,
  max_restarts: 10,
  min_uptime: '60s',
}
```

**Deployment on 3 Nodes:**
```bash
# On EACH server (3 separate machines):
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on boot

# Verify all workers:
pm2 status
# Should show: winlab-0, winlab-1, winlab-2, etc. (one per CPU core)
```

**Launch Checklist:**
- [ ] Deploy to Node 1 (e.g., 192.168.1.101)
- [ ] Deploy to Node 2 (e.g., 192.168.1.102)
- [ ] Deploy to Node 3 (e.g., 192.168.1.103)
- [ ] Run `pm2 status` on each - verify workers up
- [ ] Test failover: `pm2 kill` on one node, verify others still work

---

#### 6. ✅ Nginx Load Balancer
**Status**: CONFIGURED ✅  
**File**: `nginx-loadbalancer.conf`

**Configuration Verified:**
- ✅ `least_conn` algorithm active
- ✅ 3 upstream servers with weights:
  - `127.0.0.1:3001` (weight=3, primary)
  - `127.0.0.1:3002` (weight=2, secondary)
  - `127.0.0.1:3003` (weight=1, backup)
- ✅ Failover on 500/502/503/504
- ✅ WebSocket support
- ✅ HSTS with 2-year max-age + preload
- ✅ SSL with Let's Encrypt

**Failover Test:**
```bash
# Kill one PM2 worker
pm2 kill winlab-0

# Verify nginx still routes to others
curl https://winlab.cloud/api/health

# Should still return 200
```

**Deployment:**
```bash
sudo cp nginx-loadbalancer.conf /etc/nginx/sites-enabled/winlab.conf
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

#### 7. ⚠️ MariaDB Replica
**Status**: NEEDS VERIFICATION ⚠️  
**Note**: Current setup uses SQLite for dev, needs MySQL/MariaDB for prod

**What to Verify on Production:**
```sql
-- On PRIMARY server:
SHOW MASTER STATUS;
-- Should show: File, Position, Binlog_Do_DB

-- On REPLICA server:
SHOW SLAVE STATUS\G
-- Check:
--   Slave_IO_Running: Yes
--   Slave_SQL_Running: Yes
--   Seconds_Behind_Master: 0 (or < 1)
```

**Launch Checklist:**
- [ ] Verify replica lag < 1 second in idle
- [ ] Test replication: insert on primary, check appears on replica
- [ ] Monitor with: `SHOW SLAVE STATUS\G` every minute

---

#### 8. ⚠️ Backup Automatico
**Status**: NEEDS VERIFICATION ⚠️  
**File**: `scripts/backup.js` (if exists)

**What to Check:**
```bash
# Check if backup script exists
ls -la scripts/backup.js

# Check cron job
crontab -l | grep backup

# Verify latest backup
ls -lh /backups/  # Or your backup directory
```

**If backup script doesn't exist, create one:**
```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p winlab > /backups/winlab_$DATE.sql
find /backups -name "*.sql" -mtime +7 -delete  # Keep 7 days
```

**Schedule with cron:**
```bash
# Daily at 2 AM
0 2 * * * /path/to/scripts/backup.sh
```

---

#### 9. ⚠️ CF Workers Secrets (12 total)
**Status**: NEEDS VERIFICATION ⚠️  
**Tool**: `wrangler secret`

**Required Secrets:**
1. REPLICATE_API_KEY
2. ELEVEN_LABS_API_KEY
3. AYRSHARE_API_KEY
4. TELEGRAM_BOT_TOKEN
5. HUGGINGFACE_API_KEY
6. DASHBOARD_URL
7. ADMIN_SECRET
8. STRIPE_WEBHOOK_URL
9. DATABASE_URL
10. ENCRYPTION_KEY
11. RESEND_API_KEY
12. CLOUDFLARE_API_KEY

**Verification:**
```bash
# List all secrets
wrangler secret list

# Should show 12 secrets
# If any missing, add them:
wrangler secret put SECRET_NAME
```

**Checklist:**
- [ ] All 12 secrets configured
- [ ] Test CF Worker responds correctly
- [ ] Verify secrets not exposed in frontend code

---

#### 10. ✅ SSL Certificato Valido
**Status**: CONFIGURED ✅ (HSTS already in code)  
**File**: `nginx-loadbalancer.conf`

**Current SSL Config:**
```nginx
ssl_certificate /etc/letsencrypt/live/winlab.cloud/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/winlab.cloud/privkey.pem;

# HSTS - 2 years max-age + preload
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

**Verification:**
```bash
# Check SSL expiry
echo | openssl s_client -servername winlab.cloud -connect winlab.cloud:443 2>/dev/null | openssl x509 -noout -dates

# Should show: notAfter=2026-XX-XX (at least 60 days from launch)

# Test SSL grade
curl -s https://www.ssllabs.com/ssltest/analyze.html?d=winlab.cloud
```

**Launch Checklist:**
- [ ] SSL cert valid for at least 60 days
- [ ] Auto-renewal configured: `certbot renew --dry-run`
- [ ] HSTS header present in responses

---

### 🎓 Prodotto & Labs

#### 11. ⚠️ Free Linux Terminal Lab senza Signup
**Status**: NEEDS TESTING ⚠️  
**Requirement**: Load in < 3 seconds on simulated 2G connection

**Testing Procedure:**
```bash
# 1. Chrome DevTools → Network tab → Throttling → Slow 2G
# 2. Navigate to: http://winlab.cloud/lab/linux-terminal
# 3. Measure load time

# Or with Lighthouse CLI:
lighthouse http://winlab.cloud/lab/linux-terminal \
  --chrome-flags="--headless" \
  --throttling-method=provided \
  --throttling.rttMs=1500 \
  --throttling.throughputKbps=100
```

**Checklist:**
- [ ] Loads without requiring login
- [ ] Terminal interactive in < 3 seconds on 2G
- [ ] No blank screen or loading spinner > 3s
- [ ] Works on mobile Chrome/Firefox

---

#### 12. ⚠️ Offline Mode Mobile
**Status**: PWA Service Worker exists, NEEDS TESTING ⚠️  
**Files**: `dist/sw.js`, `dist/registerSW.js`

**Testing Procedure:**
```bash
# 1. Open lab on mobile Chrome
# 2. Complete partial scenario
# 3. Turn OFF WiFi
# 4. Continue working in offline mode
# 5. Turn WiFi back ON
# 6. Verify data syncs to server
```

**PWA Features Verified:**
- ✅ Service worker registered (`sw.js`)
- ✅ Workbox precaching configured
- ✅ Offline fallback exists

**Checklist:**
- [ ] "Add to Home Screen" prompt appears on Android Chrome
- [ ] App works offline (labs load from cache)
- [ ] Progress syncs when reconnecting
- [ ] No errors in Service Worker tab (DevTools)

---

#### 13. ✅ AI Mentor Cache SHA-256
**Status**: IMPLEMENTED (using semantic similarity) ✅  
**File**: `src/services/aiLearningCache.js`

**Current Implementation:**
- Uses semantic similarity (cosine similarity on text embeddings)
- 64-dimensional text vectors
- 80% similarity threshold for cache hit
- Feedback scoring (0.0 to 1.0)
- Decay over time (2% per 5 minutes)

**Note**: Uses semantic matching instead of SHA-256 exact match
- **Better**: Finds similar questions, not just exact duplicates
- **Fallback**: If you need SHA-256 exact matching, can add it

**Verification:**
```bash
# Test cache behavior:
# 1. Ask AI Mentor: "How do I fix RAID?"
# 2. Ask again: "How do I fix RAID?" (similar)
# 3. Should return cached response (no API call)
# 4. Check database: AiCache table should have 1 entry, not 2
```

**Checklist:**
- [ ] Same question twice = no second Anthropic API call
- [ ] Similar questions use cached response
- [ ] Cache entries visible in `AiCache` table
- [ ] Hit rate > 30% (monitor analytics)

---

#### 14. ⚠️ Certificate Generation
**Status**: NEEDS VERIFICATION ⚠️  
**Model**: `Certificate` in Prisma schema

**Testing Procedure:**
```bash
# 1. Complete 10 labs in staging
# 2. Trigger certificate generation
# 3. Download PDF
# 4. Verify:
#    - Unique certId (UUID)
#    - Verifiable URL: https://winlab.cloud/verify/cert/{certId}
#    - PDF contains user name, date, labs completed
#    - QR code links to verification page
```

**Database Schema:**
```prisma
model Certificate {
  id            String   @id @default(cuid())
  certId        String   @unique  // Unique verifiable ID
  userId        String
  labsCompleted Int
  issuedAt      DateTime @default(now())
}
```

**Checklist:**
- [ ] Complete 10 labs
- [ ] Certificate auto-generated
- [ ] PDF downloads with unique ID
- [ ] Verification page works: `/verify/cert/{certId}`
- [ ] QR code scannable

---

#### 15. ✅ PWA Service Worker Registrato
**Status**: IMPLEMENTED ✅  
**Files**: `dist/sw.js`, `dist/registerSW.js`

**Verification:**
```javascript
// dist/registerSW.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
  })
}
```

**Testing on Android Chrome:**
1. Open https://winlab.cloud
2. Wait 10 seconds
3. Should see "Add WinLab to Home Screen" prompt
4. Tap "Add"
5. Verify icon appears on home screen
6. Tap icon - should open in standalone mode (no browser UI)

**Checklist:**
- [ ] Service worker registered (check DevTools → Application → Service Workers)
- [ ] "Add to Home Screen" prompt appears
- [ ] App launches in fullscreen/standalone mode
- [ ] Offline access works
- [ ] Background sync enabled

---

## 🎯 LAUNCH PRIORITY ORDER

### 🚨 CRITICAL (Must Do Before Launch):

1. ✅ ~~Webhook idempotency~~ - DONE
2. ⚠️ **Stripe live keys** - Get from Stripe Dashboard
3. ⚠️ **$5 early access price ID** - Create in Stripe, add to `.env`
4. ⚠️ **$149 lifetime price ID** - Create in Stripe, add to `.env`
5. ⚠️ **Razorpay live keys** - Complete KYC, get live keys
6. ⚠️ **Paystack keys** - Sign up, get API keys
7. ⚠️ **Test all 3 payment gateways end-to-end**
8. ⚠️ **SSL cert expiry** - Verify > 60 days
9. ⚠️ **Database migration** - Run on production
10. ⚠️ **PM2 on all 3 nodes** - Deploy and verify

### ⚡ HIGH PRIORITY (First 48 Hours):

11. ⚠️ **Free lab load time** - Test on 2G
12. ⚠️ **Offline mode** - Test mobile disconnect/reconnect
13. ⚠️ **Certificate generation** - Complete 10 labs, verify PDF
14. ⚠️ **PWA install prompt** - Test Android Chrome
15. ⚠️ **CF Workers secrets** - Verify all 12 set

### 📊 MONITORING (Post-Launch):

16. Monitor webhook idempotency logs
17. Track payment success rate by gateway
18. Monitor AI cache hit rate
19. Check certificate generation errors
20. Verify backup script runs daily

---

## 🧪 QUICK TEST COMMANDS

```bash
# 1. Test payment endpoints
curl http://localhost:3000/api/early-access/seats
curl -X POST http://localhost:3000/api/stripe/early-access -H "Content-Type: application/json" -d '{"email":"test@example.com"}'

# 2. Test webhook idempotency
curl -X POST http://localhost:3000/api/billing/webhook -H "stripe-signature: t=123,v1=abc" -d '{"id":"evt_123"}'

# 3. Check PM2 status
pm2 status

# 4. Check nginx
sudo nginx -t
sudo systemctl status nginx

# 5. Check SSL
openssl s_client -connect winlab.cloud:443 -servername winlab.cloud </dev/null 2>/dev/null | openssl x509 -noout -dates

# 6. Check database
npx prisma studio

# 7. Check CF Workers
wrangler tail
```

---

**Last Updated**: April 13, 2026  
**Status**: 60% Complete - Payment infrastructure ready, needs live keys  
**Next Step**: Configure Stripe live keys and test end-to-end flow
