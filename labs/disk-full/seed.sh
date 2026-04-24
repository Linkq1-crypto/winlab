#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/disk-full"
mkdir -p "${LAB_ROOT}"
rm -f "${LAB_ROOT}/resolved.flag"
touch "${LAB_ROOT}/incident.flag"

if command -v fallocate >/dev/null 2>&1; then
  fallocate -l 64M "${LAB_ROOT}/filler.img" 2>/dev/null || true
fi

if [[ ! -f "${LAB_ROOT}/filler.img" ]]; then
  dd if=/dev/zero of="${LAB_ROOT}/filler.img" bs=1M count=64 status=none
fi

echo "Disk pressure simulated in ${LAB_ROOT}"
