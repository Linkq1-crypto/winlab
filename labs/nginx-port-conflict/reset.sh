#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/var/run/winlab/nginx-port-conflict.pid"

service apache2 stop >/dev/null 2>&1 || true
service nginx stop >/dev/null 2>&1 || true
pkill -f apache2 >/dev/null 2>&1 || true
pkill -f nginx >/dev/null 2>&1 || true
if [[ -f "${PID_FILE}" ]]; then
  kill "$(cat "${PID_FILE}")" >/dev/null 2>&1 || true
fi
rm -f "${PID_FILE}"
rm -f /var/run/winlab/nginx-port-conflict.seeded
