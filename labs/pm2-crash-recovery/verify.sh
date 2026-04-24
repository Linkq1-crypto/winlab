#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/pm2-crash-recovery"

[[ -f "${LAB_ROOT}/pm2.status" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/pm2.status")" == "online" ]] || exit 1
ss -ltn 2>/dev/null | grep -q ":4001 " || exit 1
