#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/db-connection-failure"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/app.env" <<'EOF'
DB_HOST=db.internal
DB_PORT=9999
DB_NAME=winlab
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Database connection recovery:
1. Edit /opt/winlab/db-connection-failure/app.env
2. Set DB_HOST=127.0.0.1
3. Set DB_PORT=5432
4. Write connected to /opt/winlab/db-connection-failure/connection.state
EOF

echo disconnected > "${LAB_ROOT}/connection.state"
