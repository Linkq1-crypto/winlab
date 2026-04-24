#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/winlab/env-var-update/app.env"

grep -q "^APP_MODE=production$" "${ENV_FILE}" || exit 1
grep -q "^FEATURE_LOGIN=enabled$" "${ENV_FILE}" || exit 1
