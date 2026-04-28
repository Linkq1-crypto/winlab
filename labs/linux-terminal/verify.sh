#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/linux-terminal"

# incident.log must have been moved to archive/
[[ -f "${LAB_ROOT}/archive/incident.log" ]] || exit 1
[[ ! -f "${LAB_ROOT}/incoming/incident.log" ]] || exit 1

# incident.log must be readable by its owner (chmod was applied)
[[ "$(stat -c "%A" "${LAB_ROOT}/archive/incident.log" | cut -c2)" == "r" ]] || exit 1

# recovery flag must exist with the exact required content
[[ -f "${LAB_ROOT}/archive/recovered.flag" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/archive/recovered.flag")" == "linux-terminal-ok" ]] || exit 1
