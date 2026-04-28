#!/usr/bin/env bash
set -euo pipefail

# sshd config must be valid
/usr/sbin/sshd -t || exit 1

# sshd must be running
pgrep -x sshd > /dev/null || exit 1

# sshd must be listening on port 22 (not 2222)
ss -tlnp | grep -q ':22 ' || exit 1

# PasswordAuthentication must be enabled
/usr/sbin/sshd -T 2>/dev/null | grep -q '^passwordauthentication yes' || exit 1
