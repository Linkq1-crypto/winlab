#!/usr/bin/env bash
set -euo pipefail

LAB_ID="${LAB_ID:-}"
LAB_VARIANT="${LAB_VARIANT:-}"
LAB_LEVEL="${LAB_LEVEL:-JUNIOR}"
LAB_DIR="/labs/${LAB_ID}"

# Validate
if [[ -z "${LAB_ID}" ]]; then
  echo "[entrypoint] ERROR: LAB_ID is not set" >&2
  exit 1
fi

if [[ ! -d "${LAB_DIR}" ]]; then
  echo "[entrypoint] ERROR: unknown lab '${LAB_ID}' — ${LAB_DIR} does not exist" >&2
  exit 64
fi

if [[ ! -f "${LAB_DIR}/scenario.json" ]]; then
  echo "[entrypoint] ERROR: missing scenario.json for '${LAB_ID}'" >&2
  exit 65
fi

for script in seed.sh verify.sh reset.sh; do
  if [[ ! -x "${LAB_DIR}/${script}" ]]; then
    echo "[entrypoint] ERROR: ${script} missing or not executable in '${LAB_ID}'" >&2
    exit 66
  fi
done

# Boot
echo "[entrypoint] lab=${LAB_ID}${LAB_VARIANT:+ variant=${LAB_VARIANT}} level=${LAB_LEVEL}"

# Idempotent teardown of any previous state
"${LAB_DIR}/reset.sh" >/dev/null 2>&1 || true

# Inject the broken state the student must fix
echo "[entrypoint] seeding…"
"${LAB_DIR}/seed.sh"
echo "[entrypoint] ready"

# Write hint script (once, at boot)
python3 - <<'PY'
import json, os

f = "/labs/" + os.environ.get("LAB_ID", "") + "/scenario.json"
d = json.load(open(f)) if os.path.exists(f) else {}
hints = d.get("hints", [])
level = os.environ.get("LAB_LEVEL", "JUNIOR").upper()
disabled = {"MID", "SENIOR", "SRE"}

if level in disabled:
    lines = [f"print('Hints disabled for {level} mode.')"]
else:
    lines = [
        "hints = " + repr(hints),
        "[print('['+str(i+1)+'] '+h) for i,h in enumerate(hints)] if hints else print('No hints available.')",
    ]

open("/tmp/_hint.py", "w").write("\n".join(lines) + "\n")
PY

# verify / hint as real scripts in PATH
printf '#!/bin/bash\nbash /labs/$LAB_ID/verify.sh\n' > /usr/local/bin/verify
printf '#!/bin/bash\npython3 /tmp/_hint.py\n' > /usr/local/bin/hint
chmod +x /usr/local/bin/verify /usr/local/bin/hint

# Write boot sequence to .bashrc MOTD (shown when bash is interactive)
python3 - <<'PY' || true
import json, os

LAB_ID = os.environ.get("LAB_ID", "")
LAB_LEVEL = os.environ.get("LAB_LEVEL", "JUNIOR").upper()
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
DIM = "\033[90m"

lines = []
for item in boot:
    color = COLORS.get(item.get("type", "info"), "")
    text = item.get("text", "").replace("\\", "\\\\").replace('"', '\\"')
    lines.append(f'echo -e "{color}{text}{RESET}"')

lines.append(f'echo -e "{DIM}────────────────────────────────{RESET}"')
if LAB_LEVEL in {"MID", "SENIOR", "SRE"}:
    lines.append(f'echo -e "Type \\033[36mverify\\033[0m to check · \\033[33mhint disabled in {LAB_LEVEL}\\033[0m"')
else:
    lines.append(f'echo -e "Type \\033[36mverify\\033[0m to check · \\033[36mhint\\033[0m for hints"')
lines.append(f'echo -e "{DIM}────────────────────────────────{RESET}"')

with open("/root/.bashrc", "a") as f:
    f.write("\n# Boot sequence\n")
    f.write("\n".join(lines) + "\n")
PY

# Keep PID 1 alive so docker exec works.
exec tail -f /dev/null
