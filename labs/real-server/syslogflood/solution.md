# real-server/syslogflood — Solution

> **Simulated incident.** This lab simulates a syslog flood by creating a 32 MB file at `/opt/winlab/real-server/syslog.spam`. No real syslog is affected. Verification checks the directory is under 4 MB total. The production lesson maps to real log flood management.

## INCIDENT SUMMARY
A process is flooding syslog at thousands of messages per second. The spam file has grown to 32 MB. The flood log must be removed, the directory brought below 4 MB, and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/syslog.spam` is a 32 MB file representing syslog messages from a misbehaving process. Left unchecked, the flood will fill the disk partition and cause other services to fail when they cannot write logs or temporary files.

## FIX

```bash
# Step 1 — check log usage
du -sh /opt/winlab/real-server/syslog.spam
du -sm /opt/winlab/real-server/

# Step 2 — remove the flood file
rm -f /opt/winlab/real-server/syslog.spam

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm directory is under 4 MB
du -sm /opt/winlab/real-server/
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Removing the spam file immediately frees 32 MB of disk space. In production, the next step is to identify and throttle the log-flooding process so it cannot refill the disk.

## PRODUCTION LESSON
A syslog flood is identified with `journalctl -f` (watch live) or `journalctl --since "5 min ago" | awk '{print $5}' | sort | uniq -c | sort -rn | head -10` to find the top message source. Once identified, suppress the process's logging: for rsyslog, add a filter in `/etc/rsyslog.d/` to drop messages from that PID/program. For systemd-journald, use `journalctl --vacuum-size=500M` to cap the journal. Fix the root cause (a tight retry loop, a misconfigured debug level) and then remove the filter. Rate limiting: `net.core.netdev_max_backlog` and `SystemMaxUse=` in `/etc/systemd/journald.conf`.

## COMMANDS TO REMEMBER
```bash
# In this lab:
rm -f /opt/winlab/real-server/syslog.spam
echo stable > /opt/winlab/real-server/service.state

# On real systems:
journalctl -f                                          # live syslog stream
journalctl --disk-usage                                # journal disk usage
journalctl --vacuum-size=200M                          # cap journal size
tail -f /var/log/syslog | awk '{print $5}' | uniq -c  # count by process
```

## MENTOR_HINTS
1. Syslog is filling disk rapidly → check du -sh on /opt/winlab/real-server/ to find the flood file
2. syslog.spam is 32 MB and represents a flooding process writing thousands of log lines → remove it
3. After removing the flood file the directory drops below 4 MB → set service.state to stable
4. Fix → rm -f /opt/winlab/real-server/syslog.spam && echo stable > /opt/winlab/real-server/service.state
