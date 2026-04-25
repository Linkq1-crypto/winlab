# real-server/oomkiller — Solution

> **Simulated incident.** This lab fixes a local OOM report file at `/opt/winlab/real-server/oom.report`. No real process is killed. Verification checks the file contents only.

## INCIDENT SUMMARY
The kernel OOM killer has terminated the `nginx` process due to a heap leak in a worker. The server is out of memory and further processes are at risk. The heap leak must be contained, nginx restarted, and the OOM report updated to `victim=none` and `heap=contained`, with the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/oom.report` contains:
```
victim=nginx
heap=leaking
```

A memory leak in the nginx worker process caused its RSS to grow until the kernel OOM killer selected it as the eviction target. After the kill, nginx is down and no new connections are accepted.

## FIX

```bash
# Step 1 — inspect the OOM report
cat /opt/winlab/real-server/oom.report

# Step 2 — mark nginx as the (now-restarted) victim
sed -i 's/^victim=nginx$/victim=none/' \
  /opt/winlab/real-server/oom.report

# Step 3 — mark the heap as contained
sed -i 's/^heap=leaking$/heap=contained/' \
  /opt/winlab/real-server/oom.report

# Step 4 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 5 — confirm
cat /opt/winlab/real-server/oom.report
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `victim=none` confirms nginx has been restarted and is no longer the OOM victim. `heap=contained` records that the leak has been patched (a module update or configuration change that eliminates the allocation). The service is now running without unbounded memory growth.

## PRODUCTION LESSON
The OOM killer's selection is logged in `/var/log/kern.log` or `dmesg | grep -i oom`. After a kill, restart the service and then investigate the leak: `valgrind --leak-check=full` for C binaries; `node --expose-gc` + heapdump for Node.js; `py-spy` for Python. Set `oom_score_adj` to protect critical processes (lower score = harder to kill): `echo -1000 > /proc/<pid>/oom_score_adj`. Add memory limits in the systemd unit (`MemoryMax=`) so a leak cannot affect the host. Set memory alerts at 80% and 90% of available RAM.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/victim=nginx/victim=none/;s/heap=leaking/heap=contained/' \
  /opt/winlab/real-server/oom.report
echo stable > /opt/winlab/real-server/service.state

# On real systems:
dmesg | grep -i oom                                  # OOM killer log
journalctl -k | grep -i "out of memory"              # kernel OOM events
free -h                                              # current memory usage
ps aux --sort=-%mem | head -20                      # top memory consumers
echo -1000 > /proc/<pid>/oom_score_adj              # protect critical process
```

## MENTOR_HINTS
1. OOM killer fired and nginx was killed → read /opt/winlab/real-server/oom.report to see what was killed and why
2. victim=nginx and heap=leaking mean a memory leak caused the OOM kill → patch the leak and restart nginx
3. After patching the leak and restarting nginx, update victim=none and heap=contained
4. Fix → sed -i 's/victim=nginx/victim=none/;s/heap=leaking/heap=contained/' /opt/winlab/real-server/oom.report && echo stable > /opt/winlab/real-server/service.state
