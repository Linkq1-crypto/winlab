#!/usr/bin/env bash
set -euo pipefail

LAB_ID="${LAB_ID:-disk-full}"
LAB_DIR="/labs/${LAB_ID}"

echo "[winlab-lab-runner] booting generic runner"
echo "[winlab-lab-runner] LAB_ID=${LAB_ID}"

if [[ ! -d "${LAB_DIR}" ]]; then
  echo "[winlab-lab-runner] unknown lab: ${LAB_ID}" >&2
  exit 64
fi

if [[ ! -f "${LAB_DIR}/scenario.json" ]]; then
  echo "[winlab-lab-runner] missing scenario.json for ${LAB_ID}" >&2
  exit 65
fi

if [[ ! -x "${LAB_DIR}/seed.sh" || ! -x "${LAB_DIR}/verify.sh" || ! -x "${LAB_DIR}/reset.sh" ]]; then
  echo "[winlab-lab-runner] ${LAB_ID} is scenario-only or placeholder" >&2
  exit 66
fi

"${LAB_DIR}/reset.sh" >/dev/null 2>&1 || true
"${LAB_DIR}/seed.sh"

echo "[winlab-lab-runner] lab seeded; dropping into shell"
exec /bin/bash
