#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/cicd-broken-pipeline"
ENV_FILE="${LAB_ROOT}/pipeline.env"

grep -Eq "^CI_SECRET=.+$" "${ENV_FILE}" || exit 1
grep -q "^DEPLOY_ENV=production$" "${ENV_FILE}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/pipeline.state")" == "passed" ]] || exit 1
