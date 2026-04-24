#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/opt/winlab/memory-leak/leak.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "memory-leak resolved"
  exit 0
fi

PID="$(cat "${PID_FILE}")"

if kill -0 "${PID}" >/dev/null 2>&1; then
  echo "memory-leak still active; process ${PID} running"
  exit 1
fi

echo "memory-leak resolved"
exit 0
