#!/bin/bash
# ============================================================
# WinLab — Load Balancer Deploy Script
# Run on the SEPARATE load balancer server (NOT on app nodes)
# Usage: NODE1_IP=1.2.3.4 NODE2_IP=1.2.3.5 NODE3_IP=1.2.3.6 bash scripts/deploy-loadbalancer.sh
# ============================================================

set -e

NODE1_IP="${NODE1_IP:-REPLACE_WITH_NODE1_IP}"
NODE2_IP="${NODE2_IP:-REPLACE_WITH_NODE2_IP}"
NODE3_IP="${NODE3_IP:-REPLACE_WITH_NODE3_IP}"
APP_DIR="/var/www/winlab"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WinLab Load Balancer Deploy"
echo "  Node 1: $NODE1_IP"
echo "  Node 2: $NODE2_IP"
echo "  Node 3: $NODE3_IP (backup)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Install Nginx ───────────────────────────────────────
sudo apt-get update -qq
sudo apt-get install -y nginx certbot python3-certbot-nginx
echo "✅ Nginx installed"

# ── 2. Inject node IPs into config ────────────────────────
sudo mkdir -p "$APP_DIR"
cp nginx-loadbalancer.conf /tmp/winlab-lb.conf

sed -i "s/NODE1_IP/$NODE1_IP/g" /tmp/winlab-lb.conf
sed -i "s/NODE2_IP/$NODE2_IP/g" /tmp/winlab-lb.conf
sed -i "s/NODE3_IP/$NODE3_IP/g" /tmp/winlab-lb.conf

sudo cp /tmp/winlab-lb.conf /etc/nginx/sites-available/winlab
sudo ln -sf /etc/nginx/sites-available/winlab /etc/nginx/sites-enabled/winlab
sudo rm -f /etc/nginx/sites-enabled/default

# ── 3. Test + reload ───────────────────────────────────────
sudo nginx -t
sudo systemctl reload nginx
echo "✅ Nginx load balancer configured"

# ── 4. SSL ─────────────────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/winlab.cloud" ]; then
  sudo certbot --nginx -d winlab.cloud -d www.winlab.cloud \
    --non-interactive --agree-tos -m admin@winlab.cloud
  echo "✅ SSL issued"
else
  echo "✅ SSL already present"
fi

# ── 5. Verify failover ─────────────────────────────────────
echo ""
echo "▶ Failover test"
echo "  Kill a node then run: curl https://winlab.cloud/api/health"
echo "  Should still return 200."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ LOAD BALANCER READY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
