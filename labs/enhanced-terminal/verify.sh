#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/enhanced-terminal"

[[ ! -f "${LAB_ROOT}/tmp/cache.fill" ]] || exit 1
[[ -w "${LAB_ROOT}/app" ]] || exit 1
[[ -f "${LAB_ROOT}/app/.mentor" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/app/.mentor")" == "status=ready" ]] || exit 1
