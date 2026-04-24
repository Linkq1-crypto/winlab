#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/k8s-node-notready"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/node.status" <<'EOF'
Ready=False
Kubelet=stopped
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
K8s node recovery:
1. Set Ready=True
2. Set Kubelet=running
EOF
