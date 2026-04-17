# 🚀 WINLAB CLOUD — DEPLOYMENT GUIDE (OPTION A: Linux Server)

## PREREQUISITES
- Linux VPS (Ubuntu 22.04 recommended) with root access
- Domain: winlab.cloud (DNS pointing to your server IP)
- Node.js 18+ installed on server
- MariaDB/PostgreSQL for production database

---

## STEP 1: PREPARE THE BUILD (on your Windows machine)

### 1.1 Build the frontend
```bash
# In C:\Users\johns\Desktop\winw\lab
npm run build
```
This creates the `dist/` folder with optimized frontend assets.

### 1.2 Create deployment package
Create a ZIP with these files/folders:
```
winlab-deploy/
├── win_lab_full_backend_frontend_starter.js  # Backend server
├── package.json
├── package-lock.json
├── ecosystem.config.js
├── nginx-loadbalancer.conf
├── .env.example
├── dist/                      # Built frontend (from npm run build)
├── prisma/                    # Database schema
├── scripts/
│   ├── backup.js
│   └── backup-helpdesk.js
└── public/                    # Static assets (robots.txt, etc.)
```

**Command to create ZIP (PowerShell):**
```powershell
cd C:\Users\johns\Desktop\winw\lab

# Create deploy folder
mkdir winlab-deploy

# Copy files
Copy-Item win_lab_full_backend_frontend_starter.js winlab-deploy\
Copy-Item package.json winlab-deploy\
Copy-Item package-lock.json winlab-deploy\
Copy-Item ecosystem.config.js winlab-deploy\
Copy-Item nginx-loadbalancer.conf winlab-deploy\
Copy-Item .env.example winlab-deploy\
Copy-Item -Recurse dist winlab-deploy\
Copy-Item -Recurse prisma winlab-deploy\
Copy-Item -Recurse scripts winlab-deploy\
Copy-Item -Recurse public winlab-deploy\

# Create ZIP
Compress-Archive -Path winlab-deploy\* -DestinationPath winlab-deploy.zip -Force
```

---

## STEP 2: UPLOAD TO SERVER

### 2.1 SCP the package to your server
```bash
# From your Windows machine (using Git Bash or WSL)
scp C:\Users\johns\Desktop\winw\lab\winlab-deploy.zip root@YOUR_SERVER_IP:/tmp/

# SSH into server
ssh root@YOUR_SERVER_IP
```

### 2.2 Extract on server
```bash
cd /tmp
unzip winlab-deploy.zip -d /var/www/winlab
cd /var/www/winlab
```

---

## STEP 3: INSTALL DEPENDENCIES

### 3.1 Install Node.js (if not already installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version  # Should be v20.x
```

### 3.2 Install PM2 globally
```bash
npm install -g pm2
pm2 --version
```

### 3.3 Install project dependencies
```bash
cd /var/www/winlab
npm install --production
```

---

## STEP 4: CONFIGURE ENVIRONMENT

### 4.1 Create .env file
```bash
cp .env.example .env
nano .env
```

### 4.2 Update .env with production values
```env
# ── Database ──────────────────────────────────────────────────────────────────
# PRODUCTION: Use MariaDB/PostgreSQL (NOT SQLite)
DATABASE_URL="mysql://winlab:STRONG_PASSWORD@localhost:3306/winlab"
# OR for PostgreSQL:
# DATABASE_URL="postgresql://winlab:STRONG_PASSWORD@localhost:5432/winlab"

# ── Anthropic ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=your-production-key

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
STRIPE_PRICE_EARLY_ACCESS=price_YOUR_EARLY_ACCESS_PRICE_ID
STRIPE_PRICE_LIFETIME=price_YOUR_LIFETIME_PRICE_ID

# ── Razorpay (India) ─────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY
RAZORPAY_KEY_SECRET=YOUR_SECRET

# ── Paystack (Africa) ────────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY=sk_live_YOUR_KEY
PAYSTACK_PUBLIC_KEY=pk_live_YOUR_KEY
PAYSTACK_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# ── App ───────────────────────────────────────────────────────────────────────
APP_URL=https://winlab.cloud
JWT_SECRET=GENERATE_A_STRONG_RANDOM_STRING_HERE

# ── Encryption ────────────────────────────────────────────────────────────────
ENCRYPTION_KEY=GENERATE_WITH: openssl rand -hex 32

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_YOUR_KEY

# ── Backup (Backblaze B2) ─────────────────────────────────────────────────────
B2_KEY_ID=YOUR_B2_KEY_ID
B2_APP_KEY=YOUR_B2_APP_KEY
B2_BUCKET=winlab-backups
DB_USER=root
DB_PASS=YOUR_DB_PASSWORD
DB_NAME=winlab
```

### 4.3 Generate secure values
```bash
# JWT Secret
openssl rand -hex 32

# Encryption Key
openssl rand -hex 32
```

---

## STEP 5: SETUP DATABASE

### 5.1 Install MariaDB (or PostgreSQL)
```bash
# MariaDB
apt-get install -y mariadb-server
systemctl start mariadb
systemctl enable mariadb
mysql_secure_installation
```

### 5.2 Create database and user
```bash
mysql -u root -p
```

```sql
CREATE DATABASE winlab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'winlab'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON winlab.* TO 'winlab'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5.3 Run Prisma migrations
```bash
cd /var/www/winlab
npx prisma migrate deploy
```

