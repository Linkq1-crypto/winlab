#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/advanced-scenarios"
VARIANT="${LAB_VARIANT:-nginx-php-user-mismatch}"

mkdir -p "${LAB_ROOT}"
echo "${VARIANT}" > "${LAB_ROOT}/active.variant"

case "${VARIANT}" in
  nginx-php-user-mismatch)
    cat > "${LAB_ROOT}/php-fpm.conf" <<'EOF'
user=apache
group=apache
listen=/run/php-fpm.sock
EOF
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Fix the PHP-FPM config:
1. Set user=www-data
2. Set group=www-data
3. Write healthy to /opt/winlab/advanced-scenarios/service.state
EOF
    echo broken > "${LAB_ROOT}/service.state"
    ;;
  mysql-replica-deadlock)
    cat > "${LAB_ROOT}/replica.status" <<'EOF'
sql_thread=stopped
last_error=1213 deadlock found
replication_delay=900
EOF
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Restore replication:
1. Set sql_thread=running
2. Set replication_delay=0
3. Write synced to /opt/winlab/advanced-scenarios/service.state
EOF
    echo lagging > "${LAB_ROOT}/service.state"
    ;;
  disk-log-flood)
    mkdir -p "${LAB_ROOT}/logs"
    fallocate -l 48M "${LAB_ROOT}/logs/app.log" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/logs/app.log" bs=1M count=48 status=none
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Stop the log flood:
1. Reduce /opt/winlab/advanced-scenarios below 8 MB
2. Write clear to /opt/winlab/advanced-scenarios/service.state
EOF
    echo saturated > "${LAB_ROOT}/service.state"
    ;;
  ssl-chain-expired)
    cat > "${LAB_ROOT}/certificate.pem" <<'EOF'
CN=advanced.winlab.local
not_after=2024-01-01T00:00:00Z
chain=expired
EOF
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Renew the certificate chain:
1. Keep CN=advanced.winlab.local
2. Set not_after to a 2027 date
3. Set chain=valid
4. Write renewed to /opt/winlab/advanced-scenarios/service.state
EOF
    echo expired > "${LAB_ROOT}/service.state"
    ;;
  cron-stopped-jobs)
    cat > "${LAB_ROOT}/scheduler.state" <<'EOF'
cron=stopped
backup_job=missed
EOF
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Restore scheduled jobs:
1. Set cron=running
2. Set backup_job=scheduled
3. Write resumed to /opt/winlab/advanced-scenarios/service.state
EOF
    echo stalled > "${LAB_ROOT}/service.state"
    ;;
  java-oom)
    cat > "${LAB_ROOT}/jvm.options" <<'EOF'
-Xms128m
-Xmx128m
-XX:+UseSerialGC
EOF
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Stabilize the JVM:
1. Increase -Xmx to 512m
2. Write stable to /opt/winlab/advanced-scenarios/service.state
EOF
    echo oom > "${LAB_ROOT}/service.state"
    ;;
  *)
    echo "unknown variant: ${VARIANT}" >&2
    exit 64
    ;;
esac
