#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/rollback-failed-deploy"

[[ "$(tr -d '\r\n' < "${LAB_ROOT}/current_version")" == "v1.3.9" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/deploy.state")" == "rolled_back" ]] || exit 1
[[ -f "${LAB_ROOT}/rollback.complete" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/rollback.complete")" == "ok" ]] || exit 1
