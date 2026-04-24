#!/usr/bin/env bash
set -euo pipefail

rm -f /etc/nginx/conf.d/winlab-reload.conf
pkill nginx >/dev/null 2>&1 || true
rm -rf /opt/winlab/nginx-reload
