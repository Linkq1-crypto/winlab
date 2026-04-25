# advanced-scenarios/mysql-replica-deadlock — Solution

> **Simulated incident.** This lab fixes a local replica status file at `/opt/winlab/advanced-scenarios/replica.status`. No real MySQL is running. Verification checks the file contents only. The production lesson maps directly to real MySQL replication recovery.

## INCIDENT SUMMARY
The MySQL replica SQL thread has stopped with error 1213 (deadlock) and replication is lagging by 900 seconds. The replica is not applying changes from the primary, causing data divergence. The SQL thread must be restarted by fixing the status file and the replication delay cleared, with the service state set to `synced`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/replica.status` contains:
```
sql_thread=stopped
last_error=1213 deadlock found
replication_delay=900
```

A deadlock on the replica SQL thread caused it to stop applying the binlog. MySQL stops the thread rather than retrying indefinitely to avoid applying events out of order. The 900-second lag accumulated while the thread was stopped.

## FIX

```bash
# Step 1 — inspect the replica status
cat /opt/winlab/advanced-scenarios/replica.status

# Step 2 — restart the SQL thread
sed -i 's/^sql_thread=stopped$/sql_thread=running/' \
  /opt/winlab/advanced-scenarios/replica.status

# Step 3 — clear the replication delay
sed -i 's/^replication_delay=900$/replication_delay=0/' \
  /opt/winlab/advanced-scenarios/replica.status

# Step 4 — mark the service synced
echo synced > /opt/winlab/advanced-scenarios/service.state

# Step 5 — confirm
cat /opt/winlab/advanced-scenarios/replica.status
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
Setting `sql_thread=running` resumes binlog application. The deadlocked transaction is retried (or skipped if GTID is used). Once the replica catches up to the primary, `replication_delay` returns to 0 and the service is healthy.

## PRODUCTION LESSON
On real MySQL: `SHOW REPLICA STATUS\G` reveals the stopped thread and the error. For a 1213 deadlock, run `STOP REPLICA SQL_THREAD; START REPLICA SQL_THREAD;` — MySQL retries the deadlocked transaction. If the error recurs, skip with `SET GLOBAL SQL_SLAVE_SKIP_COUNTER=1` (non-GTID) or `SET GTID_NEXT='<uuid>:<n>'; BEGIN; COMMIT; SET GTID_NEXT='AUTOMATIC';` (GTID). Always alert on `Seconds_Behind_Source > 60` — a growing lag means the replica is falling behind under write load.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/sql_thread=stopped/sql_thread=running/;s/replication_delay=900/replication_delay=0/' \
  /opt/winlab/advanced-scenarios/replica.status
echo synced > /opt/winlab/advanced-scenarios/service.state

# On real MySQL:
SHOW REPLICA STATUS\G                             -- check thread status and lag
STOP REPLICA SQL_THREAD; START REPLICA SQL_THREAD; -- restart SQL thread
SHOW PROCESSLIST;                                  -- see running queries
```

## MENTOR_HINTS
1. Replication is stopped with a deadlock error → read /opt/winlab/advanced-scenarios/replica.status to see the thread state and delay
2. sql_thread=stopped means the replica has halted binlog application → set it to running
3. replication_delay=900 shows how far behind the replica fell → reset it to 0
4. Fix → sed -i 's/sql_thread=stopped/sql_thread=running/;s/replication_delay=900/replication_delay=0/' /opt/winlab/advanced-scenarios/replica.status && echo synced > /opt/winlab/advanced-scenarios/service.state
