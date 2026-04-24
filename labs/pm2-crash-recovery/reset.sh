#!/usr/bin/env bash
set -euo pipefail

pkill -f "pm2_demo.py" >/dev/null 2>&1 || true
rm -rf /opt/winlab/pm2-crash-recovery
