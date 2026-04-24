#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/cloudflare-cache-purge"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/cache.state" <<'EOF'
stale_asset=true
purge_status=pending
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Cloudflare purge recovery:
1. Set stale_asset=false
2. Set purge_status=completed
EOF
