#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/network-lab"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/routing.table" <<'EOF'
default via 10.0.0.254 dev eth0
api.internal unreachable
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Network routing recovery:
1. Replace api.internal unreachable with api.internal via 10.0.0.10
2. Write healthy to /opt/winlab/network-lab/network.state
EOF

echo degraded > "${LAB_ROOT}/network.state"
