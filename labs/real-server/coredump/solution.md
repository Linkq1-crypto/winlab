# real-server/coredump — Solution

> **Simulated incident.** This lab fixes a local core dump report file at `/opt/winlab/real-server/coredump.report`. No real core dump analysis is performed. Verification checks the file contents only.

## INCIDENT SUMMARY
The `api-gateway` binary has crashed and left a core dump. The crash cause is pending analysis. The report must be updated to `analysis=completed` after identifying the crash reason, and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/coredump.report` contains:
```
binary=api-gateway
analysis=pending
```

The `api-gateway` process terminated abnormally (segfault, assertion failure, or out-of-memory kill) and the kernel wrote a core dump. The dump has not yet been analysed, leaving the root cause unknown.

## FIX

```bash
# Step 1 — inspect the core dump report
cat /opt/winlab/real-server/coredump.report

# Step 2 — mark analysis completed
sed -i 's/^analysis=pending$/analysis=completed/' \
  /opt/winlab/real-server/coredump.report

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
cat /opt/winlab/real-server/coredump.report
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `analysis=completed` records that the core dump was analysed (in production: using `gdb` or `coredumpctl`), the crash cause identified, and the service restarted cleanly.

## PRODUCTION LESSON
Enable core dumps: `ulimit -c unlimited` or `DefaultLimitCORE=infinity` in the systemd unit. Find the dump with `coredumpctl list` (systemd) or in `/var/crash/`. Analyse with `gdb /usr/bin/api-gateway /path/to/core` — run `bt full` for a full backtrace. Look for the crashing frame: buffer overflow, null pointer dereference, or stack corruption. For Go binaries, check for panics in the journal: `journalctl -u api-gateway | grep panic`. After fixing the root cause, verify the process is healthy with a readiness probe before closing the incident.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/analysis=pending/analysis=completed/' /opt/winlab/real-server/coredump.report
echo stable > /opt/winlab/real-server/service.state

# On real systems:
coredumpctl list                                   # list collected dumps
coredumpctl gdb api-gateway                        # open dump in gdb
gdb -c /path/to/core /usr/bin/api-gateway          # manual gdb
(gdb) bt full                                      # full backtrace
journalctl -u api-gateway --since "1 hour ago"     # recent service logs
```

## MENTOR_HINTS
1. api-gateway has crashed and left a core dump → read /opt/winlab/real-server/coredump.report to see the analysis state
2. analysis=pending means the crash cause has not been identified yet → analyse the core dump with gdb
3. Run gdb on the core dump, identify the crashing frame, fix the root cause, and restart the service
4. Fix → sed -i 's/analysis=pending/analysis=completed/' /opt/winlab/real-server/coredump.report && echo stable > /opt/winlab/real-server/service.state
