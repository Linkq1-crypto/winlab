#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/var/run/winlab/port-conflict.pid"

if [[ -f "${PID_FILE}" ]]; then
  CONFLICT_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${CONFLICT_PID}" ]] && kill -0 "${CONFLICT_PID}" >/dev/null 2>&1; then
    echo "VERIFY_FAIL port conflict still active (pid ${CONFLICT_PID})"
    exit 1
  fi
fi

nginx -t >/dev/null 2>&1 || {
  echo "VERIFY_FAIL nginx config invalid"
  exit 1
}

BODY="$(curl -fsS http://localhost/ 2>/dev/null || true)"
if [[ "${BODY}" != "WinLab nginx recovered" ]]; then
  echo "VERIFY_FAIL nginx response mismatch"
  exit 1
fi

echo "VERIFY_OK nginx recovered"
