#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/cloudflare-cache-purge/cache.state"
grep -q '^stale_asset=false$' "${FILE}" || exit 1
grep -q '^purge_status=completed$' "${FILE}" || exit 1
