#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/rollback-failed-deploy"
mkdir -p "${LAB_ROOT}/releases/v1.3.9" "${LAB_ROOT}/releases/v1.4.0"

echo "healthy" > "${LAB_ROOT}/releases/v1.3.9/status.txt"
echo "broken" > "${LAB_ROOT}/releases/v1.4.0/status.txt"
echo "v1.4.0" > "${LAB_ROOT}/current_version"
echo "v1.3.9" > "${LAB_ROOT}/safe_version"
echo "failed" > "${LAB_ROOT}/deploy.state"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Rollback task:
1. Restore current_version to safe_version
2. Set deploy.state to rolled_back
3. Create rollback.complete with content ok
EOF
