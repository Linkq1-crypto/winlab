# 🧠 YT-ML Pipeline - Specifiche Tecniche Complete

**Sistema AI per generazione video short-form (9:16) con pipeline ML end-to-end, architettura mesh, funzionamento offline, e sessione persistente.**

---

## 📋 Indice

1. [Architettura Generale](#architettura-generale)
2. [Topologia Mesh](#topologia-mesh)
3. [Modalità Offline](#modalità-offline)
4. [Persistenza Sessioni](#persistenza-sessioni)
5. [Stack Tecnologico](#stack-tecnologico)
6. [Moduli Core](#moduli-core)
7. [Pipeline ML](#pipeline-ml)
8. [Cloudflare Workers](#cloudflare-workers)
9. [Database & Storage](#database--storage)
10. [API Reference](#api-reference)
11. [Deployment](#deployment)
12. [Sicurezza](#sicurezza)
13. [Budget & Costi](#budget--costi)
14. [Monitoring & Alerting](#monitoring--alerting)
15. [Disaster Recovery](#disaster-recovery)

---

## 🏗️ Architettura Generale

### Panoramica

Sistema ibrido **online/offline** per:
- ✅ Download video da YouTube
- ✅ Estrazione feature ML (CLIP + OCR + Whisper)
- ✅ Training modello qualità video
- ✅ Generazione video AI (Replicate/DashScope)
- ✅ Publishing multi-piattaforma (TikTok, IG, YouTube, X, LinkedIn)
- ✅ Analytics & A/B testing automatico
- ✅ Dashboard real-time con admin panel

### Struttura Directory

```
yt-ml-pipeline/
├── 📁 cf-workers/           # Cloudflare Workers (TypeScript)
│   ├── src/
│   │   ├── index.ts         # Orchestratore principale
│   │   ├── dashboard.ts     # Dashboard Chart.js
│   │   ├── admin-panel.ts   # Admin protetto
│   │   ├── analytics.ts     # Tracking + feedback
│   │   ├── ab-testing.ts    # Auto-ottimizzazione
│   │   ├── youtube-sync.ts  # Sync YouTube API
│   │   ├── kv-cache.ts      # Cache in-memory
│   │   ├── market-config.ts # Config mercati
│   │   ├── adaptive-render.ts # FFmpeg WASM
│   │   ├── ass-generator.ts # Sottotitoli pop-in
│   │   ├── vhs-library.ts   # Effetti VHS
│   │   ├── telegram-bot.ts  # Bot Telegram
│   │   ├── tts-elevenlabs.ts # TTS API
│   │   ├── ffmpeg-render.ts # FFmpeg base
│   │   └── r2-ayrshare.ts   # Storage + publish
│   ├── wrangler.toml
│   ├── package.json
│   ├── deploy.sh
│   ├── backup-kv.js
│   ├── import-analytics.js
│   ├── convert-export.js
│   └── apps-script-code.js
│
├── 📁 ml/                   # Machine Learning (Python)
│   ├── extract.py           # Dataset builder
│   ├── train.py             # Training PyTorch
│   ├── predict.py           # Inferenza
│   ├── clip_model.py        # CLIP embeddings
│   ├── ocr.py               # OCR Tesseract
│   └── speech.py            # Whisper STT
│
├── 📁 backend/              # Autopilot Locale (Node.js)
│   ├── main.js              # Loop principale
│   ├── engine.js            # Generatore concept
│   ├── renderer.js          # FFmpeg rendering
│   └── publisher.js         # Publishing
│
├── 📁 serverless/           # AWS/Vercel (Node.js)
│   ├── orchestrator.js      # Entry point
│   ├── generator.js         # Replicate/DashScope
│   ├── scorer.js            # HuggingFace API
│   ├── storage.js           # Cloudflare R2
│   └── publisher.js         # Ayrshare
│
├── 📁 node/                 # Utility
│   └── fetch.js             # YouTube downloader
│
├── 📁 dataset/              # Video + frames
├── 📁 published/            # Video pubblicati
├── package.json
├── requirements.txt
└── README.md
```

---

## 🌐 Topologia Mesh

### Architettura Ibrida Mesh

```
                    ┌─────────────────────┐
                    │   🌐 INTERNET       │
                    │   API Esterne       │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  🤖 Replicate │ │ 🎙️ Eleven  │ │ 📺 YouTube  │
    │  Video API    │ │  Labs TTS   │ │  Analytics  │
    └─────────┬─────┘ └──────┬──────┘ └──────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  ☁️ CF WORKERS    │
                    │  (Orchestratore)  │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  💾 R2 Storage│ │ 📊 KV Cache │ │ 🗄️ D1 (SQL) │
    │  (Video/Assets)│ │ (Config)    │ │ (Analytics) │
    └─────────┬─────┘ └──────┬──────┘ └──────┬──────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  📱 Telegram  │ │ 💬 Discord  │ │ 🔵 Slack    │
    │  (Approval)   │ │ (Alerts)    │ │ (Alerts)    │
    └───────────────┘ └─────────────┘ └─────────────┘

    ┌─────────────────────────────────────────────┐
    │           🖥️ MODULO OFFLINE                 │
    │  ┌───────────┐  ┌──────────┐  ┌──────────┐ │
    │  │ ML Local  │  │ FFmpeg   │  │ SQLite   │ │
    │  │ (PyTorch) │  │ Renderer │  │ Sessions │ │
    │  └───────────┘  └──────────┘  └──────────┘ │
    └─────────────────────────────────────────────┘
```

### Nodi della Mesh

| Nodo | Tipo | Online/Offline | Responsabilità |
|------|------|----------------|----------------|
| **CF Workers** | Edge | Online | Orchestratore, API routing |
| **ML Local** | GPU/CPU | Offline | Training, inferenza |
| **Backend Node** | Locale | Offline | Autopilot, generazione |
| **R2 Storage** | Cloud | Online | Video, assets, backup |
| **KV Cache** | Edge | Online | Config, sessioni |
| **D1 Database** | Edge | Online | Analytics aggregati |
| **Telegram Bot** | External | Online | Approval workflow |
| **Discord/Slack** | External | Online | Alerting |

### Comunicazione Mesh

```
CF Workers ↔ ML Local     → REST API (quando online)
CF Workers ↔ Backend Node → Webhook / Polling
R2 ↔ CF Workers           → S3-compatible API
KV ↔ CF Workers           → Native KV API
Offline Mode              → SQLite + File System locale
```

---

## 🔌 Modalità Offline

### Architettura Offline-First

Il sistema funziona **completamente offline** per:
- ✅ Training ML locale (PyTorch)
- ✅ Generazione video con FFmpeg
- ✅ Inferenza modello qualità
- ✅ Gestione sessioni utente
- ✅ Coda processing locale

### Componenti Offline

```typescript
// Configurazione modalità offline
interface OfflineConfig {
  mode: "online" | "offline" | "hybrid";
  localDB: "sqlite" | "json";
  sessionTTL: number;           // ore
  syncOnReconnect: boolean;     // auto-sync quando torna online
  queueOffline: boolean;        // accumula operazioni offline
}
```

### Funzionamento Offline

**1. Download Video (Locale)**
```bash
# Funziona offline se hai già i video
node node/fetch.js  # Scarica quando online
# I video restano in dataset/ per uso offline
```

**2. ML Training (Locale)**
```bash
# Completamente offline
cd ml
python extract.py    # Estrae feature da video locali
python train.py      # Addestra modello locale
python predict.py    # Inferenza locale
```

**3. Generazione Video (Locale)**
```bash
# Funziona offline con FFmpeg locale
node backend/main.js  # Genera video senza internet
```

**4. Sessioni Offline**
```
Sessioni salvate in:
- SQLite (offline mode)
- JSON files (fallback)
- LocalStorage (dashboard browser)
```

### Sync Automatico

Quando il sistema torna online:
1. **Coda operazioni offline** → Invia a CF Workers
2. **Analytics locali** → Sync a D1/KV
3. **Video generati** → Upload a R2
4. **Sessioni** → Merge con stato cloud

---

## 💾 Persistenza Sessioni

### Architettura Sessioni

```
┌─────────────────────────────────────────┐
│           GESTIONE SESSIONI             │
├─────────────────────────────────────────┤
│                                         │
│  Browser (LocalStorage)                 │
│  ├── adminAuth (sessione admin)         │
│  ├── dashboardState (grafici, filtri)   │
│  └── lastSync (timestamp ultimo sync)   │
│                                         │
│  CF Workers (KV)                        │
│  ├── session:{id} → dati sessione       │
│  ├── approval:{jobId} → approvazioni    │
│  └── job:{id} → stato job               │
│                                         │
│  Offline (SQLite)                       │
│  ├── sessions table                     │
│  ├── jobs table                         │
│  └── queue table (operazioni pendenti)  │
│                                         │
└─────────────────────────────────────────┘
```

### Session Storage

| Livello | Storage | TTL | Uso |
|---------|---------|-----|-----|
| **Browser** | LocalStorage | 7 giorni | UI state, auth |
| **Workers** | KV Namespace | 30 giorni | Job state, approvals |
| **Offline** | SQLite | Persistente | Coda, sessions |
| **Backup** | JSON files | Permanente | Disaster recovery |

### Session Recovery

Quando un utente o il sistema si riconnette:
```
1. Leggi sessione da LocalStorage/SQLite
2. Confronta con stato KV cloud
3. Merge delle modifiche offline
4. Riprendi job interrotti
5. Aggiorna UI
```

---

## 🛠️ Stack Tecnologico

### Core Stack

| Componente | Tecnologia | Versione | Uso |
|------------|-----------|----------|-----|
| **CF Workers** | TypeScript | 5.x | Orchestratore edge |
| **Node.js** | JavaScript | 18+ | Backend locale |
| **Python** | PyTorch | 2.x + 3.10 | ML training |
| **FFmpeg** | WASM/Native | 6.x | Rendering video |
| **Chart.js** | JavaScript | 4.x | Dashboard |

### AI/ML Services

| Service | API | Costo | Uso |
|---------|-----|-------|-----|
| **Replicate** | REST | $0.05-0.15/clip | Generazione video |
| **ElevenLabs** | REST | $11/mese | Text-to-Speech |
| **HuggingFace** | REST | Free | Quality scoring |
| **OpenAI CLIP** | Local | Free | Vision embeddings |
| **OpenAI Whisper** | Local | Free | Speech-to-text |

### Storage & Database

| Service | Tipo | Costo | Uso |
|---------|------|-------|-----|
| **Cloudflare R2** | Object Storage | Free (10GB) | Video, assets |
| **Cloudflare KV** | Key-Value | Free (100K read/mo) | Config, sessioni |
| **Cloudflare D1** | SQL SQLite | Free (5GB) | Analytics |
| **SQLite** | Local DB | Free | Offline mode |

### External Integrations

| Service | Protocol | Uso |
|---------|----------|-----|
| **Telegram Bot** | HTTPS Webhook | Approval workflow |
| **Discord** | Webhook | Alerting |
| **Slack** | Webhook | Alerting |
| **Ayrshare** | REST API | Social publishing |
| **YouTube API** | OAuth + REST | Analytics sync |

---

## 🧩 Moduli Core

### 1. Orchestratore (cf-workers/src/index.ts)

**Endpoint:**
- `GET /dashboard` → Dashboard UI
- `POST /api/generate` → Genera video
- `POST /api/youtube-sync` → Sync analytics
- `POST /api/admin/*` → Admin panel
- `POST /telegram/*` → Telegram webhook

**Cache Layer:**
- A/B weights: 5 min TTL
- Budget counts: 2 min TTL
- Rate limits: 30 sec TTL

### 2. ML Pipeline (ml/)

**Feature Extraction:**
```python
Features = [
    CLIP embeddings (128D),
    OCR text length (1D),
    Speech text length (1D),
    Total: 130D
]
```

**Model Architecture:**
```
Input (130) → Linear(128) → ReLU → Dropout(0.2)
            → Linear(64)  → ReLU → Dropout(0.2)
            → Linear(32)  → ReLU
            → Linear(1)   → Sigmoid
Output: Quality score (0-1)
```

### 3. FFmpeg Rendering

**Online (WASM):**
```
Video + Subtitles + TTS + BGM + VHS
  → FFmpeg WASM (Cloudflare Workers)
  → 9:16 MP4 (libx264, AAC)
```

**Offline (Native):**
```
Video + Subtitles + Audio
  → FFmpeg Native (backend/)
  → 9:16 MP4 (CRF 23, 4000k)
```

### 4. Admin Panel

**Features:**
- Password protected (Basic Auth + sessionStorage)
- Alert history (7-day retention)
- Manual sync triggers (rate-limited: 3/h/market)
- CSV export (BOM Excel-compatible)

---

## 🤖 Pipeline ML

### Fasi della Pipeline

```
1. Download Video (YouTube)
    ↓
2. Estrazione Frames (FFmpeg, 1fps)
    ↓
3. CLIP Embeddings (PyTorch, ViT-B/32)
    ↓
4. OCR Text (Tesseract)
    ↓
5. Speech-to-Text (Whisper, base)
    ↓
6. Dataset Building (JSON)
    ↓
7. Model Training (PyTorch, 500 epochs)
    ↓
8. Inference (Quality score 0-1)
    ↓
9. A/B Testing (Auto-optimization)
```

### Dataset Schema

```json
{
  "id": "video_youtube_id",
  "x": [
    // CLIP embeddings (128 valori)
    0.123, 0.456, ...,
    // Text features (2 valori)
    45,  // OCR text length
    123  // Speech text length
  ],
  "y": 0.75  // Proxy quality score
}
```

### A/B Testing Auto-Optimization

**Composite Scoring:**
```
Score = (CTR × 0.4) + (Engagement × 0.4) + (Views/100 × 0.2)
```

**Softmax Weighting:**
```
Weight_i = exp(Score_i / 0.5) / Σ(exp(Score_j / 0.5))
```

**Update Frequency:** Weekly (Monday midnight)

---

## ☁️ Cloudflare Workers

### Configurazione

```toml
name = "ai-shorts-worker"
main = "src/index.ts"
compatibility_date = "2026-04-01"
node_compat = true

# Bindings
[[kv_namespaces]]
binding = "KV_APPROVALS"
id = "xxx"

[[queues.consumers]]
queue = "render-queue"
max_batch_size = 1

[[r2_buckets]]
binding = "AI_SHORTS_MEDIA"
bucket_name = "ai-shorts-media"

[triggers]
crons = ["0 */6 * * *", "0 0 * * 1"]
```

### Memory Management

| Componente | RAM | Note |
|------------|-----|------|
| Worker base | ~20MB | TypeScript runtime |
| FFmpeg WASM | ~90MB | Core + WASM modules |
| Cache in-memory | ~10MB | KV cache layer |
| **Totale** | **~120MB** | Workers Paid (128MB+) recommended |

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/admin/sync` | 3 req | 1 hour/market |
| `/api/generate` | 100/mo | Budget limit |
| KV reads | 100K | Free tier/month |

---

## 🗄️ Database & Storage

### KV Schema

```
Keys:
├── job:{id}                 → Render job state
├── approval:{id}            → Pending approval
├── published:{id}           → Published video data
├── budget:{market}:{YYYY-MM} → Monthly video count
├── analytics:{jobId}        → Single analytics event
├── alert:{type}:{market}:{timestamp} → Alert record
├── config:variant_weights   → A/B routing weights
├── config:last_routing_update → Last A/B update timestamp
└── ratelimit:sync:{market}  → Sync attempt timestamps
```

### R2 Structure

```
ai-shorts-media/
├── videos/
│   ├── us/
│   │   └── {jobId}.mp4
│   ├── in/
│   │   └── {jobId}.mp4
│   └── af/
│       └── {jobId}.mp4
├── tts/
│   └── {jobId}.mp3
├── music/
│   ├── lofi/
│   ├── bollywood/
│   └── afrobeats/
└── vhs/
    ├── vhs_scanlines.png
    ├── vhs_colorful.png
    └── vhs_warm.png
```

### SQLite (Offline Mode)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  market TEXT,
  variant TEXT,
  status TEXT,
  data TEXT,
  created_at DATETIME
);

CREATE TABLE queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT,
  payload TEXT,
  status TEXT,
  created_at DATETIME
);
```

---

## 🔌 API Reference

### Public Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/dashboard` | GET | None | Dashboard UI |
| `/health` | GET | None | Health check |
| `/api/stats` | GET | None | Market statistics |
| `/api/pending` | GET | None | Pending approvals |
| `/api/ab-testing` | GET | None | A/B test results |
| `/api/analytics` | GET | None | Analytics summary |

### Protected Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/generate` | POST | None | Generate new video |
| `/api/youtube-sync` | POST | Bearer | YouTube analytics sync |
| `/api/analytics` | POST | Bearer | Track CTR/engagement |
| `/api/import` | POST | Bearer | Bulk CSV import |
| `/api/approve` | POST | None | Approve/reject video |
| `/api/admin/login` | POST | None | Admin authentication |
| `/api/admin/alerts` | GET | Basic | Alert history |
| `/api/admin/sync` | POST | Basic | Manual market sync |

### Telegram Webhook

```
POST /telegram/{BOT_TOKEN}
Body: Telegram Update object
```

---

## 🚀 Deployment

### CF Workers Deploy

```bash
cd cf-workers

# 1. Install
npm install

# 2. Login
wrangler login

# 3. Create resources
wrangler r2 bucket create ai-shorts-media
wrangler kv:namespace create KV_APPROVALS
wrangler queues create render-queue

# 4. Set secrets
wrangler secret put REPLICATE_API_KEY
wrangler secret put ELEVEN_API_KEY
wrangler secret put AYRSHARE_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put HF_API_KEY
wrangler secret put DASHBOARD_API_KEY
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
wrangler secret put DISCORD_WEBHOOK_URL  # optional
wrangler secret put SLACK_WEBHOOK_URL   # optional

# 5. Deploy
wrangler deploy

# 6. Set Telegram webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://ai-shorts-worker.your-subdomain.workers.dev/telegram/<TOKEN>"
```

### Offline Mode Setup

```bash
# 1. Install dependencies
npm install
pip install -r requirements.txt

# 2. Install system deps
sudo apt install ffmpeg tesseract-ocr

# 3. Download videos (online first)
node node/fetch.js

# 4. Extract features (offline)
cd ml && python extract.py

# 5. Train model (offline)
python train.py

# 6. Run autopilot (offline)
node backend/main.js
```

---

## 🔒 Sicurezza

### Authentication

| Componente | Metodo | Notes |
|------------|--------|-------|
| **Admin Panel** | Basic Auth + sessionStorage | HTTPS only |
| **API Endpoints** | Bearer token | `DASHBOARD_API_KEY` |
| **Telegram** | Bot token in URL path | Standard practice |
| **Apps Script** | OAuth 2.0 | Auto-renew tokens |

### Rate Limiting

- Admin sync: 3/hour/market (timestamp array in KV)
- Video generation: 100/month/market (budget limit)
- KV reads: Cached 60-70% (in-memory layer)

### Data Retention

| Data Type | Retention | Auto-cleanup |
|-----------|-----------|--------------|
| Approvals | 7 days | KV TTL |
| Alerts | 7 days | KV TTL |
| Analytics | 90 days | KV TTL |
| Published | 30 days | KV TTL |
| Budget | 30 days | KV TTL |
| Videos (R2) | Permanent | Manual delete |

### KV Cache Security

- Cache isolato per isolate
- TTL-based expiration
- Auto-prune every 2 minutes
- No sensitive data cached (passwords, tokens)

---

## 💰 Budget & Costi

### Monthly Budget (300 video)

| Service | USA (100) | India (100) | Africa (100) | Total |
|---------|-----------|-------------|--------------|-------|
| Cloudflare Workers | 0€ | 0€ | 0€ | 0€ |
| Replicate | 6€ | 5€ | 5€ | 16€ |
| ElevenLabs | 3€ | 2€ | 2€ | 7€ |
| Ayrshare | 4€ | 2€ | 0€ | 6€ |
| **Total** | **13€** | **9€** | **7€** | **29€** |

**Margine:** 21€ (budget max: 50€)

### Workers Paid Upgrade

| Feature | Free | Paid ($5/mo) |
|---------|------|--------------|
| KV reads | 100K/mo | 10M/mo |
| Memory | 128MB | 128MB+ |
| CPU | Low | Priority |
| Timeout | 30s | 15min |

**Upgrade when:** >800 video/mese o FFmpeg WASM >128MB

---

## 📊 Monitoring & Alerting

### Alert Types

| Type | Threshold | Channels | Cooldown |
|------|-----------|----------|----------|
| **CTR Critical** | <1.5% | Telegram + Discord + Slack | 1/day/market |
| **CTR Low** | <3% | Telegram + Discord + Slack | 1/day/market |
| **Sync Failed** | Any error | Telegram | 1/day |
| **Rate Limited** | 3 sync/h | Admin panel | N/A |
| **Budget Exceeded** | >100 video/mo | Telegram | N/A |

### Dashboard Metrics

- Total videos (per market)
- Monthly cost (per market)
- Average CTR
- Average engagement
- A/B testing results
- Alert history

### External Monitoring

```bash
# Cloudflare Analytics
wrangler metrics

# Real-time logs
wrangler tail --format pretty

# KV backup (weekly)
node backup-kv.js
```

---

## 🛡️ Disaster Recovery

### KV Backup

```bash
# Manual backup
export CF_API_TOKEN="token"
export CF_ACCOUNT_ID="account"
export KV_NAMESPACE_ID="namespace"
node backup-kv.js

# Output: ./kv-backup-YYYY-MM-DD/
# ├── approval.json
# ├── published.json
# ├── budget.json
# ├── analytics.json
# └── manifest.json
```

### Automated Backup (GitHub Actions)

```yaml
name: KV Backup
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Backup KV
        run: node cf-workers/backup-kv.js
        env:
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
          KV_NAMESPACE_ID: ${{ secrets.KV_NAMESPACE_ID }}
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: kv-backup
          path: kv-backup-*/
```

### Recovery Procedure

1. Restore KV from backup JSON:
```bash
# Script di restore (da implementare)
node restore-kv.js ./kv-backup-2026-04-13/
```

2. Re-deploy Workers:
```bash
wrangler deploy
```

3. Verify webhooks:
```bash
# Telegram
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Apps Script
# Run syncYouTubeAnalytics() manually
```

---

## 📈 Scaling Roadmap

### Current (0-300 video/mese)

- CF Workers (Free tier)
- KV Storage
- In-memory cache
- FFmpeg WASM

### Growth (300-800 video/mese)

- Workers Paid ($5/mo)
- D1 Database (analytics)
- Increased API limits

### Scale (800+ video/mese)

- D1 per tutte le analytics
- Lambda separato per rendering
- Queue multipli per mercato
- CDN per assets

---

## 🎯 Checklist Deploy

| Step | Comando | Status |
|------|---------|--------|
| 1. Install deps | `npm install` | ☐ |
| 2. CF Login | `wrangler login` | ☐ |
| 3. Crea R2 | `wrangler r2 bucket create ai-shorts-media` | ☐ |
| 4. Crea KV | `wrangler kv:namespace create KV_APPROVALS` | ☐ |
| 5. Crea Queue | `wrangler queues create render-queue` | ☐ |
| 6. Set secrets | Tutti i 12 secret | ☐ |
| 7. Upload assets | VHS + Music a R2 | ☐ |
| 8. Deploy | `wrangler deploy` | ☐ |
| 9. Telegram webhook | `curl /setWebhook` | ☐ |
| 10. Test generate | `curl /api/generate` | ☐ |
| 11. Test dashboard | Apri `/dashboard` | ☐ |
| 12. Test admin | Login con ADMIN_USER/PASS | ☐ |

---

**🎬 Sistema completo, offline-ready, con sessione persistente e architettura mesh. Deploy-ready.** 🚀
