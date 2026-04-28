#!/usr/bin/env bash
set -euo pipefail

# Stop any running apache2
pkill apache2 2>/dev/null || true
sleep 0.3

mkdir -p /opt/winlab/apache-config-error

cat > /opt/winlab/apache-config-error/README.txt <<'EOF'
Apache Config Error — Service Recovery

Apache2 went down after last night's config change. Users are getting connection refused on port 80.

Your job:
  1. Diagnose why apache2 will not start
  2. Fix the configuration error
  3. Start apache2

Type hint for guidance · Type verify when done
EOF

# Write the broken virtual host config
cat > /etc/apache2/conf-enabled/winlab.conf <<'EOF'
# winlab site config — deployed 2026-04-28 maintenance window
ServerNaame web01.lab.internal
DocumentRoot /var/www/html

<Directory /var/www/html>
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>
EOF

# Ensure default site exists so apache has something to serve
a2ensite 000-default 2>/dev/null || true
