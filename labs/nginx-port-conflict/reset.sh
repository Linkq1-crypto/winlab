#!/usr/bin/env bash
set -euo pipefail

service apache2 stop >/dev/null 2>&1 || true
service nginx stop >/dev/null 2>&1 || true
pkill -f apache2 >/dev/null 2>&1 || true
pkill -f nginx >/dev/null 2>&1 || true
rm -f /var/run/winlab/nginx-port-conflict.seeded
