#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/disk-full-recovery"
mkdir -p "${LAB_ROOT}/cache" "${LAB_ROOT}/logs"

fallocate -l 48M "${LAB_ROOT}/cache/blob.bin" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/cache/blob.bin" bs=1M count=48 status=none
fallocate -l 16M "${LAB_ROOT}/logs/error.log" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/logs/error.log" bs=1M count=16 status=none

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Disk recovery task:
1. Free enough space by cleaning cache or logs under /opt/winlab/disk-full-recovery
2. Write cleared=true to /opt/winlab/disk-full-recovery/recovery.report
EOF

rm -f "${LAB_ROOT}/recovery.report"
