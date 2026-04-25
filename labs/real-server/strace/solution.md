# real-server/strace — Solution

> **Simulated incident.** This lab fixes a local process trace file at `/opt/winlab/real-server/hung-process.trace`. No real strace is run. Verification checks the file contents only.

## INCIDENT SUMMARY
A process is hung waiting on a lock file at `/srv/shared/lockfile`. The root cause is unknown. The lock must be cleared and the root cause recorded as `lock_cleared`, with the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/hung-process.trace` contains:
```
waiting_on=/srv/shared/lockfile
root_cause=unknown
```

The process is blocked in a `flock()` or `open()` syscall on `/srv/shared/lockfile`. Either the process that acquired the lock crashed without releasing it, or two processes are deadlocked waiting for each other's lock.

## FIX

```bash
# Step 1 — inspect the hung process trace
cat /opt/winlab/real-server/hung-process.trace

# Step 2 — record the resolved root cause
sed -i 's/^root_cause=unknown$/root_cause=lock_cleared/' \
  /opt/winlab/real-server/hung-process.trace

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
cat /opt/winlab/real-server/hung-process.trace
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `root_cause=lock_cleared` records that the stale lock file was identified and removed (in production: `rm -f /srv/shared/lockfile`), unblocking the waiting process. The service resumes normal operation.

## PRODUCTION LESSON
A hung process blocked on a lock is identified with `strace -p <pid>` — look for `flock(...)` or `open(..., O_RDWR|O_CREAT)` that never returns. Confirm with `lsof /srv/shared/lockfile` — the PID holding the lock is shown. If the lock holder is dead (zombie or missing from process list), the lock is stale: `rm -f /srv/shared/lockfile` releases the waiting process. For advisory locks (`flock`), the kernel releases them automatically when the file descriptor is closed — a crash that closes all FDs releases the lock immediately. Stale lock files only occur with PID-file locks (where the content is a PID number) or filesystem locks.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/root_cause=unknown/root_cause=lock_cleared/' \
  /opt/winlab/real-server/hung-process.trace
echo stable > /opt/winlab/real-server/service.state

# On real systems:
strace -p <pid>                          # trace syscalls of hung process
lsof /srv/shared/lockfile               # which process holds the lock
fuser /srv/shared/lockfile              # PIDs using the file
rm -f /srv/shared/lockfile             # remove stale lock
ls -la /proc/<pid>/fd/ | grep lockfile  # confirm FD is open
```

## MENTOR_HINTS
1. A process is hung and not responding → read /opt/winlab/real-server/hung-process.trace to see what it is waiting for
2. waiting_on=/srv/shared/lockfile means the process is blocked on a lock held by another process that may have crashed
3. Identify the lock holder with lsof, remove the stale lock file, and the hung process unblocks
4. Fix → sed -i 's/root_cause=unknown/root_cause=lock_cleared/' /opt/winlab/real-server/hung-process.trace && echo stable > /opt/winlab/real-server/service.state
