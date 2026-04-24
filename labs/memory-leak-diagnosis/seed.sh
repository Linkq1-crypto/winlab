#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/memory-leak-diagnosis"
mkdir -p "${LAB_ROOT}"

pkill -f "diagnostic_leak.py" >/dev/null 2>&1 || true

cat > "${LAB_ROOT}/diagnostic_leak.py" <<'PY'
import time

chunks = []
while True:
    chunks.append("X" * 1024 * 1024)
    time.sleep(0.1)
PY

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Memory leak diagnosis task:
1. Stop the leaking process.
2. Write root_cause=memory_leak to /opt/winlab/memory-leak-diagnosis/incident.report
EOF

nohup python3 "${LAB_ROOT}/diagnostic_leak.py" >/tmp/winlab-memory-diagnosis.log 2>&1 &
echo $! > "${LAB_ROOT}/leak.pid"
rm -f "${LAB_ROOT}/incident.report"
