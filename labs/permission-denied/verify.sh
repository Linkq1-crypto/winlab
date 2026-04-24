#!/usr/bin/env bash
set -euo pipefail

TARGET="/opt/winlab/permission-denied/data/.verify"

if su -s /bin/bash -c "touch '${TARGET}'" winlabapp >/dev/null 2>&1; then
  rm -f "${TARGET}"
  echo "permission-denied resolved"
  exit 0
fi

echo "permission-denied still active"
exit 1
