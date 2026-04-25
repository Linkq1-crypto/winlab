#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/var/run/winlab/port-conflict.pid"
NGINX_SITE="/etc/nginx/conf.d/winlab-nginx-recovered.conf"

if [[ -f "${PID_FILE}" ]]; then
  CONFLICT_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${CONFLICT_PID}" ]] && kill -0 "${CONFLICT_PID}" >/dev/null 2>&1; then
    kill "${CONFLICT_PID}" >/dev/null 2>&1 || true
    wait "${CONFLICT_PID}" 2>/dev/null || true
  fi
fi

rm -f "${PID_FILE}"
rm -f "${NGINX_SITE}"
nginx -s stop >/dev/null 2>&1 || true
