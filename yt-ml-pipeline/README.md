# 🧠 YouTube ML Pipeline

**AI-powered video content generation and filtering system**

End-to-end pipeline that:
1. Downloads Linux troubleshooting videos from YouTube
2. Extracts features using CLIP (vision), OCR (text), and Whisper (speech)
3. Trains a ML model to predict video quality
4. Generates new video concepts
5. Auto-publishes high-quality content (score > threshold)

---

## 🚀 TWO MODES

### 🖥️ **Local Mode** (GPU Recommended)
- Full ML training on your machine
- PyTorch + CLIP + Whisper locally
- Complete control over models

### ☁️ **Serverless Mode** (No GPU Required)
- 100% cloud APIs for all ML tasks
- Replicate/DashScope for video generation
- HuggingFace Inference API for scoring
- AWS Lambda / Cloudflare Workers / Vercel
- **Production-ready, zero GPU needed**

---

## 📁 Project Structure

```
yt-ml-pipeline/
├── # === LOCAL MODE ===
├── node/
│   └── fetch.js              # YouTube video downloader
├── ml/
│   ├── clip_model.py         # CLIP vision embeddings
│   ├── ocr.py                # OCR text extraction
│   ├── speech.py             # Speech-to-text (Whisper)
│   ├── extract.py            # Dataset builder
│   ├── train.py              # Model training
│   ├── predict.py            # Model inference
│   └── model.pt              # Trained model (after training)
├── backend/
│   ├── engine.js             # Video generator + feature builder
│   ├── renderer.js           # FFmpeg video renderer (High-End)
│   ├── publisher.js          # Social media publisher
│   └── main.js               # Autopilot loop
│
├── # === SERVERLESS MODE ===
├── serverless/
│   ├── generator.js          # Replicate/DashScope integration
│   ├── scorer.js             # HuggingFace CLIP API
│   ├── storage.js            # Cloudflare R2 storage
│   ├── publisher.js          # Ayrshare multi-platform
│   ├── ffmpeg.js             # Serverless FFmpeg handler
│   └── orchestrator.js       # Main Lambda/Workers entry point
│
├── dataset/                  # Downloaded videos + frames
├── published/                # Published videos (auto-created)
├── output/                   # Temporary output (auto-created)
├── train.json                # ML dataset (after extraction)
├── package.json
├── requirements.txt
├── .env.example              # Serverless config template
├── vercel.json               # Vercel deployment
├── wrangler.toml             # Cloudflare Workers deployment
└── README.md
```

---

## 🚀 Quick Start

### ☁️ SERVERLESS MODE (Recommended for Production)

**1️⃣ Setup Environment**

```bash
npm install
cp .env.example .env
# Edit .env with your API keys
```

**2️⃣ Deploy to Cloudflare Workers**

```bash
npm install -g wrangler
wrangler login
wrangler deploy

# Set secrets
wrangler secret put REPLICATE_API_TOKEN
wrangler secret put HUGGINGFACE_API_TOKEN
wrangler secret put AYRSHARE_API_KEY
```

**3️⃣ Run Pipeline**

```bash
# Automatic (cron every 6 hours)
# Or manual trigger
curl https://yt-ml-pipeline.your-account.workers.dev

# Or locally
npm run serverless
```

**📖 Full deployment guide:** [DEPLOYMENT_SERVERLESS.md](DEPLOYMENT_SERVERLESS.md)

---

### 🖥️ LOCAL MODE (Development/Training)

**1️⃣ Setup**

**Node.js dependencies:**
```bash
npm install
```

**Python dependencies:**
```bash
pip install -r requirements.txt
```

**System dependencies:**
```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr ffmpeg

# macOS
brew install tesseract ffmpeg

# Windows (using Chocolatey)
choco install tesseract ffmpeg
```

### 2️⃣ Download Videos from YouTube

```bash
npm run fetch
# or
node node/fetch.js
```

Downloads 100 "linux troubleshooting" videos to `dataset/`

### 3️⃣ Extract Features & Build Dataset

```bash
npm run extract
# or
cd ml && python extract.py
```

Extracts:
- **CLIP embeddings** (512D → 128D)
- **OCR text** from frames
- **Speech transcription** (Whisper)

Output: `train.json`

### 4️⃣ Train ML Model

```bash
npm run train
# or
cd ml && python train.py
```

Trains a neural network to predict video quality scores.

Output: `ml/model.pt`

### 5️⃣ Run Autopilot (Generate + Filter + Publish)

```bash
npm run predict
# or
npm start
# or
node backend/main.js
```

