# Per-Lab Boot Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lab gets a unique boot sequence shown as a full-screen splash before the terminal opens, and printed in ANSI color inside the bash terminal on connect.

**Architecture:** `gen-lab.js` generates `labs/<id>/boot.json` from `scenario.json` metadata. The backend reads it and includes it in the `/api/lab/start` response. The frontend shows `LabBootSplash` (press-any-key overlay). `entrypoint.sh` prints the same lines with ANSI codes to `.bashrc` so they appear in the real terminal.

**Tech Stack:** Node.js ESM, React + Tailwind, bash/Python3

---

## File Map

| File | Change |
|------|--------|
| `scripts/gen-lab.js` | Add `generateBootSequence()`, refactor to `runForLab()`, add `--all` flag |
| `labs/*/boot.json` | Generated output (run after Task 1) |
| `index.js` | Add `readFileSync` import; read `boot.json` in `POST /api/lab/start` |
| `src/components/LabBootSplash.jsx` | New — full-screen animated splash |
| `src/HomeShell.jsx` | Import splash, add `showSplash` state, integrate in `startLab` and render |
| `docker/lab-runner/entrypoint.sh` | Python block to append ANSI boot lines to `.bashrc` |

---

## Task 1: Add `generateBootSequence()` and `--all` to `gen-lab.js`

**Files:**
- Modify: `scripts/gen-lab.js`

- [ ] **Step 1: Add `readdirSync` to the fs import**

In `scripts/gen-lab.js`, line 18, change:
```js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
```
to:
```js
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
```

- [ ] **Step 2: Update CLI arg parsing to support `--all`**

Replace lines 26–35 (the CLI block):
```js
const args    = process.argv.slice(2);
const labId   = args.find(a => !a.startsWith('--'));
const force   = args.includes('--force');
const dryRun  = args.includes('--dry-run');

if (!labId) {
  console.error('Usage: node scripts/gen-lab.js <lab-id> [--force] [--dry-run]');
  process.exit(1);
}

const labDir      = join(LABS_DIR, labId);
const solutionPath = join(labDir, 'solution.md');

if (!existsSync(solutionPath)) {
  console.error(`solution.md not found: ${solutionPath}`);
  process.exit(1);
}
```
with:
```js
const args   = process.argv.slice(2);
const labId  = args.find(a => !a.startsWith('--'));
const force  = args.includes('--force');
const dryRun = args.includes('--dry-run');
const all    = args.includes('--all');

if (!labId && !all) {
  console.error('Usage: node scripts/gen-lab.js <lab-id> [--force] [--dry-run]');
  console.error('       node scripts/gen-lab.js --all   [--force] [--dry-run]');
  process.exit(1);
}
```

- [ ] **Step 3: Add the `TAG_WARNINGS` map and `generateBootSequence()` function**

Add after the `GENERATORS` comment block (after line 89, before `genMentorSteps`):
```js
const TAG_WARNINGS = {
  nginx:      '⚠  nginx.service in FAILED state',
  port:       '⚠  Port conflict detected on eth0',
  disk:       '⚠  Filesystem at 100% — writes blocked',
  storage:    '⚠  Storage I/O errors detected',
  apache:     '⚠  Apache service misconfiguration detected',
  ssl:        '⚠  SSL certificate validation failed',
  ldap:       '⚠  LDAP bind failure — auth service down',
  auth:       '⚠  Authentication service unreachable',
  mysql:      '⚠  MySQL connection refused',
  memory:     '⚠  Memory usage critical — OOM imminent',
  redis:      '⚠  Redis OOM — eviction storm in progress',
  k8s:        '⚠  Kubernetes pod in CrashLoopBackOff',
  docker:     '⚠  Container health check failing',
  security:   '⚠  Security misconfiguration detected',
  jwt:        '⚠  JWT validation bypass detected',
  webhook:    '⚠  Webhook signature forgery detected',
  sql:        '⚠  Database query timeout — N+1 detected',
  api:        '⚠  API response time critically degraded',
  git:        '⚠  Repository state inconsistent',
  cicd:       '⚠  CI/CD pipeline failure — deploy blocked',
  raid:       '⚠  RAID array degraded — disk failure detected',
  network:    '⚠  Network packet loss detected',
  chmod:      '⚠  Permission denied — ACL misconfiguration',
  selinux:    '⚠  SELinux policy blocking critical access',
  nodejs:     '⚠  Node.js process memory leak detected',
  debugging:  '⚠  Unknown regression — root cause unclear',
  production: '⚠  Production service degraded',
};

function generateBootSequence(scenario) {
  const lines = [];

  lines.push({ type: 'system', text: `${scenario.title.toUpperCase()} [v4.2.0]` });

  const seen = new Set();
  for (const tag of (scenario.tags ?? [])) {
    const msg = TAG_WARNINGS[tag];
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      lines.push({ type: 'warning', text: msg });
    }
  }

  const hint0 = scenario.hints?.[0] ?? '';
  if (hint0) {
    const afterDash = hint0.split('—')[1]?.trim();
    const raw = afterDash ?? hint0.replace(/^[^:]+:\s*`?[^\s`]+`?\s*/i, '').trim();
    const infoText = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/\.$/, '') + '.';
    if (infoText.length > 2) {
      lines.push({ type: 'info', text: 'ℹ  ' + infoText });
    }
  }

  lines.push({ type: 'prompt', text: 'Press any key to begin...' });

  return lines;
}
```

- [ ] **Step 4: Extract `runForLab(labId)` function and update main block**

Replace lines 164–194 (the `── MAIN ──` section) with:
```js
// ─── MAIN ─────────────────────────────────────────────────────────────────────

