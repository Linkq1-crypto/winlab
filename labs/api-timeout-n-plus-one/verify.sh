#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/api-timeout-n-plus-one/ordersService.js"
grep -q 'BATCHED_USER_LOOKUP=true' "${FILE}" || exit 1
grep -q 'findByIds' "${FILE}" || exit 1
if grep -q 'order.user = await db.users.findById' "${FILE}"; then
  exit 1
fi
