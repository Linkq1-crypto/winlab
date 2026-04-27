# HomeShell — Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-page SaaSOrchestrator with a single `HomeShell.jsx` shell that runs real Docker-based labs via WebSocket, backed by the existing Express/Prisma backend.

**Architecture:** `HomeShell.jsx` owns all UI state (terminal landing → dashboard → lab). The existing `index.js` backend (port 3001) receives two new endpoints: `POST /api/lab/start` (spins up a Docker container via `dockerLabRunner.js`) and a WebSocket handler at `/ws/lab` (pipes `docker exec` I/O to xterm.js). Auth and Stripe remain untouched.

**Tech Stack:** React 18, xterm.js, @xterm/addon-fit, Express, ws, child_process (docker exec), Tailwind CSS, Lucide React

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| MODIFY | `vite.config.js` | Proxy `/api` to port 3001; add WS proxy for `/ws/lab` |
| MODIFY | `index.js` | Add `POST /api/lab/start` + WS `/ws/lab` handler |
| CREATE | `src/components/LabTerminal.jsx` | xterm.js + WebSocket to Docker container |
| CREATE | `src/components/RegisterModal.jsx` | Register/login form calling `/api/auth/register` |
| CREATE | `src/HomeShell.jsx` | Terminal landing + dashboard + lab orchestration |
| MODIFY | `src/main.jsx` | Render `<HomeShell />` directly |
| DELETE | ~30 files | All old pages (listed in Task 9) |

---

## Task 1: Fix Vite proxy (port 3000 → 3001)

**Files:**
- Modify: `vite.config.js`

The main backend runs on port 3001 (`BASE_PORT = 3001` in `index.js`). The current proxy points to 3000. Fix it and add a WS proxy entry.

- [ ] **Step 1: Update vite.config.js**

Replace the `server` block:

```js
server: {
  proxy: {
    "/api": {
      target: process.env.VITE_API_PROXY_TARGET || "http://localhost:3001",
      changeOrigin: true,
    },
    "/ws/lab": {
      target: process.env.VITE_WS_PROXY_TARGET || "ws://localhost:3001",
      ws: true,
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 2: Verify backend starts and proxy works**

```bash
node index.js &
curl http://localhost:3001/api/pricing
```

Expected: JSON response with pricing data (not a 404 or ECONNREFUSED).

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "fix(dev): proxy /api to port 3001, add /ws/lab WS proxy"
```

---

## Task 2: Install xterm.js

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install xterm @xterm/addon-fit
```

- [ ] **Step 2: Verify**

```bash
node -e "import('xterm').then(m => console.log('xterm ok:', Object.keys(m)))"
```

Expected: `xterm ok: [ 'Terminal', ... ]`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xterm and @xterm/addon-fit"
```

---

## Task 3: Add POST /api/lab/start to index.js

**Files:**
- Modify: `index.js` (add after the existing `/api/progress` routes, around line 580)

This endpoint spins up a Docker container using the existing `dockerLabRunner.js` service and returns the container name. Guest users (no JWT) can start "starter" tier labs.

**Starter lab IDs** (no auth required):
`linux-terminal`, `enhanced-terminal`, `disk-full`, `nginx-port-conflict`

- [ ] **Step 1: Add import at top of index.js** (around line 45, after existing imports)

```js
import { startDockerLabSession, stopDockerLabSession } from "./src/services/dockerLabRunner.js";
```

- [ ] **Step 2: Add the route** (add after line 578, after the `/api/progress/:userId` route)

```js
// ─────────────────────────────────────────────
// LAB SESSION — Docker container lifecycle
// ─────────────────────────────────────────────

const STARTER_LABS = new Set([
  "linux-terminal", "enhanced-terminal", "disk-full", "nginx-port-conflict"
]);

// Map sessionId → containerName (in-process cache, sufficient for MVP)
export const activeSessions = new Map();

app.post("/api/lab/start", async (req, res) => {
  const { labId } = req.body;
  if (!labId || typeof labId !== "string") {
    return res.status(400).json({ error: "labId required" });
  }

  // Auth check: non-starter labs require JWT
  const isStarter = STARTER_LABS.has(labId);
  if (!isStarter) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Login required for this lab" });
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  const sessionId = crypto.randomUUID();
  try {
    const session = await startDockerLabSession({ labId, sessionId });
    activeSessions.set(sessionId, session.containerName);
    // Auto-cleanup after 30 min
    setTimeout(async () => {
      activeSessions.delete(sessionId);
      await stopDockerLabSession({ sessionId }).catch(() => {});
    }, 30 * 60 * 1000);
    res.json({ sessionId, containerName: session.containerName, labId });
  } catch (err) {
    console.error("Lab start error:", err);
    res.status(500).json({ error: "Failed to start lab container" });
  }
});

app.post("/api/lab/stop", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  activeSessions.delete(sessionId);
  await stopDockerLabSession({ sessionId }).catch(() => {});
  res.json({ ok: true });
});
```

