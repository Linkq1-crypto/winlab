#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/db-dead"
mkdir -p "${LAB_ROOT}"

pkill -f "fake_db.py" >/dev/null 2>&1 || true

cat > "${LAB_ROOT}/fake_db.py" <<'PY'
import socket
import time

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
sock.bind(("0.0.0.0", 5432))
sock.listen(5)

while True:
    conn, _ = sock.accept()
    conn.sendall(b"WINLAB_FAKE_DB:OK\n")
    conn.close()
    time.sleep(0.05)
PY

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Database outage simulation:
- The fake database service should be listening on port 5432.
- Start it with:
  python3 /opt/winlab/db-dead/fake_db.py >/tmp/winlab-db-dead.log 2>&1 &
EOF

rm -f "${LAB_ROOT}/db.pid"
