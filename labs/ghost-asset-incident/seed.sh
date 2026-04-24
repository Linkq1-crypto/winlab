#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/ghost-asset-incident"
mkdir -p "${LAB_ROOT}/assets" "${LAB_ROOT}/manifests"

echo "missing" > "${LAB_ROOT}/assets/logo.svg.state"
cat > "${LAB_ROOT}/manifests/assets.json" <<'EOF'
{
  "logo.svg": "missing",
  "app.js": "present"
}
EOF
echo "broken" > "${LAB_ROOT}/cdn.state"

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Ghost asset recovery:
1. Restore asset state for logo.svg in manifests/assets.json to present
2. Set assets/logo.svg.state to restored
3. Set cdn.state to warm
EOF
