#!/usr/bin/env bash
set -euo pipefail

LAB_ID="${LAB_ID:-}"
LAB_VARIANT="${LAB_VARIANT:-}"
LAB_DIR="/labs/${LAB_ID}"

# ── Validate ──────────────────────────────────────────────────────────────────
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

# ── Boot ──────────────────────────────────────────────────────────────────────
echo "[entrypoint] lab=${LAB_ID}${LAB_VARIANT:+ variant=${LAB_VARIANT}}"

# Idempotent teardown of any previous state (silent — expected to be clean)
"${LAB_DIR}/reset.sh" >/dev/null 2>&1 || true

# Inject the broken state the student must fix
echo "[entrypoint] seeding…"
"${LAB_DIR}/seed.sh"
echo "[entrypoint] ready"

# Keep PID 1 alive so docker exec works.
# tail -f /dev/null is used instead of sleep infinity for broader compatibility.
exec tail -f /dev/null