- [ ] **Step 3: Test the route**

```bash
curl -X POST http://localhost:3001/api/lab/start \
  -H "Content-Type: application/json" \
  -d '{"labId":"disk-full"}'
```

Expected:
```json
{"sessionId":"<uuid>","containerName":"winlab-lab-<uuid>","labId":"disk-full"}
```

Also verify container is running:
```bash
docker ps | grep winlab-lab
```

Expected: one running container.

- [ ] **Step 4: Commit**

```bash
git add index.js
git commit -m "feat(backend): add POST /api/lab/start and /api/lab/stop endpoints"
```

---

## Task 4: Add WebSocket /ws/lab handler to index.js

**Files:**
- Modify: `index.js` (around the WS upgrade handler at line 4699)

The handler reads `?container=<containerName>` from the URL, spawns `docker exec -it <container> bash`, and pipes stdin/stdout between the WS and the Docker PTY.

- [ ] **Step 1: Modify the upgrade handler** (replace lines 4699–4705)

```js
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/ws/leaderboard")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else if (req.url.startsWith("/ws/lab")) {
    labWss.handleUpgrade(req, socket, head, (ws) => labWss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});
```

- [ ] **Step 2: Add the labWss server and connection handler** (add right after `const wss = new WebSocketServer({ noServer: true });` at line 4697)

```js
// ── Lab terminal WebSocket (Docker exec) ─────────────────────────────────────
import { spawn } from "child_process";

const labWss = new WebSocketServer({ noServer: true });

labWss.on("connection", (ws, req) => {
  const params = new URL(req.url, "http://x").searchParams;
  const containerName = params.get("container");

  if (!containerName || !/^[a-z0-9-]+$/.test(containerName)) {
    ws.send(JSON.stringify({ type: "error", data: "Invalid container name" }));
    ws.close();
    return;
  }

  const shell = spawn("docker", ["exec", "-i", containerName, "bash"], {
    env: { ...process.env, TERM: "xterm-256color" },
  });

  ws.send(JSON.stringify({ type: "ready" }));

  shell.stdout.on("data", (chunk) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "output", data: chunk.toString("utf8") }));
    }
  });

  shell.stderr.on("data", (chunk) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "output", data: chunk.toString("utf8") }));
    }
  });

  shell.on("close", (code) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "exit", code: code ?? 0 }));
      ws.close();
    }
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "input" && shell.stdin.writable) {
        shell.stdin.write(msg.data);
      }
    } catch {}
  });

  ws.on("close", () => shell.kill());
});
```

- [ ] **Step 3: Remove the old `import { spawn }` if it already exists at the top of index.js to avoid duplicate imports**

Run:
```bash
grep -n "^import { spawn }" index.js
```

If a duplicate exists, remove the new one and keep the existing import.

- [ ] **Step 4: Test WebSocket manually**

```bash
# Start backend
node index.js &

# Start a container (use the containerName from Task 3 test)
CONTAINER=$(curl -s -X POST http://localhost:3001/api/lab/start \
  -H "Content-Type: application/json" \
  -d '{"labId":"disk-full"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).containerName))")

echo "Container: $CONTAINER"

# Verify container is running
docker ps | grep "$CONTAINER"
```

Expected: container visible in `docker ps`.

- [ ] **Step 5: Commit**

```bash
git add index.js
git commit -m "feat(backend): add /ws/lab WebSocket handler for Docker exec terminal"
```

---

## Task 5: Create src/components/LabTerminal.jsx

**Files:**
- Create: `src/components/LabTerminal.jsx`

