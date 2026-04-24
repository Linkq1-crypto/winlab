#!/usr/bin/env bash
set -euo pipefail

pkill -f "fake_db.py" >/dev/null 2>&1 || true
rm -rf /opt/winlab/db-dead
