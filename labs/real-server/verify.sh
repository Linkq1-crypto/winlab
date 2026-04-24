#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/real-server"
VARIANT="${LAB_VARIANT:-iowait}"
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "stable" ]] || exit 1

case "${VARIANT}" in
  iowait)
    [[ ! -f "${LAB_ROOT}/hot-disk.img" ]] || exit 1
    ;;
  apachewrk)
    grep -q "^current_workers=90$" "${LAB_ROOT}/apache.status" || exit 1
    ;;
  mysqlslow)
    grep -q "^slow_queries=0$" "${LAB_ROOT}/mysql.processlist" || exit 1
    ;;
  netflap)
    grep -q "^eth0=up$" "${LAB_ROOT}/nic.state" || exit 1
    grep -q "^carrier=stable$" "${LAB_ROOT}/nic.state" || exit 1
    ;;
  timewait)
    grep -q "^time_wait=500$" "${LAB_ROOT}/socket.state" || exit 1
    grep -q "^port_exhaustion=false$" "${LAB_ROOT}/socket.state" || exit 1
    ;;
  tcpdump)
    grep -q "^suspicious_connection=false$" "${LAB_ROOT}/capture.summary" || exit 1
    ;;
  strace)
    grep -q "^root_cause=lock_cleared$" "${LAB_ROOT}/hung-process.trace" || exit 1
    ;;
  coredump)
    grep -q "^analysis=completed$" "${LAB_ROOT}/coredump.report" || exit 1
    ;;
  syslogflood)
    TOTAL_MB="$(du -sm "${LAB_ROOT}" | awk '{print $1}')"
    [[ "${TOTAL_MB}" -le 4 ]] || exit 1
    ;;
  fsck)
    grep -q "^ext4=clean$" "${LAB_ROOT}/filesystem.state" || exit 1
    grep -q "^repair=completed$" "${LAB_ROOT}/filesystem.state" || exit 1
    ;;
  oomkiller)
    grep -q "^victim=none$" "${LAB_ROOT}/oom.report" || exit 1
    grep -q "^heap=contained$" "${LAB_ROOT}/oom.report" || exit 1
    ;;
  infoblox)
    grep -q "^resolver=healthy$" "${LAB_ROOT}/dns.state" || exit 1
    grep -q "^dhcp=healthy$" "${LAB_ROOT}/dns.state" || exit 1
    ;;
  *)
    exit 64
    ;;
esac