function runForLab(id) {
  const labDir       = join(LABS_DIR, id);
  const solutionPath = join(labDir, 'solution.md');
  const scenarioPath = join(labDir, 'scenario.json');

  if (!existsSync(solutionPath)) {
    console.error(`skip ${id}: solution.md not found`);
    return false;
  }
  if (!existsSync(scenarioPath)) {
    console.error(`skip ${id}: scenario.json not found`);
    return false;
  }

  const md       = readFileSync(solutionPath, 'utf8');
  const sections = parseSections(md);
  const hintsRaw = sections['MENTOR_HINTS'];

  if (!hintsRaw) {
    console.error(`skip ${id}: solution.md missing ## MENTOR_HINTS`);
    return false;
  }

  const hints    = parseMentorHints(hintsRaw);
  const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'));
  const steps    = genMentorSteps(hints);
  const enJson   = genEnJson(sections, hints);
  const itJson   = genItJson(enJson);
  const boot     = generateBootSequence(scenario);

  console.log(`\ngen-lab: ${id} (${hints.length} hints found)\n`);

  const mentorDir = join(labDir, 'mentor');
  ensureDir(mentorDir);
  for (const { filename, content } of steps) {
    writeFile(join(mentorDir, filename), content);
  }

  const localesDir = join(labDir, 'locales');
  ensureDir(localesDir);
  writeFile(join(localesDir, 'en.json'), JSON.stringify(enJson, null, 2) + '\n');
  writeFile(join(localesDir, 'it.json'), JSON.stringify(itJson, null, 2) + '\n');

  writeFile(join(labDir, 'boot.json'), JSON.stringify(boot, null, 2) + '\n');

  return true;
}

