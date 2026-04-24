#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/var/run/winlab/nginx-port-conflict.pid"

service nginx stop >/dev/null 2>&1 || true
service apache2 stop >/dev/null 2>&1 || true
pkill -f nginx >/dev/null 2>&1 || true
pkill -f apache2 >/dev/null 2>&1 || true
rm -f "${PID_FILE}"

# Keep the scenario realistic without depending on init/systemd inside the container:
# bind port 80 with a process named "apache2" so the learner must free the port first.
nohup bash -lc 'exec -a apache2 python3 -m http.server 80 >/tmp/winlab-nginx-port-conflict.log 2>&1' &
echo $! > "${PID_FILE}"

sleep 1

if ! ss -ltnp 2>/dev/null | grep -q ':80 '; then
  echo "failed to bind port 80 for nginx-port-conflict" >&2
  exit 1
fi

touch /var/run/winlab/nginx-port-conflict.seeded

echo "nginx-port-conflict seeded; apache2 should now occupy port 80"
