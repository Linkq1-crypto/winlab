#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/opt/winlab/memory-leak/leak.pid"

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}")"
  kill "${PID}" >/dev/null 2>&1 || true
fi

rm -rf /opt/winlab/memory-leak
