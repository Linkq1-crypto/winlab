#!/usr/bin/env bash
set -euo pipefail

PORT_STATE="$(ss -ltnp 2>/dev/null | grep ':80 ' || true)"

if [[ "${PORT_STATE}" == *"nginx"* ]] && [[ "${PORT_STATE}" != *"apache2"* ]]; then
  echo "nginx-port-conflict resolved"
  exit 0
fi

echo "nginx-port-conflict still active"
echo "${PORT_STATE}"
exit 1
