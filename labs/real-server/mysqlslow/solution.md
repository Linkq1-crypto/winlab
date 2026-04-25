# real-server/mysqlslow — Solution

> **Simulated incident.** This lab fixes a local MySQL process list file at `/opt/winlab/real-server/mysql.processlist`. No real MySQL is running. Verification checks the file contents only.

## INCIDENT SUMMARY
MySQL is running 78 slow queries, with the longest taking 18 seconds. Application response times are degraded. The slow query count must be cleared to 0 and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/mysql.processlist` contains:
```
slow_queries=78
longest_query_ms=18220
```

A query or set of queries is performing full table scans or missing index lookups, causing each to take 18+ seconds. 78 concurrent slow queries saturate the MySQL thread pool and starve faster queries.

## FIX

```bash
# Step 1 — inspect the slow query state
cat /opt/winlab/real-server/mysql.processlist

# Step 2 — clear the slow query count (queries resolved after adding index)
sed -i 's/^slow_queries=78$/slow_queries=0/' \
  /opt/winlab/real-server/mysql.processlist

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
cat /opt/winlab/real-server/mysql.processlist
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `slow_queries=0` represents the state after killing the slow queries and adding a missing index. The thread pool is free, fast queries resume normal execution times.

## PRODUCTION LESSON
Enable the slow query log: `SET GLOBAL slow_query_log=ON; SET GLOBAL long_query_time=1;`. Then use `mysqldumpslow -s t /var/log/mysql/slow.log | head -20` to find the worst offenders. Run `EXPLAIN SELECT ...` on each — look for `type=ALL` (full scan) and `rows` in the millions. Fix with `CREATE INDEX idx_name ON table(column)`. Kill blocking queries with `KILL QUERY <id>` from `SHOW PROCESSLIST`. On Aurora/RDS, use Performance Insights to identify the top SQL statements.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/slow_queries=78/slow_queries=0/' /opt/winlab/real-server/mysql.processlist
echo stable > /opt/winlab/real-server/service.state

# On real MySQL:
SHOW PROCESSLIST;                                  -- active queries
SHOW GLOBAL STATUS LIKE 'Slow_queries';            -- slow query counter
SET GLOBAL slow_query_log=ON;                      -- enable slow log
EXPLAIN SELECT * FROM orders WHERE user_id=42;     -- check query plan
KILL QUERY <id>;                                   -- kill a specific query
```

## MENTOR_HINTS
1. MySQL response times are degraded and slow queries are accumulating → read /opt/winlab/real-server/mysql.processlist
2. slow_queries=78 with longest at 18 seconds means a query is doing a full table scan → it needs an index
3. After adding the index, slow queries resolve and the count drops to 0
4. Fix → sed -i 's/slow_queries=78/slow_queries=0/' /opt/winlab/real-server/mysql.processlist && echo stable > /opt/winlab/real-server/service.state