This component mounts an xterm.js terminal and connects it to the `/ws/lab` WebSocket. It accepts:
- `containerName` (string) — the Docker container to exec into
- `onClose` (function) — called when user clicks "Termina sessione"
- `onComplete` (function) — called when the shell exits (lab finished)

- [ ] **Step 1: Create the file**

```jsx
// src/components/LabTerminal.jsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function LabTerminal({ containerName, onClose, onComplete }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#ef4444',
        selectionBackground: '#ef444440',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const wsUrl = `/ws/lab?container=${encodeURIComponent(containerName)}`;
    const ws = new WebSocket(
      window.location.protocol === 'https:'
        ? `wss://${window.location.host}${wsUrl}`
        : `ws://${window.location.host}${wsUrl}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
        if (msg.type === 'ready') term.write('\r\n\x1b[32m[WINLAB]\x1b[0m Lab ready. Type commands below.\r\n\r\n');
        if (msg.type === 'exit') {
          term.write('\r\n\x1b[33m[WINLAB]\x1b[0m Session ended.\r\n');
          onComplete?.();
        }
        if (msg.type === 'error') term.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.data}\r\n`);
      } catch {}
    };

    ws.onerror = () => term.write('\r\n\x1b[31m[WINLAB]\x1b[0m Connection error.\r\n');

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, [containerName]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            Lab Terminal — {containerName}
          </span>
        </div>
        <button
          onClick={() => {
            wsRef.current?.close();
            onClose?.();
          }}
          className="text-[10px] font-mono text-gray-600 hover:text-red-500 uppercase tracking-widest transition-colors"
        >
          [ Termina sessione ]
        </button>
      </div>

      {/* xterm mount point */}
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors**

```bash
npx vite build --mode development 2>&1 | grep -i "labTerminal\|xterm\|error" | head -10
```

Expected: no errors mentioning LabTerminal or xterm.

- [ ] **Step 3: Commit**

```bash
git add src/components/LabTerminal.jsx
git commit -m "feat(frontend): add LabTerminal component (xterm.js + WebSocket)"
```

---

## Task 6: Create src/components/RegisterModal.jsx

**Files:**
- Create: `src/components/RegisterModal.jsx`

Calls `POST /api/auth/register`. On success calls `onSuccess({ id, email, plan, name })`. Also supports switching to login mode.

- [ ] **Step 1: Create the file**

```jsx
// src/components/RegisterModal.jsx
import { useState } from 'react';
import { X } from 'lucide-react';

export default function RegisterModal({ onSuccess, onClose }) {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register'
      ? { email, password, name }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore. Riprova.');
        return;
      }
      onSuccess(data.user);
    } catch {
      setError('Connessione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">
          {mode === 'register' ? 'Crea Account' : 'Accedi'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {mode === 'register'
            ? 'Registrati per salvare il tuo progresso.'
            : 'Bentornato Operator.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Nome (opzionale)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
          />
          <input
            type="password"
            placeholder="Password (min. 8 caratteri)"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 placeholder-gray-600"
          />

          {error && (
            <p className="text-red-500 text-xs font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : mode === 'register' ? 'REGISTRATI' : 'ACCEDI'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}
          className="mt-4 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {mode === 'register' ? 'Ho già un account → Accedi' : 'Nessun account → Registrati'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no import errors**

```bash
npx vite build --mode development 2>&1 | grep -i "RegisterModal\|error" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/RegisterModal.jsx
git commit -m "feat(frontend): add RegisterModal with register/login form"
```

---

## Task 7: Create src/HomeShell.jsx

**Files:**
- Create: `src/HomeShell.jsx`

The main shell. Paste the App component from the design session and extend it with:
1. `view` state: `'terminal' | 'dashboard' | 'lab'`
2. `auth` state: `null | { id, email, plan, name }`
3. `activeSession` state: `null | { sessionId, containerName, labId }`
4. Lab start flow with Docker integration
5. RegisterModal gate
6. Paywall modal after non-starter lab completion

- [ ] **Step 1: Create src/HomeShell.jsx**

```jsx
// src/HomeShell.jsx
import { useState, useEffect, useRef } from 'react';
import {
  Server, LayoutDashboard, User, LogOut,
  Search, Clock, AlertCircle, X
} from 'lucide-react';
import LabTerminal from './components/LabTerminal';
import RegisterModal from './components/RegisterModal';

