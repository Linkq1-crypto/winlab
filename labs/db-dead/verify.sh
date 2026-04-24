#!/usr/bin/env bash
set -euo pipefail

pgrep -f "fake_db.py" >/dev/null 2>&1 || exit 1
ss -ltn 2>/dev/null | grep -q ":5432 " || exit 1
