#!/usr/bin/env bash
set -euo pipefail

service nginx stop >/dev/null 2>&1 || true
service apache2 stop >/dev/null 2>&1 || true
pkill -f nginx >/dev/null 2>&1 || true
pkill -f apache2 >/dev/null 2>&1 || true

service apache2 start >/dev/null 2>&1 || apachectl start >/dev/null 2>&1 || true
touch /var/run/winlab/nginx-port-conflict.seeded

echo "nginx-port-conflict seeded; apache2 should now occupy port 80"