// ─── Lab catalog ──────────────────────────────────────────────────────────────
const STARTER_IDS = new Set(['linux-terminal','enhanced-terminal','disk-full','nginx-port-conflict']);

const labDatabase = [
  { id:'linux-terminal',          tier:'Starter', title:'Linux Terminal Basics',      difficulty:'Easy',   duration:'15m', xp:150,  tags:['linux','bash'],       category:'Starter' },
  { id:'enhanced-terminal',       tier:'Starter', title:'Lab Guidato: 3 Incidenti',   difficulty:'Easy',   duration:'20m', xp:200,  tags:['apache','disk'],      category:'Starter' },
  { id:'disk-full',               tier:'Starter', title:'Disco Pieno - Emergenza',    difficulty:'Easy',   duration:'8m',  xp:100,  tags:['disk','storage'],     category:'Starter' },
  { id:'nginx-port-conflict',     tier:'Starter', title:'Conflitto Porte Nginx',      difficulty:'Easy',   duration:'6m',  xp:100,  tags:['nginx','port'],       category:'Starter' },
  { id:'permission-denied',       tier:'Pro',     title:'Permission Denied - ACL',    difficulty:'Medium', duration:'10m', xp:300,  tags:['chmod','selinux'],    category:'Pro'     },
  { id:'raid-simulator',          tier:'Pro',     title:'Configurazione RAID',        difficulty:'Medium', duration:'20m', xp:500,  tags:['raid','mdadm'],       category:'Pro'     },
  { id:'memory-leak',             tier:'Pro',     title:'Memory Leak: NodeJS',        difficulty:'Hard',   duration:'15m', xp:800,  tags:['memory','nodejs'],    category:'Pro'     },
  { id:'db-dead',                 tier:'Pro',     title:'Database Irraggiungibile',   difficulty:'Hard',   duration:'20m', xp:850,  tags:['mysql','recovery'],   category:'Pro'     },
  { id:'sssd-ldap',               tier:'Pro',     title:'SSSD / LDAP Failure',        difficulty:'Hard',   duration:'25m', xp:1200, tags:['ldap','auth'],        category:'Pro'     },
  { id:'advanced-scenarios',      tier:'Pro',     title:'Advanced Production Scenarios', difficulty:'Hard', duration:'20m', xp:1500, tags:['ssl','oom','java'],  category:'Pro'     },
  { id:'real-server',             tier:'Pro',     title:'Real Server: 12 Scenari',    difficulty:'Hard',   duration:'25m', xp:2000, tags:['iostat','tcpdump'],   category:'Pro'     },
  { id:'api-timeout-n-plus-one',  tier:'Codex',   title:'API Timeout: N+1 Query',     difficulty:'Hard',   duration:'15m', xp:700,  tags:['sql','api'],          category:'Codex'   },
  { id:'auth-bypass-jwt-trust',   tier:'Codex',   title:'Auth Bypass: JWT Trust',     difficulty:'Hard',   duration:'12m', xp:600,  tags:['security','jwt'],     category:'Codex'   },
  { id:'stripe-webhook-forgery',  tier:'Codex',   title:'Stripe Webhook Forgery',     difficulty:'Hard',   duration:'18m', xp:750,  tags:['security','webhook'], category:'Codex'   },
  { id:'deploy-new-version',      tier:'Ops',     title:'Deploy New Version',         difficulty:'Medium', duration:'5m',  xp:200,  tags:['production'],         category:'Ops'     },
  { id:'rollback-failed-deploy',  tier:'Ops',     title:'Rollback Strategy',          difficulty:'Medium', duration:'8m',  xp:250,  tags:['git','cicd'],         category:'Ops'     },
  { id:'ghost-asset-incident',    tier:'Ops',     title:'The 70-Hour Bug',            difficulty:'Hard',   duration:'40m', xp:1500, tags:['debugging'],          category:'Ops'     },
  { id:'k8s-crashloop',           tier:'Ops',     title:'Kubernetes CrashLoop',       difficulty:'Hard',   duration:'15m', xp:900,  tags:['k8s','docker'],       category:'Ops'     },
  { id:'redis-oom',               tier:'Ops',     title:'Redis OOM Storm',            difficulty:'Hard',   duration:'12m', xp:700,  tags:['redis','cache'],      category:'Ops'     },
  { id:'network-lab',             tier:'Business',title:'Network Simulator',          difficulty:'Medium', duration:'30m', xp:0,    tags:['network'],            category:'Business', status:'placeholder' },
];

