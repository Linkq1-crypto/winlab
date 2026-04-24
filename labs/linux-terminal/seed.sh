#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/linux-terminal"
mkdir -p "${LAB_ROOT}/incoming" "${LAB_ROOT}/archive"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Linux Terminal recovery task:
1. Move incident.log from incoming/ to archive/
2. Create archive/recovered.flag with the exact content:
   linux-terminal-ok
EOF

cat > "${LAB_ROOT}/incoming/incident.log" <<'EOF'
[incident] filesystem intake stalled
[action] archive the incident log and mark recovery complete
EOF

rm -f "${LAB_ROOT}/archive/recovered.flag"
