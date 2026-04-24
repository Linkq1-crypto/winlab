#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/ghost-asset-incident"

grep -q '"logo.svg": "present"' "${LAB_ROOT}/manifests/assets.json" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/assets/logo.svg.state")" == "restored" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/cdn.state")" == "warm" ]] || exit 1
