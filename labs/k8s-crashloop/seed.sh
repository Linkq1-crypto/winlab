#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/k8s-crashloop"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/deployment.yaml" <<'EOF'
livenessProbe: broken
imageTag: bad-build
podStatus: CrashLoopBackOff
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
K8s crashloop recovery:
1. Set livenessProbe=healthy
2. Set imageTag=stable
3. Set podStatus=Running
EOF
