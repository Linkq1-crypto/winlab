#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/linux-terminal"

[[ -f "${LAB_ROOT}/archive/incident.log" ]] || exit 1
[[ ! -f "${LAB_ROOT}/incoming/incident.log" ]] || exit 1
[[ -f "${LAB_ROOT}/archive/recovered.flag" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/archive/recovered.flag")" == "linux-terminal-ok" ]] || exit 1
