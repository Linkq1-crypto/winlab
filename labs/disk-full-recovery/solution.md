# disk-full-recovery — Solution

## INCIDENT SUMMARY
The application directory at `/opt/winlab/disk-full-recovery` is consuming over 64 MB: a 48 MB cache blob and a 16 MB bloated error log. The recovery procedure requires freeing space below 8 MB total and writing a `recovery.report` to confirm the action was intentional.

## ROOT CAUSE
Two files were created to simulate uncontrolled growth:
- `cache/blob.bin` — 48 MB stale cache file never evicted
- `logs/error.log` — 16 MB log file never rotated

Neither file serves any current purpose. Both can be removed safely.

## FIX

```bash
# Step 1 — measure current usage
du -sh /opt/winlab/disk-full-recovery/*

# Step 2 — remove the cache blob
rm /opt/winlab/disk-full-recovery/cache/blob.bin

# Step 3 — remove the oversized log
rm /opt/winlab/disk-full-recovery/logs/error.log

# Step 4 — confirm usage is below 8 MB
du -sm /opt/winlab/disk-full-recovery/

# Step 5 — write the recovery report
echo cleared=true > /opt/winlab/disk-full-recovery/recovery.report
```

## WHY THIS FIX WORKED
Removing the two large files brought the directory below the 8 MB threshold required by the verifier. The `recovery.report` flag confirms the recovery was deliberate, not accidental.

## PRODUCTION LESSON
In production, never blindly delete log files — truncate instead if the process still has the file open: `truncate -s 0 /path/to/error.log`. Implement log rotation with `logrotate` and cache TTLs to prevent recurrence. On Kubernetes, set `emptyDir` size limits on cache volumes.

## COMMANDS TO REMEMBER
```bash
du -sh /opt/winlab/disk-full-recovery/*   # sizes of all items
rm cache/blob.bin logs/error.log           # remove the faults
du -sm /opt/winlab/disk-full-recovery/    # verify total < 8 MB
echo cleared=true > recovery.report       # write completion marker
```

## MENTOR_HINTS
1. Directory is over quota → run du -sh /opt/winlab/disk-full-recovery/* to find what's large
2. cache/blob.bin (48 MB) and logs/error.log (16 MB) are the culprits → remove both
3. Both files deleted, but verify total is under 8 MB → du -sm /opt/winlab/disk-full-recovery/
4. Fix → rm cache/blob.bin logs/error.log && echo cleared=true > /opt/winlab/disk-full-recovery/recovery.report