const CATEGORIES = ['All','Starter','Pro','Codex','Ops','Business'];

const INITIAL_LOGS = [
  { type:'system',  text:'WINLAB INCIDENT ROUTER [v4.2.0]' },
  { type:'info',    text:'Booting secure environment...' },
  { type:'info',    text:'Initializing neural link to edge nodes...' },
  { type:'success', text:'Link established. Latency: 14ms' },
  { type:'warning', text:'SCAN COMPLETE: 34 critical incidents detected.' },
  { type:'info',    text:'Waiting for Operator authorization...' },
  { type:'prompt',  text:'Digitare "login" o "1" per iniziare:' },
];

// ─── HomeShell ────────────────────────────────────────────────────────────────
export default function HomeShell() {
  // ── Global state ────────────────────────────────────────────────────────────
  const [view, setView] = useState('terminal'); // 'terminal' | 'dashboard' | 'lab'
  const [auth, setAuth] = useState(null);       // null | { id, email, plan, name }
  const [activeSession, setActiveSession] = useState(null); // { sessionId, containerName, labId }
  const [selectedLab, setSelectedLab] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState('');

  // ── Dashboard filters ────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Terminal landing state ───────────────────────────────────────────────────
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const terminalEndRef = useRef(null);

  // Boot terminal animation
  useEffect(() => {
    if (view !== 'terminal') return;
    let i = 0;
    const iv = setInterval(() => {
      if (i < INITIAL_LOGS.length) {
        setTerminalLogs(prev => [...prev, INITIAL_LOGS[i++]]);
      } else {
        clearInterval(iv);
      }
    }, 300);
    return () => clearInterval(iv);
  }, [view]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // Restore auth from cookie (check /api/auth/me equivalent via /api/progress)
  useEffect(() => {
    const stored = sessionStorage.getItem('winlab_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored)); } catch {}
    }
  }, []);

  // ── Terminal commands ────────────────────────────────────────────────────────
  function handleCommand(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const cmd = inputValue.toLowerCase().trim();
    setTerminalLogs(prev => [...prev, { type:'user', text:`> ${inputValue}` }]);
    setInputValue('');

    setTimeout(() => {
      if (cmd === 'login' || cmd === 'start' || cmd === '1') {
        setTerminalLogs(prev => [...prev, { type:'info', text:'Accesso autorizzato. Reindirizzamento...' }]);
        setTimeout(() => setView('dashboard'), 600);
      } else if (cmd === 'help') {
        setTerminalLogs(prev => [...prev, { type:'system', text:'Comandi: login, help, clear' }]);
      } else if (cmd === 'clear') {
        setTerminalLogs([{ type:'prompt', text:'Digitare "login" o "1" per iniziare:' }]);
      } else {
        setTerminalLogs(prev => [...prev, { type:'error', text:`Comando non riconosciuto: ${cmd}` }]);
      }
    }, 150);
  }

  // ── Lab start logic ──────────────────────────────────────────────────────────
  async function startLab(lab) {
    if (lab.status === 'placeholder') return;

    // Pro/Codex/Ops/Business labs require auth
    const needsAuth = !STARTER_IDS.has(lab.id);
    if (needsAuth && !auth) {
      setSelectedLab(lab);
      setShowRegister(true);
      return;
    }

    setSelectedLab(lab);
    setLabLoading(true);
    setLabError('');

    try {
      const res = await fetch('/api/lab/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ labId: lab.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { setShowRegister(true); return; }
        setLabError(data.error || 'Impossibile avviare il lab.');
        return;
      }
      setActiveSession({ sessionId: data.sessionId, containerName: data.containerName, labId: lab.id });
      setView('lab');
    } catch {
      setLabError('Connessione al server fallita.');
    } finally {
      setLabLoading(false);
    }
  }

  async function stopLab() {
    if (activeSession) {
      await fetch('/api/lab/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: activeSession.sessionId }),
      }).catch(() => {});
    }
    setActiveSession(null);
    setSelectedLab(null);
    setView('dashboard');
  }

  function handleLabComplete() {
    // Show paywall if lab is not starter tier
    if (selectedLab && !STARTER_IDS.has(selectedLab.id)) {
      setShowPaywall(true);
    } else {
      stopLab();
    }
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────────
  function handleAuthSuccess(user) {
    setAuth(user);
    sessionStorage.setItem('winlab_auth', JSON.stringify(user));
    setShowRegister(false);
    // If a lab was pending, start it now
    if (selectedLab) startLab(selectedLab);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST', credentials:'include' }).catch(()=>{});
    setAuth(null);
    sessionStorage.removeItem('winlab_auth');
    setView('terminal');
    setTerminalLogs([]);
  }

  // ── Stripe checkout ──────────────────────────────────────────────────────────
  async function handleUpgrade() {
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'pro' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  }

  // ── Filtered labs ────────────────────────────────────────────────────────────
  const filteredLabs = labDatabase.filter(lab => {
    const matchCat = selectedCategory === 'All' || lab.category === selectedCategory;
    const matchSearch = lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ════════════════════════════════════════════════════════════════════════════

  // ── Terminal landing ─────────────────────────────────────────────────────────
  if (view === 'terminal') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-4xl h-[85vh] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/50" />
            </div>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">WinLab Operational Terminal</span>
            <div className="w-10" />
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-1">
            {terminalLogs.map((log, i) => log && (
              <div key={i} className={`text-sm leading-relaxed break-all ${
                log.type==='system'  ? 'text-blue-400 font-bold' :
                log.type==='error'   ? 'text-red-500 font-bold' :
                log.type==='success' ? 'text-green-500' :
                log.type==='warning' ? 'text-yellow-500' :
                log.type==='user'    ? 'text-white' : 'text-gray-500'
              }`}>{log.text}</div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          <form onSubmit={handleCommand} className="bg-zinc-900/50 p-6 border-t border-white/5 flex items-center gap-3 shrink-0">
            <span className="text-red-500 font-bold">OP@WINLAB:~$</span>
            <input
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-white text-sm"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Esegui comando..."
            />
          </form>
        </div>
      </div>
    );
  }

  // ── Lab terminal ─────────────────────────────────────────────────────────────
  if (view === 'lab' && activeSession) {
    return (
      <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
        {showRegister && (
          <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />
        )}
        {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => { setShowPaywall(false); stopLab(); }} />}
        <div className="flex-1 flex flex-col">
          <LabTerminal
            containerName={activeSession.containerName}
            onClose={stopLab}
            onComplete={handleLabComplete}
          />
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
      {showRegister && (
        <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />
      )}
      {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => setShowPaywall(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:relative z-50 w-64 h-full border-r border-white/5 bg-black flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded">
            <Server className="w-5 h-5 text-white" />
          </div>
          <span className="font-black tracking-tighter text-xl text-white italic">WINLAB</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='dashboard' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'hover:bg-white/5 text-gray-500'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button
            onClick={() => auth ? setActiveTab('profile') : setShowRegister(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='profile' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'hover:bg-white/5 text-gray-500'}`}
          >
            <User className="w-5 h-5" />
            {auth ? auth.name || auth.email : 'Accedi'}
          </button>
        </nav>

        <div className="p-4 border-t border-white/5 shrink-0">
          {auth ? (
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] uppercase font-black tracking-widest text-gray-600 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Terminate Session
            </button>
          ) : (
            <button onClick={() => setShowRegister(true)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] uppercase font-black tracking-widest text-gray-600 hover:text-red-500 transition-colors">
              Registrati / Accedi
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-10">
        <div className="max-w-6xl mx-auto pb-20">
          <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Operational Hub</h1>
              <p className="text-gray-500 text-sm font-medium mt-2">
                Operator: <span className="text-white">{auth ? (auth.name || auth.email) : 'Guest'}</span>
                {' '}— Status: <span className="text-red-500 font-bold">ACTIVE</span>
              </p>
            </div>
            <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-2xl">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Catalog Integrity</p>
              <p className="text-xl font-black text-white">{filteredLabs.length} / {labDatabase.length} MODULES</p>
            </div>
          </header>

          {/* Filters */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex gap-1 bg-zinc-900 p-1.5 rounded-2xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory===cat ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Ricerca lab..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-red-500/30"
              />
            </div>
          </div>

          {/* Lab grid */}
          {labError && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono">
              {labError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLabs.map(lab => (
              <div
                key={lab.id}
                onClick={() => !labLoading && lab.status !== 'placeholder' && setSelectedLab(lab)}
                className={`group relative p-6 rounded-[32px] border flex flex-col transition-all duration-300 ${lab.status==='placeholder' ? 'bg-zinc-950/30 border-white/5 grayscale opacity-40 cursor-not-allowed' : 'bg-zinc-950 border-white/10 hover:border-red-600/40 cursor-pointer hover:shadow-2xl hover:shadow-red-900/10 hover:-translate-y-1'}`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${lab.difficulty==='Easy' ? 'text-green-500 border-green-500/10 bg-green-500/5' : lab.difficulty==='Medium' ? 'text-blue-500 border-blue-500/10 bg-blue-500/5' : 'text-red-500 border-red-500/10 bg-red-500/5'}`}>
                    {lab.difficulty}
                  </div>
                  <div className="text-[9px] font-mono text-gray-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {lab.duration}
                  </div>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight italic mb-3 group-hover:text-red-500 transition-colors leading-tight min-h-[3rem]">{lab.title}</h3>
                <div className="flex flex-wrap gap-1 mb-6 flex-grow">
                  {lab.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-mono text-gray-500">#{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-auto">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest">{lab.category}</span>
                  <span className="text-xs font-black text-red-500 italic">+{lab.xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Lab start modal */}
      {selectedLab && view !== 'lab' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedLab(null)} />
          <div className="relative bg-zinc-900 border border-white/10 rounded-[40px] w-full max-w-2xl p-8 md:p-12 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-full bg-red-600/10 border border-red-600/20 mb-8">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-tight">{selectedLab.title}</h2>
              <p className="text-gray-500 mb-10 max-w-md mx-auto italic">
                Inizializzazione ambiente Docker isolato. Confermare l'avvio?
              </p>
              <div className="grid grid-cols-2 gap-4 md:gap-8 mb-10">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[10px] font-black text-gray-600 uppercase mb-1">XP Reward</p>
                  <p className="text-xl font-black text-red-500 italic">+{selectedLab.xp} XP</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[10px] font-black text-gray-600 uppercase mb-1">Time Limit</p>
                  <p className="text-xl font-black text-white italic">{selectedLab.duration}</p>
                </div>
              </div>
              {labError && <p className="mb-4 text-red-400 text-sm font-mono">{labError}</p>}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => startLab(selectedLab)}
                  disabled={labLoading}
                  className="flex-1 py-5 bg-red-600 text-white font-black rounded-3xl uppercase tracking-widest italic hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95 disabled:opacity-50"
                >
                  {labLoading ? 'AVVIO...' : 'AVVIA SESSIONE'}
                </button>
                <button onClick={() => { setSelectedLab(null); setLabError(''); }} className="flex-1 py-5 border border-white/10 text-gray-500 font-black rounded-3xl uppercase tracking-widest hover:bg-white/5 transition-all">
                  ANNULLA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paywall modal ─────────────────────────────────────────────────────────────
function PaywallModal({ onUpgrade, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 text-center shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-2xl font-black text-white italic uppercase mb-2">Lab completato!</h2>
        <p className="text-gray-500 text-sm mb-8">Sblocca tutti i 34 lab, AI Mentor illimitato e certificati.</p>
        <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
          <p className="text-[10px] text-gray-600 uppercase font-black mb-1">Pro Plan</p>
          <p className="text-3xl font-black text-white">$19<span className="text-gray-500 text-sm font-normal">/mese</span></p>
        </div>
        <button
          onClick={onUpgrade}
          className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
        >
          SBLOCCA TUTTO →
        </button>
        <button onClick={onClose} className="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Continua gratis
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript/build errors**

```bash
npx vite build --mode development 2>&1 | grep -i "error\|HomeShell" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/HomeShell.jsx
git commit -m "feat(frontend): add HomeShell — terminal landing, dashboard, lab orchestration"
```

---

## Task 8: Modify src/main.jsx

**Files:**
- Modify: `src/main.jsx`

Replace the SaaSOrchestrator/LabContext setup with a direct render of HomeShell.

- [ ] **Step 1: Replace src/main.jsx entirely**

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import HomeShell from './HomeShell';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HomeShell />
  </React.StrictMode>
);
```

- [ ] **Step 2: Run dev server and verify it loads**

```bash
npm run dev
```

Open `http://localhost:5173` in browser. Expected: black screen with terminal animation, text appearing line by line, input prompt at bottom.

- [ ] **Step 3: Test the terminal flow**

1. Type `login` → should transition to dashboard
2. Dashboard should show the lab grid with categories and search
3. Click a Starter lab card → modal appears
4. Click AVVIA SESSIONE → (needs Docker running) container starts, terminal appears

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat: render HomeShell as root — remove SaaSOrchestrator"
```

---

## Task 9: Delete unused files and verify build

**Files:**
- Delete: all files listed below

- [ ] **Step 1: Delete old page files**

```bash
cd src

# Pages and top-level components no longer used
rm -f SaaSOrchestrator.jsx LandingPage.jsx NewLandingPage.jsx WinLabHome.jsx
rm -f LaunchLanding.jsx IndiaHinglishLanding.jsx Dashboard.jsx CommunityHub.jsx
rm -f AboutPage.jsx OnboardingFlow.jsx OnboardingPage.jsx FirstMission.jsx
rm -f TelemetryDashboard.jsx MyRootHub.jsx HelpdeskDashboard.jsx HelpdeskPage.jsx
rm -f EarlyAccessSuccess.jsx DeceptionDashboard.jsx ABTestOnboarding.jsx
rm -f ReferralSystem.jsx SubscriptionManagement.jsx ResetPasswordPage.jsx
rm -f FakeTerminal.jsx AuthPage.jsx AISettings.jsx

# Old pages/ directory
rm -f pages/WinLabInteractiveHome.jsx pages/MyIncidents.jsx

# Unused components
rm -f components/HeroTerminalExperience.jsx components/EnterpriseLabsHub.jsx
rm -f components/EnterpriseArch.jsx components/AutomationLab.jsx
rm -f components/CloudInfra.jsx components/IntuneMDM.jsx components/JamfPro.jsx
rm -f components/MspDashboard.jsx components/ChainLaunchExperience.jsx
rm -f components/ChainTerminalController.jsx components/AIPatchPanel.jsx
rm -f components/AuthFlow.jsx components/AuthModal.jsx components/TrialGate.jsx
rm -f components/LandingFeaturedLabs.jsx components/LandingPricingSection.jsx
rm -f components/HeroSection.jsx components/IncidentHistoryPanel.jsx
rm -f components/PressureMode.jsx components/MacOSTerminalAnimation.jsx

# Old page-level components inside components/
rm -f components/pages/SignupPage.jsx components/pages/PricingPage.jsx 2>/dev/null || true

cd ..
```

- [ ] **Step 2: Run build and check for broken imports**

```bash
npm run build 2>&1 | grep -E "error|could not resolve|failed" | head -20
```

Expected: zero errors. If any "could not resolve" errors appear, those imports need to be removed from remaining files.

- [ ] **Step 3: Fix any remaining broken imports**

For each unresolved import error, open the importing file and remove or replace the import. Most likely culprits are files that imported `SaaSOrchestrator`, `LabContext`, or `AuthPage`.

Run build again:
```bash
npm run build 2>&1 | grep -E "error|could not resolve" | head -10
```

Expected: clean build.

- [ ] **Step 4: Final smoke test**

```bash
npm run dev
```

1. Terminal animation plays → `login` → dashboard
2. Filter by "Starter" → 4 cards visible
3. Click "Disco Pieno" → modal appears → "AVVIA SESSIONE" → Docker container starts → xterm terminal appears
4. Type `df -h` in terminal → disk usage output appears
5. Click "Termina sessione" → back to dashboard

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete unused pages and components — HomeShell is now the sole frontend shell"
```

---

## Notes

- **Docker must be running** on the host for lab sessions to work
- **Lab image** must be built first: `docker build -f docker/lab-runner/Dockerfile -t winlab-lab-runner:latest .`
- **xterm.css** is imported in `LabTerminal.jsx` — Vite handles this via the `xterm` package
- **Proxy**: in production, Nginx should proxy `/ws/lab` to port 3001 (same as `/api`)
- **SessionStorage** is used for auth state — survives page refresh within the tab, cleared on close (acceptable for MVP)
