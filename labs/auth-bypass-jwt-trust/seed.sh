#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/auth-bypass-jwt-trust"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/auth.js" <<'EOF'
export function getAccess(payload, verifySignature) {
  if (!verifySignature) {
    return payload.role || "guest";
  }
  return payload.role;
}
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Fix JWT trust:
1. Do not trust payload.role when signature is not verified
2. Add marker JWT_SIGNATURE_REQUIRED=true
EOF
