# WinLab Social Publisher

Playwright + BullMQ scheduler per Instagram, Facebook, LinkedIn, TikTok, YouTube.

## Requisiti

- Node.js 18+
- **Redis** (per BullMQ queue)
  - Windows: scarica da https://github.com/microsoftarchive/redis/releases
  - Oppure Docker: `docker run -d -p 6379:6379 redis:alpine`

## Setup (una volta sola)

```bash
cd vhs/publisher
npm install
npx playwright install chromium
```

## Step 1 — Login (salva le sessioni)

Fai il login una volta per ogni piattaforma. Il browser si apre, fai login manualmente, poi premi ENTER:

```bash
node login.mjs --platform instagram
node login.mjs --platform facebook
node login.mjs --platform linkedin
node login.mjs --platform tiktok
node login.mjs --platform youtube    # apre URL OAuth, incolla il code
```

Le sessioni vengono salvate in `sessions/` — non perdere questi file.

## Step 2 — Avvia il worker

```bash
# Terminale 1 — lascia aperto
node workers/publisher.worker.mjs
```

## Step 3 — Schedula i post

### Launch week completa (17-20 aprile) — UN COMANDO:
```bash
node schedule.mjs --launch-week
```

### Post singolo subito (test):
```bash
node schedule.mjs --content connection_lost --platform instagram --now
node schedule.mjs --content hero_launch --now   # tutte le piattaforme
```

### Post schedulato a orario:
```bash
node schedule.mjs --content fail_fix --platform linkedin --at "2026-04-18T08:00:00+02:00"
```

## Controlla la coda
```bash
node status.mjs
```

## Contenuti disponibili

| Slug | Video | Piattaforme |
|------|-------|-------------|
| `connection_lost` | connection_lost.mp4 | IG, FB, LI, TT, YT |
| `hero_launch` | hero_launch.mp4 | IG, FB, LI, TT, YT |
| `fail_fix` | fail_fix.mp4 | IG, LI, TT |
| `career` | career.mp4 | IG, LI |
| `watching_vs_doing` | watching_vs_doing.mp4 | IG, TT |

Per aggiungere nuovi contenuti: modifica `config.mjs` → sezione `CONTENT`.

## Orari ottimali (Roma UTC+2)

| Piattaforma | Mattina | Sera |
|-------------|---------|------|
| Instagram | 12:30 | 19:00 |
| TikTok | 12:30 | 19:00 |
| LinkedIn | 08:00 | 12:00 |
| Facebook | 09:00 | 20:00 |
| YouTube | — | 18:00 |

## Anti-ban

- Delay randomico 1-8s prima di ogni azione
- Mouse movement simulato
- Session persistence (no login ripetuti)
- Retry automatico: 3 tentativi con backoff esponenziale (1min → 2min → 4min)
- Screenshot su errore in `screenshots/`
