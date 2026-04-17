# 📺 YouTube Analytics Integration Guide

**Complete sync pipeline** from YouTube/IG → Google Sheets → CF Worker → Dashboard → A/B Auto-Optimization

---

## 🔄 Data Flow

```
YouTube/IG → Google Apps Script → CF Worker → KV Storage
                                          ↓
                                    Dashboard (Chart.js)
                                          ↓
                                  Weekly A/B Auto-Update
```

---

## 🛠️ Setup (10 Minutes)

### Step 1: Enable Google APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create/select project
3. Enable:
   - **YouTube Data API v3**
   - **YouTube Analytics API**
4. OAuth consent screen → External → Add scopes:
   - `.../auth/youtube.readonly`
   - `.../auth/yt-analytics.readonly`

### Step 2: Create Google Sheet

**Structure (Row 1 = Headers):**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Job ID | Market | Variant | Platform | Video URL | Sync Status | Views | CTR % | Engagement % |
| a1b2c3d4-1 | us | A | youtube | https://youtu.be/xyz | Pending | | | |

### Step 3: Add Apps Script

1. **Extensions → Apps Script**
2. Paste code from `apps-script-code.js`
3. Update CONFIG:
   ```javascript
   const CONFIG = {
     WORKER_URL: "https://ai-shorts-worker.your-subdomain.workers.dev",
     DASHBOARD_API_KEY: "your-secret-key",
     DAYS_BACK: 7
   };
   ```
4. Replace `appsscript.json` with provided file

### Step 4: Enable Services in Apps Script

**Editor → Services → + Add:**
- YouTube Data API → v3
- YouTube Analytics API → v2

### Step 5: Create Trigger

**Attivatori → + Aggiungi:**
- Function: `syncYouTubeAnalytics`
- Source: Time-driven
- Frequency: Daily
- Time: 06:00-07:00

---

## 📊 CSV Template (Fallback)

If OAuth fails, use manual CSV export:

**File:** `template_analytics.csv`

```csv
Job ID,Market,Variant,Platform,Video URL,Views,CTR (%),Engagement Rate (%)
a1b2c3d4-1,us,A,youtube,https://youtu.be/xyz123,1500,8.4,12.5
b2c3d4e5-2,us,B,youtube,https://youtu.be/abc456,2300,6.2,9.8
c3d4e5f6-3,in,A,instagram,https://instagram.com/reel/xyz,3500,10.5,15.2
```

### Import CSV

```bash
# Via API
curl -X POST https://ai-shorts-worker.your-subdomain.workers.dev/api/import \
  -H "Authorization: Bearer <DASHBOARD_API_KEY>" \
  --data-binary @template_analytics.csv

# Via Node.js
export CF_API_TOKEN="your-token"
export CF_ACCOUNT_ID="your-account-id"
export KV_NAMESPACE_ID="your-namespace-id"
node import-analytics.js template_analytics.csv
```

### Convert YouTube/IG Exports

```bash
# Export CSV from YouTube Studio
node convert-export.js youtube-export.csv analytics-ready.csv

# Import
node import-analytics.js analytics-ready.csv
```

---

## 🧪 A/B Testing Auto-Optimization

### How It Works

1. **Composite Scoring:**
   ```
   Score = (CTR × 0.4) + (Engagement × 0.4) + (Normalized Views × 0.2)
   ```

2. **Minimum Sample Size:**
   - Requires ≥5 videos per variant
   - Below threshold: balanced 50/50 split
   - Prevents statistical noise

3. **Softmax Weighting:**
   ```
   Weight = exp(Score / Temperature) / Σ(exp(Score / Temperature))
   Temperature = 0.5 (lower = more aggressive)
   ```

4. **Weekly Update:**
   - Cron triggers Monday midnight
   - Calculates new weights
   - Stores in KV: `config:variant_weights`
   - **Max 1x/week** to prevent overfitting

### Example Weights

```json
{
  "us": { "A": 0.35, "B": 0.65 },
  "in": { "A": 0.55, "B": 0.45 },
  "af": { "A": 0.25, "B": 0.75 }
}
```

### Check A/B Stats

```bash
curl https://ai-shorts-worker.your-subdomain.workers.dev/api/ab-testing
```

**Response:**
```json
{
  "markets": [
    {
      "market": "us",
      "variants": [
        {
          "variant": "A",
          "videos": 15,
          "avgCTR": 6.2,
          "avgEngagement": 9.8,
          "compositeScore": 3.47,
          "weight": 0.35
        },
        {
          "variant": "B",
          "videos": 18,
          "avgCTR": 8.5,
          "avgEngagement": 12.3,
          "compositeScore": 4.95,
          "weight": 0.65
        }
      ]
    }
  ],
  "lastUpdate": 1713000000000
}
```

---

## 🎯 Testing & Validation

### Test A/B Routing

```bash
# Generate multiple videos, check variant distribution
for i in {1..10}; do
  curl -s -X POST https://ai-shorts-worker.your-subdomain.workers.dev/api/generate \
    -H "Content-Type: application/json" \
    -d '{"market":"us"}' | jq -r '.variant'
done

# Should show ~35% A, ~65% B (per weights above)
```

### Simulate Cron

```bash
wrangler trigger cron --cron "0 3 * * 1"
# Check logs for: 🔄 Routing A/B aggiornato
```

### Import Test Data

```bash
node import-analytics.js template_analytics.csv
# Check: wrangler tail
```

### View Dashboard

```
https://ai-shorts-worker.your-subdomain.workers.dev/dashboard
```

---

## ⚠️ Production Notes

### Data Stabilization
- **CTR/Engagement**: Takes 24-48h to stabilize
- **Don't run cron >1x/week**: Prevents overfitting
- **Minimum 5 videos**: Below this, routing stays 50/50

### Rate Limits
- **YouTube Analytics API**: 10k queries/day (free)
- **Daily sync**: Uses <5 queries
- **Apps Script**: Generous quotas, auto-renew OAuth

### Scaling
- **<500 videos/month**: KV storage (free) ✅
- **>500 videos/month**: Migrate to Cloudflare D1 (SQL)
- **Current setup**: Perfect for 300 videos/month across 3 markets

### Security
- `DASHBOARD_API_KEY` validates all POST endpoints
- Dashboard is public read-only (add auth if needed)
- Apps Script handles OAuth token auto-renewal

---

## 💰 Cost Impact

| Feature | Additional Cost | Notes |
|---------|----------------|-------|
| **Dashboard** | 0€ | Static HTML from Worker |
| **YouTube Sync** | 0€ | YouTube Analytics API free |
| **A/B Testing** | 0€ | KV storage, variant swapping |
| **Analytics** | 0€ | Lightweight KV |
| **Apps Script** | 0€ | Included with Google account |
| **Total** | **0€ extra** | Stays within 50€/mese |

---

## 🚀 Quick Deploy Checklist

| Step | Status |
|------|--------|
| Enable Google APIs | ☐ |
| Create Google Sheet | ☐ |
| Paste Apps Script code | ☐ |
| Enable YouTube services | ☐ |
| Set CONFIG in Apps Script | ☐ |
| Create daily trigger | ☐ |
| Test sync manually | ☐ |
| Import CSV template | ☐ |
| View dashboard | ☐ |
| Verify A/B routing | ☐ |

---

**🎬 Full YouTube/IG analytics pipeline operational. Zero extra cost. Auto-optimizing A/B tests.** 🚀
