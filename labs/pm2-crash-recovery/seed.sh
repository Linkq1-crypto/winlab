#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/pm2-crash-recovery"
mkdir -p "${LAB_ROOT}"

pkill -f "pm2_demo.py" >/dev/null 2>&1 || true

cat > "${LAB_ROOT}/pm2_demo.py" <<'PY'
import http.server
import socketserver

PORT = 4001

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"pm2-demo-online")

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    httpd.serve_forever()
PY

cat > "${LAB_ROOT}/start-app.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
nohup python3 /opt/winlab/pm2-crash-recovery/pm2_demo.py >/tmp/winlab-pm2.log 2>&1 &
echo $! > /opt/winlab/pm2-crash-recovery/app.pid
echo online > /opt/winlab/pm2-crash-recovery/pm2.status
EOF
chmod +x "${LAB_ROOT}/start-app.sh"

echo crashed > "${LAB_ROOT}/pm2.status"
rm -f "${LAB_ROOT}/app.pid"
