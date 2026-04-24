#!/usr/bin/env bash
set -euo pipefail

pkill -f "diagnostic_leak.py" >/dev/null 2>&1 || true
rm -rf /opt/winlab/memory-leak-diagnosis