---

## STEP 6: START THE APPLICATION

### 6.1 Create log directory
```bash
mkdir -p /var/log/pm2
chown -R $USER:$USER /var/log/pm2
```

### 6.2 Start with PM2
```bash
cd /var/www/winlab
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6.3 Verify
```bash
pm2 status          # Should show "winlab" app online
pm2 logs winlab     # Check for errors
curl http://localhost:3001/api/health  # Should return 200 OK
```

---

## STEP 7: SETUP NGINX

### 7.1 Install Nginx + Certbot
```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

### 7.2 Configure Nginx
```bash
cp /var/www/winlab/nginx-loadbalancer.conf /etc/nginx/sites-available/winlab.conf
ln -s /etc/nginx/sites-available/winlab.conf /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site
```

### 7.3 Test Nginx config
```bash
nginx -t
```

If it passes:
```bash
systemctl restart nginx
systemctl enable nginx
```

### 7.4 Get SSL certificate (Let's Encrypt)
```bash
certbot --nginx -d winlab.cloud -d www.winlab.cloud
```

Follow the prompts. Certbot will automatically configure SSL and redirect HTTP→HTTPS.

### 7.5 Verify SSL auto-renewal
```bash
certbot renew --dry-run
```

---

## STEP 8: CONFIGURE FIREWALL

```bash
# Allow SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## STEP 9: SETUP STRIPE WEBHOOK

### 9.1 Create webhook in Stripe Dashboard
1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://winlab.cloud/api/billing/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.*`
5. Copy webhook secret `whsec_...`

### 9.2 Update .env with webhook secret
```bash
nano /var/www/winlab/.env
# Update: STRIPE_WEBHOOK_SECRET=whsec_...

# Restart PM2 to pick up new env vars
pm2 restart winlab
```

---

## STEP 10: SETUP BACKUP CRON

### 10.1 Install Backblaze B2 CLI
```bash
# Install B2 CLI
curl -s https://backblazeb2.github.io/b2-sdk/install.sh | bash

# Authorize account
b2 authorize-account YOUR_KEY_ID YOUR_APP_KEY
```

### 10.2 Test backup script
```bash
cd /var/www/winlab
node scripts/backup.js
```

### 10.3 Add cron job
```bash
crontab -e
```

Add this line:
```cron
0 2 * * * cd /var/www/winlab && node scripts/backup.js >> /var/log/winlab-backup.log 2>&1
```

Verify:
```bash
crontab -l
```

---

## STEP 11: FINAL VERIFICATION

### 11.1 Test the application
```bash
# HTTPS
curl -I https://winlab.cloud

# API health
curl https://winlab.cloud/api/health

# Webhook endpoint (should return 400 without signature)
curl -X POST https://winlab.cloud/api/billing/webhook
```

### 11.2 Check SSL
```bash
# Verify certificate expiry
echo | openssl s_client -servername winlab.cloud -connect winlab.cloud:443 2>/dev/null | openssl x509 -noout -dates

# Verify HSTS
curl -I https://winlab.cloud | grep Strict-Transport-Security
```

### 11.3 Check PM2 monitoring
```bash
pm2 monit          # Real-time monitoring
pm2 logs winlab    # View logs
pm2 restart winlab # Restart if needed
```

---

## TROUBLESHOOTING

### App won't start
```bash
pm2 logs winlab --lines 100  # Check last 100 log lines
pm2 flush                     # Clear logs
pm2 restart winlab
```

### Database connection error
```bash
# Test DB connection
mysql -u winlab -p winlab
# If fails, check .env DATABASE_URL
```

### Port already in use
```bash
# Check what's using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Check Nginx error logs
tail -f /var/log/nginx/error.log
```

### Stripe webhook signature error
```bash
# Verify STRIPE_WEBHOOK_SECRET in .env matches Stripe dashboard
# Ensure NO trailing spaces or newlines
```

---

## MONITORING & MAINTENANCE

### PM2 Commands
```bash
pm2 status          # Check app status
pm2 logs            # View logs
pm2 restart winlab  # Restart app
pm2 stop winlab     # Stop app
pm2 delete winlab   # Remove from PM2
pm2 save            # Save process list
```

### Nginx Commands
```bash
systemctl status nginx
systemctl restart nginx
systemctl reload nginx   # Graceful reload
nginx -t                 # Test config
```

### View Logs
```bash
# PM2 logs
pm2 logs winlab --lines 50

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# System logs
journalctl -u nginx -f
journalctl -u mariadb -f
```

---

## SECURITY CHECKLIST

- ✅ Firewall enabled (UFW)
- ✅ SSL certificate (Let's Encrypt)
- ✅ HSTS header active
- ✅ Rate limiting (express-rate-limit)
- ✅ Helmet security headers
- ✅ Database user has minimal privileges
- ✅ Environment variables secured
- ✅ PM2 running in cluster mode
- ✅ Automatic backups configured

---

**🎉 Once this is done, your Stripe webhook will be live and ready!**
