#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/raid-simulator"
DETAIL="${LAB_ROOT}/mdadm.detail"

grep -q "^       State : clean$" "${DETAIL}" || exit 1
grep -q "^     Total Devices : 2$" "${DETAIL}" || exit 1
grep -q "^Failed Devices : 0$" "${DETAIL}" || exit 1
grep -q "active sync   /dev/sdb1" "${DETAIL}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/array.state")" == "rebuilt" ]] || exit 1
