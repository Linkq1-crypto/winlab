#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/real-server"
VARIANT="${LAB_VARIANT:-iowait}"

mkdir -p "${LAB_ROOT}"
echo "${VARIANT}" > "${LAB_ROOT}/active.variant"

case "${VARIANT}" in
  iowait)
    fallocate -l 64M "${LAB_ROOT}/hot-disk.img" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/hot-disk.img" bs=1M count=64 status=none
    echo degraded > "${LAB_ROOT}/service.state"
    cat > "${LAB_ROOT}/README.txt" <<'EOF'
Reduce I/O pressure:
1. Remove /opt/winlab/real-server/hot-disk.img
2. Write stable to /opt/winlab/real-server/service.state
EOF
    ;;
  apachewrk)
    cat > "${LAB_ROOT}/apache.status" <<'EOF'
MaxRequestWorkers=150
current_workers=150
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  mysqlslow)
    cat > "${LAB_ROOT}/mysql.processlist" <<'EOF'
slow_queries=78
longest_query_ms=18220
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  netflap)
    cat > "${LAB_ROOT}/nic.state" <<'EOF'
eth0=flapping
carrier=unstable
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  timewait)
    cat > "${LAB_ROOT}/socket.state" <<'EOF'
time_wait=28000
port_exhaustion=true
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  tcpdump)
    cat > "${LAB_ROOT}/capture.summary" <<'EOF'
suspicious_connection=true
source=198.51.100.24
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  strace)
    cat > "${LAB_ROOT}/hung-process.trace" <<'EOF'
waiting_on=/srv/shared/lockfile
root_cause=unknown
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  coredump)
    cat > "${LAB_ROOT}/coredump.report" <<'EOF'
binary=api-gateway
analysis=pending
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  syslogflood)
    fallocate -l 32M "${LAB_ROOT}/syslog.spam" 2>/dev/null || dd if=/dev/zero of="${LAB_ROOT}/syslog.spam" bs=1M count=32 status=none
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  fsck)
    cat > "${LAB_ROOT}/filesystem.state" <<'EOF'
ext4=dirty
repair=required
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  oomkiller)
    cat > "${LAB_ROOT}/oom.report" <<'EOF'
victim=nginx
heap=leaking
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  infoblox)
    cat > "${LAB_ROOT}/dns.state" <<'EOF'
resolver=timeout
dhcp=degraded
EOF
    echo degraded > "${LAB_ROOT}/service.state"
    ;;
  *)
    echo "unknown variant: ${VARIANT}" >&2
    exit 64
    ;;
esac

if [[ ! -f "${LAB_ROOT}/README.txt" ]]; then
  cat > "${LAB_ROOT}/README.txt" <<EOF
Real-server variant: ${VARIANT}
1. Edit the matching state file under /opt/winlab/real-server
2. Resolve the degraded condition for ${VARIANT}
3. Write stable to /opt/winlab/real-server/service.state
EOF
fi
