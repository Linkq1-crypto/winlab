#!/usr/bin/env bash
set -euo pipefail

mkdir -p /opt/winlab/permission-denied/data
chown -R winlabapp:winlabapp /opt/winlab/permission-denied >/dev/null 2>&1 || true
chmod 0775 /opt/winlab/permission-denied/data
rm -f /opt/winlab/permission-denied/data/.verify