if (all) {
  const labs = readdirSync(LABS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  let ok = 0, fail = 0;
  for (const id of labs) {
    if (runForLab(id)) ok++; else fail++;
  }
  console.log(`\ndone: ${ok} ok, ${fail} skipped.`);
} else {
  if (!runForLab(labId)) process.exit(1);
  console.log('\ndone.');
}
```

- [ ] **Step 5: Verify `gen-lab.js` works for a single lab**

Run:
```bash
node scripts/gen-lab.js linux-terminal --force
```
Expected output contains: `wrote: labs/linux-terminal/boot.json`

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-lab.js
git commit -m "feat(gen-lab): add generateBootSequence and --all flag"
```

---

## Task 2: Generate `boot.json` for all labs

**Files:**
- Create: `labs/*/boot.json` (all labs with solution.md)

- [ ] **Step 1: Run generator for all labs**

```bash
node scripts/gen-lab.js --all --force
```
Expected: lines like `wrote: labs/<id>/boot.json` for each lab. Some labs may print `skip <id>: solution.md not found` — that is expected for placeholder labs.

- [ ] **Step 2: Spot-check two output files**

```bash
cat labs/linux-terminal/boot.json
cat labs/nginx-port-conflict/boot.json
```
Each should be a JSON array starting with `{ "type": "system", "text": "... [v4.2.0]" }`.

- [ ] **Step 3: Commit**

```bash
git add labs/
git commit -m "feat(labs): generate boot.json for all labs"
```

---

## Task 3: Backend — include `bootSequence` in `/api/lab/start` response

**Files:**
- Modify: `index.js` line 20

- [ ] **Step 1: Add `readFileSync` to the fs import**

In `index.js`, line 20, change:
```js
import { existsSync } from "fs";
```
to:
```js
import { existsSync, readFileSync } from "fs";
```

- [ ] **Step 2: Read `boot.json` and add to response**

In `index.js`, find the `POST /api/lab/start` handler. The current response line (around line 624) is:
```js
res.json({ sessionId, containerName: session.containerName, labId });
```
Replace with:
```js
const bootPath = path.join(__dirname, 'labs', labId, 'boot.json');
const bootSequence = existsSync(bootPath)
  ? JSON.parse(readFileSync(bootPath, 'utf8'))
  : [];
res.json({ sessionId, containerName: session.containerName, labId, bootSequence });
```

- [ ] **Step 3: Verify manually**

Start the server (`npm run dev` or `node index.js`), then in another terminal:
```bash
curl -s -X POST http://localhost:3000/api/lab/start \
  -H "Content-Type: application/json" \
  -d "{\"labId\":\"linux-terminal\",\"sessionId\":\"test-123\"}"
```
Expected: JSON response containing `"bootSequence":[{"type":"system",...},...]`.

- [ ] **Step 4: Commit**

```bash
git add index.js
git commit -m "feat(api): include bootSequence in /api/lab/start response"
```

---

## Task 4: `entrypoint.sh` — print boot sequence in bash terminal

**Files:**
- Modify: `docker/lab-runner/entrypoint.sh`

- [ ] **Step 1: Add the boot sequence printer block**

In `docker/lab-runner/entrypoint.sh`, find the line:
```bash
# ── Write hint script (once, at boot) ─────────────────────────────────────────
```
Add the following block immediately before it (after the `echo "[entrypoint] ready"` line):

```bash
# ── Write boot sequence to .bashrc MOTD ───────────────────────────────────────
python3 - <<'PY'
import json, os

LAB_ID = os.environ.get("LAB_ID", "")
boot_path = f"/labs/{LAB_ID}/boot.json"
boot = json.load(open(boot_path)) if os.path.exists(boot_path) else []

COLORS = {
    "system":  "\033[1;31m",
    "warning": "\033[33m",
    "info":    "\033[36m",
    "success": "\033[32m",
    "error":   "\033[31m",
    "prompt":  "\033[37m",
}
RESET = "\033[0m"
DIM   = "\033[90m"

lines = []
for item in boot:
    color = COLORS.get(item.get("type", "info"), "")
    text  = item.get("text", "").replace("\\", "\\\\").replace('"', '\\"')
    lines.append(f'echo -e "{color}{text}{RESET}"')

lines.append(f'echo -e "{DIM}────────────────────────────────{RESET}"')
lines.append(f'echo -e "Type \\033[36mverify\\033[0m to check · \\033[36mhint\\033[0m for hints"')
lines.append(f'echo -e "{DIM}────────────────────────────────{RESET}"')

with open("/root/.bashrc", "a") as f:
    f.write("\n# Boot sequence\n")
    f.write("\n".join(lines) + "\n")
PY
```

- [ ] **Step 2: Rebuild the Docker image**

```bash
docker build -t winlab-lab-runner:latest -f docker/lab-runner/Dockerfile .
```
Expected: `Successfully tagged winlab-lab-runner:latest`

- [ ] **Step 3: Test terminal boot sequence**

```bash
docker run --rm -e LAB_ID=linux-terminal winlab-lab-runner:latest bash -i -c "exit" 2>&1 | cat
```
Expected output starts with colored lines:
```
LINUX TERMINAL [v4.2.0]
⚠  ...
ℹ  ...
Press any key to begin...
────────────────────────────────
Type verify to check · hint for hints
────────────────────────────────
```

- [ ] **Step 4: Commit**

```bash
git add docker/lab-runner/entrypoint.sh
git commit -m "feat(docker): print per-lab boot sequence in bash terminal"
```

---

## Task 5: `LabBootSplash.jsx` — new component

**Files:**
- Create: `src/components/LabBootSplash.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect } from 'react';

const TYPE_COLOR = {
  system:  'text-red-400 font-bold',
  warning: 'text-yellow-400',
  info:    'text-blue-400',
  success: 'text-green-400',
  error:   'text-red-500 font-bold',
  prompt:  'text-gray-400',
};

export default function LabBootSplash({ bootSequence, onReady }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [allVisible, setAllVisible] = useState(false);

  useEffect(() => {
    if (visibleCount < bootSequence.length) {
      const t = setTimeout(() => setVisibleCount(v => v + 1), 150);
      return () => clearTimeout(t);
    } else {
      setAllVisible(true);
    }
  }, [visibleCount, bootSequence.length]);

  useEffect(() => {
    if (!allVisible) return;
    const onKey = () => onReady();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allVisible, onReady]);

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col justify-center px-12 py-16 font-mono cursor-pointer"
      onClick={allVisible ? onReady : undefined}
    >
      <div className="text-gray-700 text-[10px] tracking-[0.3em] uppercase mb-10">
        WINLAB · INCIDENT ROUTER · v4.2.0
      </div>
      <div className="space-y-2 max-w-2xl">
        {bootSequence.slice(0, visibleCount).map((line, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed ${TYPE_COLOR[line.type] ?? 'text-gray-400'}`}
          >
            {line.text}
          </div>
        ))}
      </div>
      {allVisible && (
        <div className="mt-12 text-gray-600 text-xs animate-pulse">
          [ press any key to enter ]
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

```bash
node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
const src = readFileSync('src/components/LabBootSplash.jsx', 'utf8');
console.log('lines:', src.split('\n').length, '— ok');
EOF
```
Expected: `lines: <N> — ok`

- [ ] **Step 3: Commit**

```bash
git add src/components/LabBootSplash.jsx
git commit -m "feat(ui): add LabBootSplash component"
```

---

## Task 6: `HomeShell.jsx` — integrate splash on lab start

**Files:**
- Modify: `src/HomeShell.jsx`

- [ ] **Step 1: Import `LabBootSplash`**

Add after the existing import for `LabTerminal` (line 6):
```js
import LabBootSplash from './components/LabBootSplash';
```

- [ ] **Step 2: Add `showSplash` state**

Add with the other `useState` declarations (around line 87):
```js
const [showSplash, setShowSplash] = useState(false);
```

- [ ] **Step 3: Store `bootSequence` in `activeSession` and trigger splash**

In `startLab()`, find the success branch (around line 166):
```js
setActiveSession({ sessionId: data.sessionId, containerName: data.containerName, labId: lab.id });
setView('lab');
```
Replace with:
```js
setActiveSession({
  sessionId: data.sessionId,
  containerName: data.containerName,
  labId: lab.id,
  bootSequence: data.bootSequence ?? [],
});
setShowSplash((data.bootSequence?.length ?? 0) > 0);
setView('lab');
```

- [ ] **Step 4: Reset `showSplash` in `stopLab()`**

In `stopLab()`, add `setShowSplash(false);` before `setActiveSession(null)`:
```js
async function stopLab() {
  if (activeSession) {
    await fetch('/api/lab/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId: activeSession.sessionId }),
    }).catch(() => {});
  }
  setShowSplash(false);
  setActiveSession(null);
  setSelectedLab(null);
  setView('dashboard');
}
```

- [ ] **Step 5: Show splash before LabTerminal in render**

In `HomeShell.jsx`, find the lab view block (around line 274):
```jsx
  // ── Lab terminal view ──────────────────────────────────────────────────────
  if (view === 'lab' && activeSession) {
```

Add an early-return splash guard immediately before it:
```jsx
  if (view === 'lab' && showSplash && activeSession?.bootSequence?.length > 0) {
    return (
      <LabBootSplash
        bootSequence={activeSession.bootSequence}
        onReady={() => setShowSplash(false)}
      />
    );
  }

  // ── Lab terminal view ──────────────────────────────────────────────────────
  if (view === 'lab' && activeSession) {
```

Leave the existing `if (view === 'lab' && activeSession)` block and its contents (LabTerminal, AIMentor, modals) completely unchanged.

- [ ] **Step 6: Test in browser**

Start the dev server:
```bash
npm run dev
```
Navigate to the app, click "Linux Terminal Basics". Verify:
1. Full-screen black splash appears with lab-specific lines animating in one by one
2. `[ press any key to enter ]` appears after the last line
3. Pressing any key dismisses the splash and shows the terminal
4. Inside the terminal, scrolling to the top shows the same colored boot lines

- [ ] **Step 7: Commit**

```bash
git add src/HomeShell.jsx
git commit -m "feat(ui): show per-lab boot splash on lab start"
```
