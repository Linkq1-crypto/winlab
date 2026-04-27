# HomeShell — Backend Integration & Cleanup Design
**Date:** 2026-04-27  
**Branch:** mvp-docker-core

---

## 1. Obiettivo

Rimpiazzare il frontend multi-pagina (SaaSOrchestrator + ~30 pagine) con un'unica shell (`HomeShell.jsx`) collegata al backend Express/Prisma/Docker esistente. La base di esecuzione dei lab è Docker reale, non simulatori React browser-side.

---

## 2. Architettura

```
main.jsx
  └── HomeShell.jsx         ← nuova shell unica
        ├── TerminalLanding   (cosmetic, view="terminal")
        ├── Dashboard         (view="dashboard", guest OK)
        ├── LabTerminal       (view="lab", xterm.js + WebSocket)
        ├── RegisterModal     (step 3 del funnel)
        └── PaywallModal      (step 5, Stripe checkout)
```

### Stack intoccato
- `index.js` — backend Express/Prisma/JWT/Stripe (invariato)
- `backend/src/core/server.js` — server WebSocket + route /labs/start (invariato)
- `backend/src/websocket/terminal.js` — stream PTY → WS (invariato)
- `docker/lab-runner/Dockerfile` — immagine lab Ubuntu (invariata)
- `src/services/dockerLabRunner.js` — helper Docker start/stop/exec (invariato)

---

## 3. Flusso utente (5 step)

```
[Terminal Landing]
  → utente digita "login"
  → [Dashboard] — guest, nessuna auth richiesta

[Dashboard]
  → utente sceglie lab dalla griglia
  → clicca "AVVIA SESSIONE"

[Se guest] → [RegisterModal]
  → email + password → POST /api/auth/register
  → JWT salvato in httpOnly cookie

[Lab avviato]
  → POST /labs/start → { containerName }
  → WS ws://<host>/terminal?container=<containerName>
  → xterm.js montato inline nella dashboard (sostituisce la griglia)

[Completamento lab]
  → backend verifica via verify.sh nel container
  → POST /api/progress/complete { labId }
  → PaywallModal: "Sblocca tutti i lab" → Stripe checkout
```

---

## 4. API utilizzate da HomeShell

| Endpoint | Metodo | Auth | Scopo |
|---|---|---|---|
| `/api/auth/register` | POST | no | Registrazione guest |
| `/api/auth/login` | POST | no | Login utente esistente |
| `/api/auth/logout` | POST | cookie | Logout |
| `/api/auth/login` response | — | — | Dati utente (id, email, name, plan) ritornati al login |
| `/api/progress/:userId` | GET | JWT | Progresso lab |
| `/api/progress/update` | POST | JWT | Segna lab completato `{ labId, completed: true, score }` |
| `/labs/start` | POST | JWT | Avvio container Docker (backend porta 3000) |
| `ws://<host>:3000/terminal?container=X` | WS | — | Stream terminale PTY |
| `/api/billing/checkout` | POST | JWT | Stripe checkout (o `/api/stripe/subscribe`) |

---

## 5. Componenti di HomeShell.jsx

### 5.1 TerminalLanding
- Animazione log a intervallo (già esistente nel componente App)
- Input: "login" → imposta `view = "dashboard"`
- Nessuna chiamata API

### 5.2 Dashboard
- Griglia lab filtrata per categoria/ricerca (già esistente)
- Stato `authState`: `null` (guest) | `{ id, email, plan, name }`
- "AVVIA SESSIONE" → se guest: apre RegisterModal; se auth: avvia lab
- Header mostra nome utente e plan se autenticato

### 5.3 RegisterModal
- Form email + password
- `POST /api/auth/register` → cookie JWT automatico (httpOnly)
- Dopo successo: `authState` aggiornato, lab parte
- Link "Ho già un account" → modal login

### 5.4 LabTerminal
- Monta `xterm.js` + `xterm-addon-fit`
- `POST /labs/start` → riceve `containerName`
- WebSocket `ws://<host>/terminal?container=<containerName>`
- Bottone "Termina sessione" → `POST /labs/stop` + chiude WS + torna a dashboard
- Banner AI Mentor opzionale (già esistente in `AIMentor.jsx`)

### 5.5 PaywallModal
- Si apre dopo completamento lab (o clic su lab locked)
- `POST /api/billing/checkout` → redirect Stripe
- Design in linea con la shell esistente (rosso/nero)

---

## 6. File da eliminare

```
src/SaaSOrchestrator.jsx
src/LandingPage.jsx
src/NewLandingPage.jsx
src/WinLabHome.jsx
src/LaunchLanding.jsx
src/IndiaHinglishLanding.jsx
src/Dashboard.jsx
src/CommunityHub.jsx
src/AboutPage.jsx
src/OnboardingFlow.jsx
src/OnboardingPage.jsx
src/FirstMission.jsx
src/TelemetryDashboard.jsx
src/MyRootHub.jsx
src/HelpdeskDashboard.jsx
src/HelpdeskPage.jsx
src/EarlyAccessSuccess.jsx
src/DeceptionDashboard.jsx
src/ABTestOnboarding.jsx
src/ReferralSystem.jsx
src/SubscriptionManagement.jsx
src/ResetPasswordPage.jsx
src/FakeTerminal.jsx
src/pages/WinLabInteractiveHome.jsx
src/pages/MyIncidents.jsx
src/components/HeroTerminalExperience.jsx
src/components/EnterpriseLabsHub.jsx
src/components/EnterpriseArch.jsx
src/components/AutomationLab.jsx
src/components/CloudInfra.jsx
src/components/IntuneMDM.jsx
src/components/JamfPro.jsx
src/ABTestOnboarding.jsx
```

### File da tenere (non pagine)
```
src/AIMentor.jsx
src/CookieBanner.jsx
src/PricingTable.jsx       ← usato dal PaywallModal
src/AuthPage.jsx           ← riusato come fallback o inline
src/LabContext.jsx         ← progress tracking
src/analytics.js
src/index.css
src/main.jsx               ← modificato
src/trusted-types.js
src/api/*
src/services/*
src/core/*
src/hooks/*
```

---

## 7. main.jsx modificato

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import HomeShell from "./HomeShell";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HomeShell />
  </React.StrictMode>
);
```

LabContext rimane disponibile internamente a HomeShell per il progress tracking.

---

## 8. Dipendenze aggiuntive

- `xterm` + `xterm-addon-fit` — terminale browser per i lab Docker
- Già presente in package.json? Da verificare durante implementazione.

---

## 9. Criteri di successo

1. `npm run dev` mostra il terminale cosmetic, "login" porta alla dashboard
2. "AVVIA SESSIONE" su un lab starter lancia un container Docker reale
3. Il terminale xterm.js si connette via WebSocket al container
4. La modale register chiama correttamente `/api/auth/register`
5. Tutti i file della lista §6 eliminati senza errori di build
