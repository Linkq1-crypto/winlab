#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/apache-ssl"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/vhost.conf" <<'EOF'
SSLEngine on
SSLCertificateFile /etc/ssl/winlab/expired.pem
SSLCertificateKeyFile /etc/ssl/winlab/server.key
SSLProtocol all -SSLv3
EOF

echo expired > "${LAB_ROOT}/cert.state"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Apache SSL recovery:
1. Point SSLCertificateFile to /etc/ssl/winlab/current.pem
2. Set cert.state to active
EOF
