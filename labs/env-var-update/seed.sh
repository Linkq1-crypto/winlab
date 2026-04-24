#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/env-var-update"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/app.env" <<'EOF'
APP_MODE=broken
FEATURE_LOGIN=disabled
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Environment update task:
1. Edit /opt/winlab/env-var-update/app.env
2. Set APP_MODE=production
3. Set FEATURE_LOGIN=enabled
EOF
