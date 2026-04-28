# Per-Lab Boot Sequence

## Summary

Every lab gets a unique boot sequence shown as a full-screen splash before the terminal opens, and printed as colored text inside the real bash terminal on connect. The sequence is generated automatically by `gen-lab.js` from lab metadata and stored in `labs/<id>/boot.json`.

---

## Data

### `labs/<id>/boot.json`

Generated file (not hand-written). Array of typed lines:

```json
[
  { "type": "system",  "text": "NGINX PORT CONFLICT [v4.2.0]" },
  { "type": "warning", "text": "⚠  Port 80 collision detected on eth0" },
  { "type": "warning", "text": "⚠  nginx.service → FAILED (exit-code)" },
  { "type": "info",    "text": "Apache already listening on :80" },
  { "type": "prompt",  "text": "Press any key to begin..." }
]
```

**Types:** `system` `warning` `info` `success` `error` `prompt`

`scenario.json` is not modified.

---

## Generation — `gen-lab.js`

New function `generateBootSequence(scenario)` runs alongside existing locale and mentor generation.

**Input:** `scenario.json` fields — `title`, `tags`, `tier`, `difficulty`, `hints[0]`

**Output rules:**
- Line 1 — `system`: `"<TITLE> [v4.2.0]"`
- Lines 2–N — `warning`: one line per relevant tag mapped to a contextual incident message (e.g. `nginx`+`port` → "Port collision detected on eth0"; `disk` → "Filesystem at 100% — writes blocked")
- Line N+1 — `info`: short plain-text summary derived from `hints[0]`
- Last line — `prompt`: `"Press any key to begin..."`

**CLI:** included in standard `node scripts/gen-lab.js <id>` run. Also runnable for all labs at once: `node scripts/gen-lab.js --all`.

Output written to `labs/<id>/boot.json`, overwriting any previous version.

---

## Backend — `index.js`

`POST /api/lab/start` reads `labs/<id>/boot.json` and adds a `bootSequence` field to the response alongside `sessionId` and `containerName`. If the file is missing, returns an empty array — no error.

---

## Frontend — `LabBootSplash` component

New file: `src/components/LabBootSplash.jsx`

**Behavior:**
1. Receives `bootSequence` array and `onReady` callback as props.
2. Renders full-screen black overlay (`position: fixed`, `z-index` above everything).
3. Prints lines one at a time, ~150ms apart, each colored by type.
4. After all lines are printed: shows `[ press any key to enter ]`.
5. On any keydown or click: calls `onReady()`.
6. If Docker is not yet ready when `onReady` fires: shows a brief inline spinner until `containerName` resolves, then opens `LabTerminal`.

**Type → color mapping (CSS):**

| type    | color          |
|---------|----------------|
| system  | `#ff4444` bold |
| warning | `#ff9f43`      |
| info    | `#58a6ff`      |
| success | `#2ecc71`      |
| error   | `#ff4444`      |
| prompt  | `#cdd9e5`      |

**HomeShell integration:** `startLab()` calls `POST /api/lab/start`, stores the response (including `bootSequence`), and sets `activeSession` state. `render()` shows `LabBootSplash` when `bootSequence` is present and not yet dismissed; on dismiss shows `LabTerminal`.

---

## Docker — `entrypoint.sh`

After `seed.sh` runs, a Python block reads `boot.json` and appends `echo -e` lines with ANSI codes to `/root/.bashrc`.

**Type → ANSI color mapping:**

| type    | ANSI           |
|---------|----------------|
| system  | `\033[1;31m`   |
| warning | `\033[33m`     |
| info    | `\033[36m`     |
| success | `\033[32m`     |
| error   | `\033[31m`     |
| prompt  | `\033[37m`     |

After the sequence, a divider and `Type verify to check · hint for hints` are printed. This output appears once per bash session — it stays in the scroll buffer so the user can always scroll up to re-read the incident context.

---

## File Checklist

| File | Change |
|------|--------|
| `scripts/gen-lab.js` | Add `generateBootSequence()`, write `boot.json` per lab |
| `labs/*/boot.json` | Generated output (35 labs) |
| `index.js` | Read `boot.json` in `/api/lab/start`, add to response |
| `src/components/LabBootSplash.jsx` | New component |
| `src/HomeShell.jsx` | Show splash on lab start, pass `onReady` callback |
| `docker/lab-runner/entrypoint.sh` | Print boot sequence to `.bashrc` with ANSI |
