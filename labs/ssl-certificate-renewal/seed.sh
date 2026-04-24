#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/ssl-certificate-renewal"
mkdir -p "${LAB_ROOT}/certs"

cat > "${LAB_ROOT}/certs/current.pem" <<'EOF'
CN=app.winlab.local
not_after=2024-01-01T00:00:00Z
issuer=WINLAB-LOCAL-CA
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
SSL certificate renewal:
1. Update /opt/winlab/ssl-certificate-renewal/certs/current.pem
2. Keep CN=app.winlab.local
3. Set not_after to a future date, recommended 2027-01-01T00:00:00Z
4. Write renewed to /opt/winlab/ssl-certificate-renewal/cert.state
EOF

echo expired > "${LAB_ROOT}/cert.state"
