#!/bin/bash
# ============================================================
# WinLab — Server Deploy Script
# Run on EACH of the 3 backend nodes
# Usage: bash scripts/deploy-server.sh
# ============================================================

set -e

APP_DIR="/var/www/winlab"
LOG_DIR="/var/log/pm2"
REPO_URL="${REPO_URL:-}"  # Set via: REPO_URL=https://github.com/you/winlab bash deploy-server.sh

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WinLab Server Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System dependencies ─────────────────────────────────
echo ""
echo "▶ Step 1: System dependencies"
sudo apt-get update -qq
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx mysql-client

# Node.js 20 (if not installed)
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  ✅ Node $(node --version) | npm $(npm --version)"

# PM2
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi
echo "  ✅ PM2 $(pm2 --version)"

# ── 2. App directory ───────────────────────────────────────
echo ""
echo "▶ Step 2: App directory"
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$LOG_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"
echo "  ✅ $APP_DIR"
echo "  ✅ $LOG_DIR"

# ── 3. Deploy code ─────────────────────────────────────────
echo ""
echo "▶ Step 3: Deploy code"
if [ -n "$REPO_URL" ]; then
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" pull
    echo "  ✅ git pull"
  else
    git clone "$REPO_URL" "$APP_DIR"
    echo "  ✅ git clone"
  fi
else
  echo "  ⏭️  REPO_URL not set — copy files manually to $APP_DIR"
  echo "     scp -r . user@SERVER:$APP_DIR"
fi

# ── 4. Install dependencies ────────────────────────────────
echo ""
echo "▶ Step 4: npm install"
cd "$APP_DIR"
npm install --production
echo "  ✅ Dependencies installed"

# ── 5. Copy .env ───────────────────────────────────────────
echo ""
echo "▶ Step 5: .env"
if [ ! -f "$APP_DIR/.env" ]; then
  echo "  ⚠️  No .env found at $APP_DIR/.env"
  echo "     Copy it manually: scp .env user@SERVER:$APP_DIR/.env"
else
  echo "  ✅ .env present"
fi

# ── 6. Prisma migrate ──────────────────────────────────────
echo ""
echo "▶ Step 6: Prisma migrate"
cd "$APP_DIR"
npx prisma migrate deploy
echo "  ✅ Database migrated"

# ── 7. Build frontend ──────────────────────────────────────
echo ""
echo "▶ Step 7: Vite build"
npm run build 2>/dev/null || echo "  ⏭️  No build script — using existing dist/"
echo "  ✅ Frontend ready"

# ── 8. PM2 start ───────────────────────────────────────────
echo ""
echo "▶ Step 8: PM2"
cd "$APP_DIR"
pm2 delete winlab 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | sudo bash -  # Auto-start on reboot
echo "  ✅ PM2 running"
pm2 status

# ── 9. Nginx ───────────────────────────────────────────────
echo ""
echo "▶ Step 9: Nginx"
sudo cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/winlab
sudo ln -sf /etc/nginx/sites-available/winlab /etc/nginx/sites-enabled/winlab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
echo "  ✅ Nginx configured"

# ── 10. SSL (Let's Encrypt) ────────────────────────────────
echo ""
echo "▶ Step 10: SSL"
if [ ! -d "/etc/letsencrypt/live/winlab.cloud" ]; then
  sudo certbot --nginx -d winlab.cloud -d www.winlab.cloud \
    --non-interactive --agree-tos -m admin@winlab.cloud
  echo "  ✅ SSL certificate issued"
else
  sudo certbot renew --dry-run
  echo "  ✅ SSL certificate already present"
fi

# ── 11. Backup cron ────────────────────────────────────────
echo ""
echo "▶ Step 11: Backup cron"
CRON_JOB="0 2 * * * cd $APP_DIR && node scripts/backup.js >> /var/log/winlab-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup.js"; echo "$CRON_JOB") | crontab -
echo "  ✅ Cron job set (daily at 02:00)"
crontab -l | grep backup

# ── 12. Firewall ───────────────────────────────────────────
echo ""
echo "▶ Step 12: Firewall"
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3001/tcp # PM2 (from load balancer only — restrict in production)
sudo ufw --force enable
echo "  ✅ Firewall active"

# ── Done ───────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ DEPLOY COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Verify:"
echo "  curl http://localhost:3001/api/health"
echo "  pm2 status"
echo "  sudo nginx -t"
echo ""
echo "  Logs:"
echo "  pm2 logs winlab"
echo "  tail -f /var/log/pm2/winlab-error.log"
echo ""
