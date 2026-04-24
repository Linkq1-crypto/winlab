#!/usr/bin/env bash
set -euo pipefail

grep -q "^ldap_uri = ldap://directory.winlab.local$" /etc/sssd/sssd.conf || exit 1
grep -q "^cache_credentials = true$" /etc/sssd/sssd.conf || exit 1
[[ "$(tr -d '\r\n' < /opt/winlab/sssd-ldap/directory.state)" == "online" ]] || exit 1
