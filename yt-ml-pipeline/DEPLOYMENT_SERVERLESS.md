# Serverless Deployment Guide

## 🚀 Quick Deploy

### Option 1: Vercel (Easiest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add REPLICATE_API_TOKEN
vercel env add HUGGINGFACE_API_TOKEN
vercel env add AYRSHARE_API_KEY
vercel env add CLOUDFLARE_R2_ACCESS_KEY_ID
vercel env add CLOUDFLARE_R2_SECRET_ACCESS_KEY

# Trigger run
curl https://your-project.vercel.app/api/run
```

### Option 2: Cloudflare Workers

```bash
# Install Wrangler CLI
npm i -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy

# Set secrets
wrangler secret put REPLICATE_API_TOKEN
wrangler secret put HUGGINGFACE_API_TOKEN
wrangler secret put AYRSHARE_API_KEY
wrangler secret put CLOUDFLARE_R2_ACCESS_KEY_ID
wrangler secret put CLOUDFLARE_R2_SECRET_ACCESS_KEY

# Test
curl https://yt-ml-pipeline.your-account.workers.dev
```

### Option 3: AWS Lambda

```bash
# Install Serverless Framework
npm i -g serverless

# Deploy
serverless deploy

# Invoke
serverless invoke -f run

# Set environment variables in serverless.yml
```

---

## 📦 Package for Lambda

```bash
# Install production dependencies only
npm ci --production

# Create deployment package
zip -r deployment.zip \
  serverless/ \
  node_modules/ \
  package.json

# Upload to Lambda
aws lambda update-function-code \
  --function-name yt-ml-pipeline \
  --zip-file fileb://deployment.zip
```

---

## 🔧 Environment Variables Required

| Variable | Source | Required |
|----------|--------|----------|
| `REPLICATE_API_TOKEN` | replicate.com | ✅ |
| `HUGGINGFACE_API_TOKEN` | huggingface.co | ✅ |
| `AYRSHARE_API_KEY` | ayrshare.com | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | dash.cloudflare.com | ✅ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 dashboard | ✅ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 dashboard | ✅ |
| `PEXELS_API_KEY` | pexels.com/api | Optional (fallback) |

---

## ⚙️ Serverless Optimizations

### Memory Settings
- **AWS Lambda**: 4096 MB (FFmpeg needs RAM)
- **Cloudflare Workers**: 128 MB limit (use streaming)
- **Vercel**: 1024 MB (default)

### Timeout Settings
- **AWS Lambda**: 5 minutes (300s)
- **Cloudflare Workers**: 30 seconds (use async webhooks for long tasks)
- **Vercel**: 60 seconds (Pro: 15 min)

### Cold Start Mitigation

**AWS Lambda:**
```yaml
# serverless.yml
provisionedConcurrency: 2  # Keep warm
```

**Cloudflare Workers:**
```bash
# Ping every 2 minutes to keep warm
curl https://your-worker.workers.dev/keepalive
```

**Vercel:**
```json
// vercel.json
{
  "functions": {
    "serverless/orchestrator.js": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

---

## 📊 Monitoring & Alerting

### CloudWatch (AWS)
```bash
# Set up error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name yt-ml-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:alerts
```

### Cost Tracking
```bash
# Replicate daily spend
curl -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/predictions?limit=100

# Cloudflare R2 costs
# Free tier: 10GB storage, 1M reads/month, 100K writes/month
```

---

## 🔄 Scheduled Runs

### Cron (Cloudflare Workers)
Already configured in `wrangler.toml`:
```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
```

### EventBridge (AWS)
```yaml
# serverless.yml
functions:
  run:
    handler: serverless/orchestrator.handler
    events:
      - schedule: rate(6 hours)
```

### GitHub Actions (Any Platform)
```yaml
# .github/workflows/run-pipeline.yml
name: Run ML Pipeline
on:
  schedule:
    - cron: '0 */6 * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Pipeline
        run: |
          curl -X POST ${{ secrets.PIPELINE_URL }} \
            -H "Authorization: Bearer ${{ secrets.API_KEY }}"
```

---

## ⚠️ Critical Serverless Limits

| Limit | Value | Workaround |
|-------|-------|------------|
| **Lambda Timeout** | 15 min max | Generate clips ≤15s |
| **Lambda /tmp** | 10 GB max | Clean up after each step |
| **Worker Timeout** | 30 sec | Use async + webhooks |
| **Worker Memory** | 128 MB | Stream, don't load full files |
| **Vercel Timeout** | 60 sec (Pro: 15 min) | Use async generation |
| **R2 Object Size** | Unlimited | No issues here |

---

## 🧪 Testing Locally

```bash
# Set up env
cp .env.example .env
# Edit .env with your keys

# Run pipeline
node serverless/orchestrator.js

# Test single component
node -e "require('./serverless/generator').generateVideo('linux tutorial')"
```

---

## 🎯 Production Checklist

- [ ] All environment variables set
- [ ] R2 bucket created
- [ ] Ayrshare platforms connected
- [ ] Replicate/DashScope token valid
- [ ] Monitoring/alerting configured
- [ ] Cost limits set (Replicate quota)
- [ ] Webhook URL accessible (if using async)
- [ ] Error handling tested
- [ ] /tmp cleanup verified
- [ ] Scheduled runs configured

---

**🚀 Ready for production!**
