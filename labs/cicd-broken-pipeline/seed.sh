#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/cicd-broken-pipeline"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/pipeline.env" <<'EOF'
CI_SECRET=
DEPLOY_ENV=staging
EOF

echo "failed" > "${LAB_ROOT}/pipeline.state"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Pipeline recovery:
1. Fill CI_SECRET in /opt/winlab/cicd-broken-pipeline/pipeline.env with any non-empty value
2. Set DEPLOY_ENV=production
3. Set pipeline.state to passed
EOF
