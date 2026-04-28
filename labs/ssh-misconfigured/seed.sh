#!/usr/bin/env bash
set -euo pipefail

# Stop any running sshd
pkill sshd 2>/dev/null || true
sleep 0.3

mkdir -p /opt/winlab/ssh-misconfigured

cat > /opt/winlab/ssh-misconfigured/README.txt <<'EOF'
SSH Misconfigured — Service Recovery

Users have been unable to SSH into this server since last night's maintenance window.
The on-call team has confirmed the server is reachable on the network.

Your job:
  1. Diagnose why sshd is not accepting connections
  2. Fix the configuration
  3. Start sshd

Useful commands: ss -tlnp  /usr/sbin/sshd -t  cat /etc/ssh/sshd_config

Type hint for guidance · Type verify when done
EOF

# Write the broken sshd_config — two faults: wrong port + password auth disabled
cat > /etc/ssh/sshd_config <<'EOF'
# sshd_config — modified during maintenance 2026-04-28
Include /etc/ssh/sshd_config.d/*.conf

Port 2222
PasswordAuthentication no
PermitRootLogin yes
ChallengeResponseAuthentication no
UsePAM yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
EOF
