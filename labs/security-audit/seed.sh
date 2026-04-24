#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/security-audit"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/audit.report" <<'EOF'
ssh_root_login=enabled
world_writable_backup=true
status=failed
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Security audit remediation:
1. Set ssh_root_login=disabled
2. Set world_writable_backup=false
3. Set status=passed
EOF