**What it does:**
1. Generates 20 video concepts
2. Predicts quality score for each
3. Renders videos with score > 0.75
4. Publishes to `published/` folder

---

## ⚙️ Configuration

Edit `backend/main.js`:

```javascript
const CONFIG = {
  threshold: 0.75,        // Minimum score to publish (0-1)
  maxAttempts: 20,        # Max videos to generate per run
  outputDir: "./output",  # Temporary output directory
  publish: true           # Auto-publish approved videos
};
```

---

## ☁️ Cloudflare Workers Architecture (50€/mese)

### 💰 Budget Breakdown

| Servizio | Piano/Utilizzo | Costo |
|----------|----------------|-------|
| **Cloudflare Workers + Queues + R2** | Free Tier | **0€** |
| **Replicate / DashScope** | 100 clip/mese (~0.05-0.08$) | **~10€** |
| **ElevenLabs** | Starter (150k caratteri/mese, en-IN) | **~11€** |
| **Ayrshare** | Starter (multi-piattaforma) | **~29€** |
| **HF Inference API** | Free Tier | **0€** |
| **TOTALE** | | **~50€/mese** |

✅ **50€ di margine per picchi o upgrade**

### 🏗️ CF Workers Pipeline

```
POST /generate → Replicate (async + webhook)
                   ↓
            Queue → FFmpeg WASM (9:16 render)
                   ↓
            ElevenLabs TTS (voiceover)
                   ↓
            Quality Scoring (HF API)
                   ↓
            R2 Upload → Discord Approval
                   ↓
            Ayrshare → TikTok + IG + YouTube
```

### 📁 CF Workers Structure

```
cf-workers/
├── src/
│   ├── index.ts              # Worker + Queue + KV Approval
│   ├── ass-generator.ts      # Pop-in subtitle animations
│   ├── ffmpeg-render.ts      # WASM rendering + music
│   ├── tts-elevenlabs.ts     # ElevenLabs TTS (EN + HI-EN)
│   └── r2-ayrshare.ts        # R2 upload + broadcast
├── wrangler.toml             # CF config (KV, Queue, R2, Cron)
├── deploy.sh                 # Automated deploy
└── DEPLOY.md                 # Full guide
```

### 🎯 CF Workers Features

- ✅ **Async Processing**: Cloudflare Queues for long tasks
- ✅ **Approval Workflow**: KV namespace with Discord notifications
- ✅ **FFmpeg WASM**: 9:16 rendering in Workers (~15-30s)
- ✅ **ElevenLabs TTS**: English + Hinglish voiceovers
- ✅ **ASS Subtitles**: Pop-in word-by-word animations
- ✅ **Quality Scoring**: HuggingFace API (zero GPU)
- ✅ **R2 Storage**: S3-compatible, free tier
- ✅ **Ayrshare**: Multi-platform broadcast
- ✅ **Cron Triggers**: Auto-run every 6 hours

### ⚠️ CF Workers Limitations & Workarounds

| Limitazione | Workaround |
|-------------|------------|
| **FFmpeg WASM lento** (~15-30s per 10s) | OK per MVP. Scale: Render.com free tier o AWS Lambda |
| **Timeout 30s/15min** | Usa Queues + webhook. Mai rendering in fetch() |
| **Memoria 128MB** | FFmpeg WASM usa ~90MB. No payload grandi nello stesso step |
| **Ayrshare free limitato** | Inizia con broadcast manuale o API ufficiali (gratis, più complesso) |

**📖 Full CF Workers Guide:** [cf-workers/DEPLOY.md](cf-workers/DEPLOY.md)

---

## ☁️ Serverless Architecture (AWS/Vercel)

### AI Video Generation Providers

| Provider | Model | Cost | Async | Notes |
|----------|-------|------|-------|-------|
| **Replicate** | CogVideoX-5b, LTX-Video | ~$0.05-0.15/sec | ✅ Native | Pay-per-inference, webhook callback |
| **DashScope** | Wan 2.1 | ~$0.12/clip | ✅ Native | Excellent prompt following |
| **Fal.ai** | CogVideoX, LTX | Pay-per-sec | ✅ Webhook | Ultra-fast inference |

**Recommended:** Replicate for flexibility, DashScope for zero setup

### Quality Scoring (No PyTorch Required)

Instead of local PyTorch + CLIP:
- **HuggingFace Inference API** - Serverless CLIP scoring
- Extract 3 frames with FFmpeg
- Upload to R2 with temporary URLs
- Call CLIP API via HTTP
- **Zero GPU needed**

