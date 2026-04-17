# WinLab — Sessione 14 Aprile 2026

---

## 1. JWT SECRET aggiornato

**File:** `.env`
```
JWT_SECRET=a90b8005a32baa52fe4f8acfcea95d1fd6e91ad597de386792ecaceac513e5ae
```

---

## 2. Countdown Timer — LandingPage.jsx

Aggiunti due componenti:

### `CountdownBanner`
- Banner sticky in cima alla pagina (sopra la nav), sfondo blu
- Mostra `Xd : HH : MM : SS`
- Link "Lock $5 →" che scrolla a `#early-access`
- Sparisce automaticamente quando il timer scade

### `CountdownCard`
- Card arancione dentro la sezione `EarlyAccessSignup`
- Mostra i digit grandi con label in italiano ("ore", "min", "sec")
- Mostra "Early access period has ended." quando scaduto

### Come funziona
- Il deadline viene fetchato da `GET /api/pricing` → campo `launchExpiresAt`
- Il backend lo calcola da `LAUNCH_END_AT` in `.env` (2026-04-20T16:00:00.000Z)
- Nessuna data hardcodata nel frontend

### Backend aggiornato
`/api/pricing` ora restituisce `launchExpiresAt` in tutti e tre i branch (africa, india, world/EU).

---

## 3. Stripe Customer Portal — Dashboard

**File:** `src/SaaSOrchestrator.jsx`

- Aggiunto bottone **"Gestisci abbonamento"** nell'header della Dashboard
- Visibile solo per utenti `pro`, `business`, `earlyAccess`
- Chiama `POST /api/stripe/portal` con Bearer token
- Redirige al portale Stripe (`data.url`)

```js
async function handleManageBilling() {
  const res = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}
```

---

## 4. PWA Icons generate

**File:** `scripts/gen-icons.mjs`

Genera tutte le icone PWA necessarie da `public/manifest.json`:
- `icon-72.png` → `icon-512.png`
- `shortcut-terminal.png`, `shortcut-raid.png`

Colori: sfondo `#0a0a0b`, quadrato centrale `#2563eb`

**Esegui:**
```bash
node scripts/gen-icons.mjs
```

---

## 5. Social Publisher Engine

**Percorso:** `vhs/publisher/`

### Architettura
```
vhs/publisher/
├── config.mjs              ← account, captions, YouTube API keys
├── login.mjs               ← login manuale una volta sola
├── schedule.mjs            ← schedula post / launch week
├── status.mjs              ← stato della coda
├── queue/queue.mjs         ← BullMQ queue
├── workers/publisher.worker.mjs  ← worker principale
├── bots/
│   ├── facebook.bot.mjs    ← FB + IG insieme (Meta Business Suite)
│   ├── instagram.bot.mjs   ← IG standalone
│   ├── linkedin.bot.mjs    ← LinkedIn
│   ├── tiktok.bot.mjs      ← TikTok
│   └── youtube.bot.mjs     ← YouTube Data API v3
├── utils/
│   ├── humanize.mjs        ← delay randomici, anti-ban
│   └── logger.mjs          ← log colorati + file giornaliero
└── sessions/               ← cookie salvati dopo login
    ├── ig/, fb/, linkedin/, tiktok/
    └── yt_token.json
```

### Principi (dal PDF)
- `getByRole` invece di selettori CSS fragili
- URL diretto al composer: `business.facebook.com/latest/posts/composer`
- Toggle Instagram → **1 post = FB + IG**
- Popup handler: Chiudi / Close / Not now / Ora no
- Publish con retry loop x3
- Delay randomici 1–8s (anti-ban)
- Session persistence → no login ripetuti
- Screenshot su errore in `screenshots/`
- Retry automatico BullMQ: 3 tentativi, backoff esponenziale (1min → 2min → 4min)

### Setup (una volta sola)
```bash
# 1. Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# 2. Dipendenze
cd vhs/publisher
npm install
npx playwright install chromium

# 3. Login piattaforme (browser si apre, fai login, premi ENTER)
node login.mjs --platform facebook
node login.mjs --platform linkedin
node login.mjs --platform tiktok
node login.mjs --platform youtube
```

