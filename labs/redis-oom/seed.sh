#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/redis-oom"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/redis.conf" <<'EOF'
maxmemory 16mb
maxmemory-policy noeviction
EOF

fallocate -l 24M "${LAB_ROOT}/cache.rdb" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/cache.rdb" bs=1M count=24 status=none

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Redis OOM recovery:
1. Change maxmemory-policy to allkeys-lru in /opt/winlab/redis-oom/redis.conf
2. Shrink cache footprint by removing /opt/winlab/redis-oom/cache.rdb
3. Write stable to /opt/winlab/redis-oom/service.state
EOF

echo oom > "${LAB_ROOT}/service.state"
