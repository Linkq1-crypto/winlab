#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/sssd-ldap"
mkdir -p "${LAB_ROOT}" /etc/sssd

cat > /etc/sssd/sssd.conf <<'EOF'
[sssd]
services = nss, pam
domains = winlab.local

[domain/winlab.local]
id_provider = ldap
auth_provider = ldap
ldap_uri = ldap://offline.winlab.local
ldap_search_base = dc=winlab,dc=local
cache_credentials = false
EOF

chmod 0600 /etc/sssd/sssd.conf

cat > "${LAB_ROOT}/README.txt" <<'EOF'
SSSD LDAP recovery:
1. Fix /etc/sssd/sssd.conf
2. Set ldap_uri=ldap://directory.winlab.local
3. Set cache_credentials=true
4. Write online to /opt/winlab/sssd-ldap/directory.state
EOF

echo offline > "${LAB_ROOT}/directory.state"
