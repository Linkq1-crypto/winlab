#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/deploy-new-version"

[[ "$(tr -d '\r\n' < "${LAB_ROOT}/current_version")" == "v1.2.0" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/releases/v1.2.0/status.txt")" == "healthy" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/deploy.state")" == "complete" ]] || exit 1
