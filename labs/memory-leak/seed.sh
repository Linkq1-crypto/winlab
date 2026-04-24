#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/memory-leak"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/leak.py" <<'PY'
import time

chunks = []
while True:
    chunks.append("X" * 1024 * 1024)
    time.sleep(0.2)
PY

pkill -f "${LAB_ROOT}/leak.py" >/dev/null 2>&1 || true
nohup python3 "${LAB_ROOT}/leak.py" >/tmp/winlab-memory-leak.log 2>&1 &
echo $! > "${LAB_ROOT}/leak.pid"

echo "memory-leak seeded; leaking process pid $(cat "${LAB_ROOT}/leak.pid")"
