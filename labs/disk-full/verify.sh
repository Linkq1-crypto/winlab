#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/disk-full"

if [[ -f "${LAB_ROOT}/filler.img" ]]; then
  echo "disk-full still active: filler.img exists"
  exit 1
fi

echo "disk-full resolved"
exit 0
