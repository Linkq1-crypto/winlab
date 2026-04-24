#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/network-lab/routing.table"
grep -q '^api.internal via 10.0.0.10$' "${FILE}" || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/network-lab/network.state)" == "healthy" ]] || exit 1
