#!/usr/bin/env bash
set -euo pipefail

pkill sshd 2>/dev/null || true
rm -rf /opt/winlab/ssh-misconfigured

# Restore a clean sshd_config
cat > /etc/ssh/sshd_config <<'EOF'
Include /etc/ssh/sshd_config.d/*.conf

Port 22
PasswordAuthentication yes
PermitRootLogin yes
ChallengeResponseAuthentication no
UsePAM yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
EOF
