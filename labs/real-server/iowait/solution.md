# real-server/iowait — Solution

> **Simulated incident.** This lab simulates I/O pressure by creating a 64 MB file at `/opt/winlab/real-server/hot-disk.img`. No real disk I/O is generated. Verification checks the file is gone and service.state is stable.

## INCIDENT SUMMARY
The server is showing high I/O wait, causing application latency spikes. A large file is saturating disk throughput. The file must be removed and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/hot-disk.img` is a 64 MB file consuming all available disk throughput, causing the kernel to block CPU on I/O. Any process reading or writing disk during the flood experiences elevated wait times.

## FIX

```bash
# Step 1 — identify the I/O source
du -sh /opt/winlab/real-server/hot-disk.img

# Step 2 — remove the file causing I/O pressure
rm -f /opt/winlab/real-server/hot-disk.img

# Step 3 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 4 — confirm
ls /opt/winlab/real-server/
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Removing the file immediately stops the I/O workload. The kernel I/O scheduler clears its queue, iowait drops to baseline, and application response times normalise.

## PRODUCTION LESSON
High iowait is diagnosed with `iostat -x 1` — look at `%iowait` and `util` per device. Find the culprit process with `iotop -o` (shows only actively I/O-bound processes). Common causes: runaway log writes, a database doing a full table scan, or a backup job running during peak hours. Schedule heavy I/O jobs (`rsync`, `mysqldump`) outside peak windows and use `ionice -c 3` to lower their I/O priority.

## COMMANDS TO REMEMBER
```bash
# In this lab:
rm -f /opt/winlab/real-server/hot-disk.img
echo stable > /opt/winlab/real-server/service.state

# On real systems:
iostat -x 1 5          # I/O stats per device, 5 samples
iotop -o               # top-like view of I/O per process
lsof +D /path          # which processes have files open in a directory
ionice -c 3 -p <pid>   # lower I/O priority of a process
```

## MENTOR_HINTS
1. Server shows high iowait and application is slow → check du -sh on /opt/winlab/real-server/ to find the large file
2. hot-disk.img is a 64 MB file saturating disk throughput → remove it
3. After removing the file, I/O pressure drops immediately → set service.state to stable
4. Fix → rm -f /opt/winlab/real-server/hot-disk.img && echo stable > /opt/winlab/real-server/service.state
