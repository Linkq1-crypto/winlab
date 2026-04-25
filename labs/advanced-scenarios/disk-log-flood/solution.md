# advanced-scenarios/disk-log-flood — Solution

> **Simulated incident.** This lab simulates a disk flood by creating a 48 MB log file at `/opt/winlab/advanced-scenarios/logs/app.log`. No real application or filesystem is affected. Verification checks that the lab directory is under 8 MB total. The production lesson maps directly to real runaway log management.

## INCIDENT SUMMARY
A runaway application log has consumed nearly all available disk space. `/opt/winlab/advanced-scenarios/logs/app.log` is 48 MB and growing. The directory must be brought below 8 MB and the service state set to `clear`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/logs/app.log` is 48 MB.

A process is writing log lines without rotation or size limits. In production this pattern causes `ENOSPC` errors, crashing any service that writes to disk — including the logger itself, databases, and the OS swap mechanism.

## FIX

```bash
# Step 1 — check disk usage
du -sh /opt/winlab/advanced-scenarios/
du -sh /opt/winlab/advanced-scenarios/logs/

# Step 2 — remove the flood log
rm -f /opt/winlab/advanced-scenarios/logs/app.log

# Step 3 — mark the service clear
echo clear > /opt/winlab/advanced-scenarios/service.state

# Step 4 — confirm directory is under 8 MB
du -sm /opt/winlab/advanced-scenarios/
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
Removing `app.log` frees the disk space occupied by the flood. In production, after freeing space, you would also configure log rotation (`logrotate`) and add an alerting rule for disk usage > 80%.

## PRODUCTION LESSON
Runaway logs are the most common cause of sudden disk-full incidents. Prevent them with: (1) `logrotate` with `maxsize` and `daily` rotation — `/etc/logrotate.d/app`; (2) structured logging with a size-capped output (e.g. `winston` `maxsize` option); (3) disk usage alerts at 80% and 90% thresholds; (4) `lsof | grep deleted` to find processes holding file descriptors to deleted log files (they keep consuming space until the process is restarted). After a disk-full incident, always audit what grew.

## COMMANDS TO REMEMBER
```bash
# In this lab:
rm -f /opt/winlab/advanced-scenarios/logs/app.log
echo clear > /opt/winlab/advanced-scenarios/service.state

# On real systems:
df -h                                      # check disk usage by mount
du -sh /var/log/* | sort -rh | head -20    # find largest log directories
lsof | grep deleted                        # files deleted but still open
truncate -s 0 /var/log/app.log            # zero a log without restarting the app
logrotate -f /etc/logrotate.d/app          # force immediate rotation
```

## MENTOR_HINTS
1. Disk is nearly full and logs are growing rapidly → check du -sh on /opt/winlab/advanced-scenarios/logs/
2. app.log is 48 MB and consuming all available space → remove it to free disk
3. After clearing the log, the service can restart cleanly → set service.state to clear
4. Fix → rm -f /opt/winlab/advanced-scenarios/logs/app.log && echo clear > /opt/winlab/advanced-scenarios/service.state
