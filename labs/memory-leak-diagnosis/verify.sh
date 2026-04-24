#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/memory-leak-diagnosis"
PID_FILE="${LAB_ROOT}/leak.pid"

[[ -f "${LAB_ROOT}/incident.report" ]] || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/incident.report")" == "root_cause=memory_leak" ]] || exit 1

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}")"
  if kill -0 "${PID}" >/dev/null 2>&1; then
    exit 1
  fi
fi
