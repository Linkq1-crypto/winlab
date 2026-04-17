#!/bin/bash
# ==========================================
# Cloudflare Workers Deploy Script
# Market-Adaptive AI Shorts (USA/IN/AF)
# ==========================================

set -e

echo "🚀 Deploying Market-Adaptive AI Shorts..."

# Step 1: Check prerequisites
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: Prerequisites Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v npm &> /dev/null; then
  echo "❌ npm not found. Install Node.js first."
  exit 1
fi

if ! command -v wrangler &> /dev/null; then
  echo "📦 Installing Wrangler CLI..."
  npm install -g wrangler
fi

echo "✅ Node.js: $(node --version)"
echo "✅ Wrangler: $(wrangler --version)"

# Step 2: Install dependencies
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 2: Install Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npm install
echo "✅ Dependencies installed"

# Step 3: Login to Cloudflare
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Step 3: Cloudflare Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wrangler login
echo "✅ Logged in"

# Step 4: Create R2 bucket
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  Step 4: Create R2 Bucket"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wrangler r2 bucket create ai-shorts-media || echo "⏭️  Bucket already exists"
wrangler r2 bucket create ai-shorts-media-dev || echo "⏭️  Dev bucket already exists"
echo "✅ R2 buckets created"

# Step 5: Create KV namespace
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Step 5: Create KV Namespace"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

KV_OUTPUT=$(wrangler kv:namespace create KV_APPROVALS)
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+')
PREVIEW_ID=$(echo "$KV_OUTPUT" | grep -oP 'preview_id = "\K[^"]+')

echo "✅ KV Namespace created"
echo "   Production ID: $KV_ID"
echo "   Preview ID: $PREVIEW_ID"

# Step 6: Create Queue
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📬 Step 6: Create Queue"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wrangler queues create render-queue || echo "⏭️  Queue already exists"
echo "✅ Queue created"

# Step 7: Update wrangler.toml with IDs
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Step 7: Update wrangler.toml"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sed -i "s/your-kv-namespace-id/$KV_ID/g" wrangler.toml
sed -i "s/your-kv-namespace-preview-id/$PREVIEW_ID/g" wrangler.toml

echo "✅ wrangler.toml updated with KV IDs"

# Step 8: Set secrets
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 Step 8: Set Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Enter API keys (input hidden — leave empty to skip):"
echo ""

put_secret() {
  local name=$1
  local value=$2
  if [ -n "$value" ]; then
    echo "$value" | wrangler secret put "$name"
    echo "  ✅ $name"
  else
    echo "  ⏭️  $name skipped"
  fi
}

read -sp "REPLICATE_API_KEY: " REPLICATE_KEY; echo
put_secret REPLICATE_API_KEY "$REPLICATE_KEY"

read -sp "ELEVEN_API_KEY: " ELEVEN_KEY; echo
put_secret ELEVEN_API_KEY "$ELEVEN_KEY"

read -sp "AYRSHARE_API_KEY: " AYRSHARE_KEY; echo
put_secret AYRSHARE_API_KEY "$AYRSHARE_KEY"

read -sp "TELEGRAM_BOT_TOKEN: " TELEGRAM_TOKEN; echo
put_secret TELEGRAM_BOT_TOKEN "$TELEGRAM_TOKEN"

read -sp "TELEGRAM_CHAT_ID: " CHAT_ID; echo
put_secret TELEGRAM_CHAT_ID "$CHAT_ID"

read -sp "HF_API_KEY: " HF_KEY; echo
put_secret HF_API_KEY "$HF_KEY"

read -sp "DASHBOARD_API_KEY: " DASHBOARD_KEY; echo
put_secret DASHBOARD_API_KEY "$DASHBOARD_KEY"

read -p  "ADMIN_USER (default: admin): " ADMIN_USER; echo
put_secret ADMIN_USER "${ADMIN_USER:-admin}"

read -sp "ADMIN_PASS: " ADMIN_PASS; echo
put_secret ADMIN_PASS "$ADMIN_PASS"

read -p  "APPS_SCRIPT_WEBHOOK_URL (optional): " APPS_SCRIPT_URL; echo
put_secret APPS_SCRIPT_WEBHOOK_URL "$APPS_SCRIPT_URL"

read -p  "DISCORD_WEBHOOK_URL (optional): " DISCORD_URL; echo
put_secret DISCORD_WEBHOOK_URL "$DISCORD_URL"

read -p  "SLACK_WEBHOOK_URL (optional): " SLACK_URL; echo
put_secret SLACK_WEBHOOK_URL "$SLACK_URL"

echo ""
echo "✅ Secrets configured"

# Step 9: Deploy
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 9: Deploy Worker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wrangler deploy

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📡 Worker URL: https://ai-shorts-worker.your-subdomain.workers.dev"
echo "🔗 Webhook URL: https://ai-shorts-worker.your-subdomain.workers.dev/webhook"
echo "📊 Pending: https://ai-shorts-worker.your-subdomain.workers.dev/pending"
echo "📈 Stats: https://ai-shorts-worker.your-subdomain.workers.dev/stats"
echo ""
echo "🎯 Next Steps:"
echo "  1. Set Telegram webhook:"
echo "     curl -X POST \"https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://ai-shorts-worker.your-subdomain.workers.dev/telegram/<TOKEN>\""
echo "  2. Test: curl -X POST https://ai-shorts-worker.your-subdomain.workers.dev/generate -d '{\"market\":\"us\"}'"
echo "  3. Monitor: wrangler tail"
echo ""
