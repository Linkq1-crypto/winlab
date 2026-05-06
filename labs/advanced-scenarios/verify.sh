#!/usr/bin/env bash
set -euo pipefail

WINLAB_SERVICES='["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"]'

signal() {
  echo "WINLAB_SIGNAL $1"
}

emit_winlab_initial_signals() {
  signal '{"type":"affected_services_update","services":["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"],"source":"verify"}'
  signal '{"type":"service_health","services":["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"],"status":"degraded","progress":68,"source":"verify"}'
  signal '{"type":"phase_update","phase":"validation","progress":82,"source":"verify"}'
}

emit_winlab_verify_exit() {
  local status="${1:-0}"
  if [[ "${status}" -eq 0 ]]; then
    signal '{"type":"service_health","services":["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"],"status":"recovering","progress":92,"source":"verify"}'
    signal '{"type":"phase_update","phase":"recovery","progress":92,"source":"verify"}'
    signal '{"type":"service_health","services":["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"],"status":"healthy","progress":100,"source":"verify"}'
    signal '{"type":"verification_result","status":"passed","summary":"Validation checks passed for Nginx, Edge Tls, Mysql, Cron Worker, Jvm App, Storage Volume.","source":"verify"}'
  else
    signal '{"type":"service_health","services":["nginx","edge-tls","mysql","cron-worker","jvm-app","storage-volume"],"status":"failed","progress":82,"source":"verify"}'
    signal '{"type":"verification_result","status":"failed","summary":"Validation checks failed for Nginx, Edge Tls, Mysql, Cron Worker, Jvm App, Storage Volume.","source":"verify"}'
  fi
}

emit_winlab_on_exit() {
  local status="$?"
  trap - EXIT
  emit_winlab_verify_exit "${status}"
  exit "${status}"
}

emit_winlab_initial_signals
trap emit_winlab_on_exit EXIT

LAB_ROOT="/opt/winlab/advanced-scenarios"
VARIANT="${LAB_VARIANT:-nginx-php-user-mismatch}"

case "${VARIANT}" in
  nginx-php-user-mismatch)
    grep -q "^user=www-data$" "${LAB_ROOT}/php-fpm.conf" || exit 1
    grep -q "^group=www-data$" "${LAB_ROOT}/php-fpm.conf" || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "healthy" ]] || exit 1
    ;;
  mysql-replica-deadlock)
    grep -q "^sql_thread=running$" "${LAB_ROOT}/replica.status" || exit 1
    grep -q "^replication_delay=0$" "${LAB_ROOT}/replica.status" || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "synced" ]] || exit 1
    ;;
  disk-log-flood)
    TOTAL_MB="$(du -sm "${LAB_ROOT}" | awk '{print $1}')"
    [[ "${TOTAL_MB}" -le 8 ]] || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "clear" ]] || exit 1
    ;;
  ssl-chain-expired)
    grep -q "^CN=advanced.winlab.local$" "${LAB_ROOT}/certificate.pem" || exit 1
    grep -Eq "^not_after=2027-" "${LAB_ROOT}/certificate.pem" || exit 1
    grep -q "^chain=valid$" "${LAB_ROOT}/certificate.pem" || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "renewed" ]] || exit 1
    ;;
  cron-stopped-jobs)
    grep -q "^cron=running$" "${LAB_ROOT}/scheduler.state" || exit 1
    grep -q "^backup_job=scheduled$" "${LAB_ROOT}/scheduler.state" || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "resumed" ]] || exit 1
    ;;
  java-oom)
    grep -q "^-Xmx512m$" "${LAB_ROOT}/jvm.options" || exit 1
    [[ "$(tr -d '\r\n' < "${LAB_ROOT}/service.state")" == "stable" ]] || exit 1
    ;;
  *)
    exit 64
    ;;
esac