### Uso quotidiano
```bash
# Terminale 1 — lascia aperto
node workers/publisher.worker.mjs

# Terminale 2 — schedula
node schedule.mjs --launch-week        # schedula 17-20 aprile in automatico
node schedule.mjs --content hero_launch --now   # post immediato (test)
node schedule.mjs --content fail_fix --platform linkedin --at "2026-04-18T08:00:00+02:00"

# Controlla coda
node status.mjs
```

### Launch Week — Calendario automatico
| Data | Ora Roma | Piattaforma | Contenuto |
|------|----------|-------------|-----------|
| 17 apr | 08:00 | LinkedIn | hero_launch |
| 17 apr | 12:30 | FB + IG | hero_launch |
| 17 apr | 18:00 | YouTube | hero_launch |
| 17 apr | 19:00 | TikTok | hero_launch |
| 18 apr | 12:00 | LinkedIn | connection_lost |
| 18 apr | 12:30 | FB + IG | connection_lost |
| 18 apr | 19:00 | TikTok | connection_lost |
| 19 apr | 08:00 | LinkedIn | fail_fix |
| 19 apr | 12:30 | FB + IG | fail_fix |
| 19 apr | 19:00 | TikTok | fail_fix |
| 20 apr | 08:00 | LinkedIn | career |
| 20 apr | 12:30 | TikTok | watching_vs_doing |
| 20 apr | 19:00 | FB + IG | watching_vs_doing |

### Contenuti disponibili
| Slug | Video | Piattaforme |
|------|-------|-------------|
| `hero_launch` | hero_launch.mp4 | FB+IG, LI, TT, YT |
| `connection_lost` | connection_lost.mp4 | FB+IG, LI, TT, YT |
| `fail_fix` | fail_fix.mp4 | FB+IG, LI, TT |
| `career` | career.mp4 | FB+IG, LI |
| `watching_vs_doing` | watching_vs_doing.mp4 | FB+IG, TT |

Per aggiungere nuovi contenuti: modifica `vhs/publisher/config.mjs` → sezione `CONTENT`.

### Durata sessioni
| Piattaforma | Scadenza |
|-------------|----------|
| Facebook/IG | ~90 giorni |
| LinkedIn | ~1 anno |
| TikTok | ~30 giorni |
| YouTube | token refresh automatico |

---

## 6. Checklist Pre-Lancio

### CRITICO (blocca il lancio)
- [ ] Stripe price IDs reali in `.env` (ora sono placeholder)
  - `STRIPE_PRICE_PRO=price_...`
  - `STRIPE_PRICE_BUSINESS=price_...`
  - `STRIPE_PRICE_EARLY_ACCESS=price_...`
- [ ] `APP_URL=https://winlab.cloud` (ora è localhost)
- [ ] `npx prisma db push` sul server di produzione (per campo `isPromo`)
- [ ] `ANTHROPIC_API_KEY` reale

### DA FARE
- [ ] Razorpay KYC completato
- [ ] Paystack verifica account
- [ ] Deploy server (`bash scripts/deploy-server.sh`)
- [ ] Login social publisher (facebook, linkedin, tiktok, youtube)
- [ ] `node schedule.mjs --launch-week` il 17 aprile

### GIÀ FATTO
- [x] JWT_SECRET aggiornato
- [x] Countdown timer nella landing page
- [x] Stripe Customer Portal button nella dashboard
- [x] PWA icons generate (icon-72 → icon-512)
- [x] Email drip 48h inattività
- [x] Career paths nella dashboard (5 percorsi)
- [x] isPromo field in schema Prisma
- [x] Launch timer (LAUNCH_START_AT / LAUNCH_END_AT)
- [x] SPA fallback fix per /cert/:certId
- [x] Social publisher engine completo

---

## 7. File principali modificati in questa sessione

| File | Modifica |
|------|----------|
| `.env` | JWT_SECRET aggiornato |
| `src/LandingPage.jsx` | CountdownBanner + CountdownCard |
| `src/SaaSOrchestrator.jsx` | Bottone "Gestisci abbonamento" |
| `win_lab_full_backend_frontend_starter.js` | `launchExpiresAt` in /api/pricing |
| `scripts/gen-icons.mjs` | Nuovo — genera PWA icons |
| `public/icons/` | 10 file PNG generati |
| `vhs/publisher/` | Tutto il social publisher engine |
