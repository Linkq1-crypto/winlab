# WinLab Sync — Distributed Realtime System

Distributed sync architecture for WinLab with:

- **CRDT sync** via Yjs (conflict-free, merge-safe)
- **P2P transport** via WebRTC DataChannels (LAN sync, zero server load)
- **Edge persistence** via Cloudflare Workers + KV (global sync)
- **Offline-first AI router** with learning cache + semantic fallback

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     CLIENT                           │
│                                                      │
│  User Action → Yjs doc → IndexedDB (idb)            │
│                  ↓                                   │
│    ┌────────────────────────────┐                    │
│    │  WebRTC P2P (LAN peers)    │                    │
│    │  Edge Sync (Cloudflare)    │                    │
│    └────────────────────────────┘                    │
│                                                      │
│  AI Layer:                                           │
│  1. On-device (Xenova transformers) — offline       │
│  2. Learning Cache (feedback-scored)                │
│  3. Cloud AI (Anthropic Claude) — fallback          │
└─────────────────────────────────────────────────────┘
```

## Structure

| Directory | Purpose |
|---|---|
| `client/` | Vite app — Yjs + y-webrtc + idb + on-device AI |
| `worker/` | Cloudflare Worker — edge sync endpoint + KV |
| `signaling/` | Node WebSocket relay — WebRTC handshake only |

## Quick Start

```bash
# 1. Signaling server (WebRTC handshake)
cd signaling && npm install && node server.js

# 2. Edge sync (Cloudflare Worker)
cd ../worker && npx wrangler dev

# 3. Client app
cd ../client && npm install && npm run dev
```

## Build Profile Check

```bash
cd client
npm run build
```

Then inspect `client/dist/assets/index*.js` in DevTools:
- **Network**: Slow 3G (50kbps, 400ms RTT)
- **CPU**: 4x slowdown
- Target: First paint < 4s, Interactive < 8s

## Integration with Main Monolith

The sync system plugs into the existing WinLab backend:

```
Monolith (Express)          Distributed Sync
├── /api/helpdesk/*    ←→  /api/sync/push  (CRDT updates)
├── /api/helpdesk/*    ←→  /api/sync/pull  (delta sync)
├── /api/ai-cache/*    ←→  AI learning cache (feedback loop)
└── /api/deploy        ←→  Deploy correlation tracking
```

### What's Already Built (in main repo)

| Component | Location | Status |
|---|---|---|
| CRDT Engine | `src/services/crdtEngine.js` | ✅ Ready |
| AI Learning Cache | `src/services/aiLearningCache.js` | ✅ Ready |
| WebRTC Sync | `src/services/webRTCSync.js` | ✅ Ready |
| Offline Engine | `src/services/offlineEngine.js` | ✅ Ready |
| Retry Engine | `src/services/retryEngine.js` | ✅ Ready |
| Cache Engine | `src/services/cacheEngine.js` | ✅ Ready |
| React Hooks | `src/hooks/useCrdt.js` | ✅ Ready |
| Service Worker | `public/sw-offline.js` | ✅ Ready |
| CI Performance | `test/performance/ci-test.js` | ✅ Ready |

### What This Repo Adds

| Component | Purpose |
|---|---|
| `signaling/` | Minimal WebSocket relay (can use public y-webrtc signaling) |
| `worker/` | Cloudflare KV edge persistence (optional, for global scale) |
| `@xenova/transformers` | On-device AI for true offline capability |

## Production Deployment

### Cloudflare Worker

```bash
cd worker
wrangler kv:namespace create SYNC_KV
# Update wrangler.toml with real ID
wrangler deploy
```

### Signaling

Deploy to any Node host (Heroku, Fly.io, Render):

```bash
cd signaling
# Deploy server.js — only needs WebSocket support
```

### Client

```bash
cd client
npm run build
# Deploy dist/ to any static host (Cloudflare Pages, Vercel, Netlify)
```

## Scaling Path

| Stage | What Changes |
|---|---|
| **1 room, 1 device** | Local Yjs only, no sync needed |
| **1 room, multi-device** | WebRTC P2P sync (LAN) |
| **Multi-room, global** | Cloudflare KV edge sync |
| **High traffic** | Durable Objects (per-room state) |
| **Offline AI** | Xenova transformers on-device |

## License

Private — WinLab Internal
