#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/blue-green-deploy"

[[ "$(tr -d '\r\n' < "${LAB_ROOT}/green.health")" == "healthy" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/live_slot")" == "green" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/deploy.state")" == "switched" ]] || exit 1
