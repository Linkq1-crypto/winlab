#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/winlab/db-connection-failure/app.env"

grep -q "^DB_HOST=127.0.0.1$" "${ENV_FILE}" || exit 1
grep -q "^DB_PORT=5432$" "${ENV_FILE}" || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/db-connection-failure/connection.state)" == "connected" ]] || exit 1
