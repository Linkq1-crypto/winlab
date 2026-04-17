# WINLAB India Deployment Guide

## 1. Server Setup (Ubuntu 22.04 LTS)

```bash
# Create app user
sudo useradd -m -s /bin/bash winlab
sudo mkdir -p /var/www/winlab
sudo chown winlab:winlab /var/www/winlab

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm i -g pm2
```

## 2. Deploy Build

```bash
# Upload dist/ and public/
scp -r dist/ winlab@server:/var/www/winlab/
scp -r public/ winlab@server:/var/www/winlab/
scp win_lab_full_backend_frontend_starter.js winlab@server:/var/www/winlab/

# Install production deps
cd /var/www/winlab
npm install --production

# Start backend
pm2 start win_lab_full_backend_frontend_starter.js --name winlab-api
pm2 save && pm2 startup
```

## 3. Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/winlab
sudo ln -s /etc/nginx/sites-available/winlab /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d winlab.cloud -d www.winlab.cloud
```

## 5. Cloudflare Setup

1. Add domain to Cloudflare dashboard
2. Set DNS → A record → your server IP
3. SSL/TLS mode: **Full (strict)**
4. Rules → Transform Rules → enable HTTP/3
5. Speed → Optimization → Brotli: **On**
6. Caching → Cache Rules:
   - `URI ends with .js, .css, .png, .svg, .webp` → **Cache Everything, 1 year**
7. Always Online: **On**

## 6. Razorpay Integration

1. Sign up at https://razorpay.com
2. Get `key_id` and `key_secret`
3. Add backend endpoint `/api/billing/verify-razorpay`:

```js
const crypto = require("crypto");
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;

app.post("/api/billing/verify-razorpay", auth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto.createHmac("sha256", RAZORPAY_SECRET).update(body).digest("hex");

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Upgrade user plan
  await prisma.user.update({
    where: { id: req.user.id },
    data: { plan: plan || "pro" }
  });

  res.json({ success: true });
});
```

4. Set env vars:
```
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
```

## 7. Analytics Backend

Create `/api/analytics/track` endpoint:

```js
const analyticsEvents = [];

app.post("/api/analytics/track", async (req, res) => {
  try {
    analyticsEvents.push({ ...req.body, receivedAt: new Date().toISOString() });
    // Store in DB or send to external analytics (Plausible, PostHog)
    res.status(204).end();
  } catch {
    res.status(500).end();
  }
});
```

## 8. PWA Validation

```bash
# On device:
# 1. Open Chrome → Menu → Add to Home Screen
# 2. Verify splash screen, icons, theme color
# 3. Kill browser → reopen → app should load offline (landing page)
# 4. Check DevTools → Application → Service Workers → status: Activated
```

## 9. KPI Tracking

| Metric | How to Measure |
|---|---|
| Time to first lab | `analytics.js` → `lab_start` timestamp − `page_view` timestamp |
| Activation rate | `lab_complete` / `signup` |
| Free → Paid conversion | `upgrade_success` / `signup` |
| Region split | `region` field in analytics events |

## 10. Performance Targets

| Metric | Target | Verify |
|---|---|---|
| TTFB India | < 250ms | WebPageTest.org (Mumbai) |
| LCP mobile | < 2.5s | Lighthouse |
| Bundle size | < 300KB gzipped | `npm run build` output |
| First lab load | < 60s | Manual test on 4G |
