#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/enhanced-terminal"
mkdir -p "${LAB_ROOT}/app" "${LAB_ROOT}/tmp" "${LAB_ROOT}/runbooks"

cat > "${LAB_ROOT}/runbooks/checklist.txt" <<'EOF'
Guided recovery checklist:
1. Remove /opt/winlab/enhanced-terminal/tmp/cache.fill
2. Restore write access on /opt/winlab/enhanced-terminal/app
3. Write status=ready to /opt/winlab/enhanced-terminal/app/.mentor
EOF

touch "${LAB_ROOT}/tmp/cache.fill"
chmod 0555 "${LAB_ROOT}/app"
rm -f "${LAB_ROOT}/app/.mentor"
