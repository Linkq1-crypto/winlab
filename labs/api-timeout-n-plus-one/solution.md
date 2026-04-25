# api-timeout-n-plus-one — Solution

## INCIDENT SUMMARY
The orders endpoint is timing out under load. The root cause is an N+1 query pattern: for each order returned from the database, a separate `findById` call fetches the associated user. 100 orders = 101 queries. The fix is to batch all user lookups into a single `findByIds` call, and add the `BATCHED_USER_LOOKUP=true` marker.

## ROOT CAUSE
`/opt/winlab/api-timeout-n-plus-one/ordersService.js` contains:

```js
export async function loadOrders(db) {
  const orders = await db.orders.findMany();
  for (const order of orders) {
    order.user = await db.users.findById(order.userId);
  }
  return orders;
}
```

Each iteration of the loop issues a separate synchronous `await` to the database. For N orders, this produces N+1 total queries. At scale, each query adds latency and connection overhead, causing cascading timeouts.

## FIX

```bash
cat > /opt/winlab/api-timeout-n-plus-one/ordersService.js <<'EOF'
// BATCHED_USER_LOOKUP=true
export async function loadOrders(db) {
  const orders = await db.orders.findMany();
  const userIds = orders.map(o => o.userId);
  const users = await db.users.findByIds(userIds);
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  for (const order of orders) {
    order.user = userMap[order.userId];
  }
  return orders;
}
EOF
```

## WHY THIS FIX WORKED
`findByIds` issues a single query with an `IN (...)` clause, fetching all users at once. Building a `userMap` keyed by `id` makes the per-order lookup O(1). Total queries drop from N+1 to 2, eliminating the timeout.

## PRODUCTION LESSON
N+1 is the most common cause of unexpected database timeouts in production. Use an ORM with eager loading (`include`/`JOIN`) or a DataLoader-style batching layer. Add query count logging in staging: if a single request issues more than 10 queries, investigate before deploying. Use `EXPLAIN ANALYZE` in PostgreSQL to profile the actual query plan.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/api-timeout-n-plus-one/ordersService.js  # inspect the pattern
# Fix: collect all userIds first, then call findByIds() once
# Add: // BATCHED_USER_LOOKUP=true
# Remove: the await db.users.findById(order.userId) inside the loop
```

## MENTOR_HINTS
1. API is timing out under load → read ordersService.js to understand the query pattern
2. Each order triggers a separate db.users.findById() call → this is an N+1 pattern
3. Replace the per-order loop query with a single batched findByIds() call
4. Fix → collect userIds from all orders, call db.users.findByIds(userIds), build a map, attach users per order, add BATCHED_USER_LOOKUP=true
