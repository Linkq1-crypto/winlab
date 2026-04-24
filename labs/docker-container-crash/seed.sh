#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/docker-container-crash"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/container.state" <<'EOF'
restart_policy=no
status=exited
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Docker crash recovery:
1. Set restart_policy=unless-stopped
2. Set status=running
EOF
