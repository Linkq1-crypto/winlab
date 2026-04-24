#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/nginx-reload"
mkdir -p "${LAB_ROOT}"

cat > /etc/nginx/conf.d/winlab-reload.conf <<'EOF'
server {
    listen 8080;
    server_name _;
    location / {
        return 200 "reload pending"
    }
}
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Nginx reload task:
1. Fix /etc/nginx/conf.d/winlab-reload.conf
2. Validate configuration with nginx -t
3. Reload nginx
EOF

nginx >/dev/null 2>&1 || true
