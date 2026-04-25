#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/var/run/winlab/port-conflict.pid"
NGINX_SITE="/etc/nginx/conf.d/winlab-nginx-recovered.conf"
LOG_FILE="/tmp/winlab-nginx-port-conflict.log"

mkdir -p /var/run/winlab

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    kill "${OLD_PID}" >/dev/null 2>&1 || true
    wait "${OLD_PID}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
fi

nginx -s stop >/dev/null 2>&1 || true

cat > "${NGINX_SITE}" <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        default_type text/plain;
        return 200 "WinLab nginx recovered";
    }
}
EOF

nohup python3 -m http.server 80 >/dev/null 2>"${LOG_FILE}" &
CONFLICT_PID=$!
echo "${CONFLICT_PID}" > "${PID_FILE}"

sleep 1

if ! kill -0 "${CONFLICT_PID}" >/dev/null 2>&1; then
  echo "failed to start port conflict process" >&2
  cat "${LOG_FILE}" >&2 || true
  exit 1
fi

if ! ss -ltnp 2>/dev/null | grep -q ':80 '; then
  echo "failed to bind port 80 for nginx-port-conflict" >&2
  exit 1
fi

echo "nginx-port-conflict seeded; pid ${CONFLICT_PID} is holding port 80"
