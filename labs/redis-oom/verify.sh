#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/redis-oom"

grep -q "^maxmemory-policy allkeys-lru$" "${LAB_ROOT}/redis.conf" || exit 1
[[ ! -f "${LAB_ROOT}/cache.rdb" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "stable" ]] || exit 1
