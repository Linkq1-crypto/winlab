#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/blue-green-deploy"
mkdir -p "${LAB_ROOT}"

echo "blue" > "${LAB_ROOT}/live_slot"
echo "green" > "${LAB_ROOT}/candidate_slot"
echo "warming" > "${LAB_ROOT}/green.health"
echo "stable" > "${LAB_ROOT}/blue.health"
echo "switch_pending" > "${LAB_ROOT}/deploy.state"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Blue/green task:
1. Mark green.health as healthy
2. Switch live_slot to green
3. Set deploy.state to switched
EOF