### Complete Serverless Flow

```
1. Generate Concept (Local)
    ↓
2. Replicate/DashScope (Async + Webhook)
    ↓
3. Download Video → /tmp
    ↓
4. Extract Frames (FFmpeg WASM/Static)
    ↓
5. HuggingFace CLIP API (HTTP)
    ↓
6. Score > 0.75?
    ↓ YES
7. Upload to Cloudflare R2
    ↓
8. Publish via Ayrshare
    ↓
9. Cleanup /tmp
```

### Serverless Optimizations

✅ **Codec**: libx264 main profile + AAC 192k  
✅ **Color Grading**: eq brightness/saturation/contrast  
✅ **Sharpening**: unsharp filter for text clarity  
✅ **Streaming**: faststart for instant playback  
✅ **Subtitles**: ASS burn-in for commands  
✅ **Storage**: Cloudflare R2 (S3-compatible)  
✅ **Publishing**: Ayrshare (TikTok, IG, YouTube, X, LinkedIn)  

---

## 🧠 ML Model Details (Local Mode)

**Input Features (130D):**
- CLIP embeddings: 128 dimensions
- Text length: 1 dimension
- Speech length: 1 dimension

**Architecture:**
```
Linear(130 → 128) → ReLU → Dropout(0.2)
Linear(128 → 64)  → ReLU → Dropout(0.2)
Linear(64 → 32)   → ReLU
Linear(32 → 1)    → Sigmoid
```

**Output:** Quality score between 0 and 1

---

## 🎬 Video Generation

The system generates video concepts with:
- **Hook:** Catchy title (e.g., "Fix this fast", "Disk full?")
- **Steps:** Linux commands to demonstrate
- **Duration:** 15-45 seconds
- **Pacing:** Fast or medium

Rendered as 9:16 vertical videos (1080x1920) for social media.

---

## 📲 Social Media Publishing

Currently saves to `published/` folder.

To enable real publishing, uncomment API calls in `backend/publisher.js` and add your tokens:
- **TikTok API**
- **LinkedIn API**
- **X (Twitter) API**

---

## 🔁 Complete Pipeline

```
YouTube Search (Node.js)
    ↓
Download Videos (ytdl-core)
    ↓
Extract Frames (FFmpeg)
    ↓
CLIP + OCR + Speech (Python)
    ↓
Build Dataset (train.json)
    ↓
Train Model (PyTorch)
    ↓
Generate New Videos (Node.js)
    ↓
Predict Quality (ML Model)
    ↓
Score > 0.75? ──→ YES → Render & Publish
    ↓
    NO → Skip
```

---

## 📊 Example Output

```
🤖 Starting AI Video Autopilot...
📊 Threshold: 0.75
🎬 Max attempts: 20

[Attempt 1/20]
──────────────────────────────────────────────────
💡 Concept: "Disk full?"
📝 Steps: 3 commands
⏱️  Duration: 23s
🧠 Predicting quality...
📊 AI Score: 0.82 (82%)
🔥 APPROVED (>0.75)
🎬 Rendering video...
✅ Video rendered: ./output/video_1234567890.mp4
📤 Publishing...
✅ Published successfully!

══════════════════════════════════════════════════
📈 RUN SUMMARY
══════════════════════════════════════════════════
✅ Published: 8
❌ Skipped:  12
📊 Success rate: 40%
══════════════════════════════════════════════════
```

---

## 🛠️ Troubleshooting

**CLIP not found:**
```bash
pip install git+https://github.com/openai/CLIP.git
```

**FFmpeg error:**
```bash
# Check installation
ffmpeg -version

# If not found, install:
sudo apt install ffmpeg  # Linux
brew install ffmpeg      # macOS
choco install ffmpeg     # Windows
```

**Tesseract error:**
```bash
sudo apt install tesseract-ocr  # Linux
brew install tesseract          # macOS
choco install tesseract         # Windows
```

**CUDA/GPU support:**
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

---

## 🎯 Next Steps

- [ ] Add real YouTube API integration for view/like data
- [ ] Improve video templates (backgrounds, animations)
- [ ] Add TikTok/LinkedIn/Twitter publishing
- [ ] Retrain model with real engagement metrics
- [ ] Dashboard for monitoring (React/Next.js)
- [ ] Schedule automatic runs (cron)

---

## 📝 License

MIT

---

## 🔥 Credits

Built with:
- **CLIP** (OpenAI)
- **Whisper** (OpenAI)
- **PyTorch**
- **FFmpeg**
- **Tesseract OCR**

---

**🚀 Happy automating!**
