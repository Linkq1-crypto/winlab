#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/api-timeout-n-plus-one"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/ordersService.js" <<'EOF'
export async function loadOrders(db) {
  const orders = await db.orders.findMany();
  for (const order of orders) {
    order.user = await db.users.findById(order.userId);
  }
  return orders;
}
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Fix the N+1 pattern:
1. Replace per-order db.users.findById with a batched lookup
2. Add the marker BATCHED_USER_LOOKUP=true
EOF
