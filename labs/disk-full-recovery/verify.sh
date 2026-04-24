#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/disk-full-recovery"
TOTAL_MB="$(du -sm "${LAB_ROOT}" | awk '{print $1}')"

[[ "${TOTAL_MB}" -le 8 ]] || exit 1
[[ -f "${LAB_ROOT}/recovery.report" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/recovery.report")" == "cleared=true" ]] || exit 1
