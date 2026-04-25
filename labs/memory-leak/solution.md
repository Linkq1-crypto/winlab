# memory-leak — Solution

## INCIDENT SUMMARY
A Python process is consuming memory without bound. The process runs `leak.py`, which appends 1 MB strings in an infinite loop. Its PID is stored in `/opt/winlab/memory-leak/leak.pid`. Memory will exhaust until the process is killed.

## ROOT CAUSE
`/opt/winlab/memory-leak/leak.py` allocates 1 MB per iteration with no upper bound and no cleanup:

```python
chunks = []
while True:
    chunks.append("X" * 1024 * 1024)
    time.sleep(0.2)
```

The process keeps a reference to every chunk, preventing garbage collection.

## FIX

```bash
# Step 1 — confirm the process is running
cat /opt/winlab/memory-leak/leak.pid
ps aux | grep leak.py

# Step 2 — observe memory growth
top -p "$(cat /opt/winlab/memory-leak/leak.pid)"

# Step 3 — kill the process
kill "$(cat /opt/winlab/memory-leak/leak.pid)"

# Step 4 — confirm it's gone
ps aux | grep leak.py
```

## WHY THIS FIX WORKED
Killing the process releases all memory held by the Python heap. The pid file is the canonical reference for the running process — always use it rather than grepping by name in production to avoid killing wrong PIDs.

## PRODUCTION LESSON
Memory leaks in Python are usually caused by unbounded caches, event listeners not removed, or objects accumulated in global scope. Use `memory_profiler` or `tracemalloc` to identify the source. Add memory usage metrics to your APM and alert at 80% of container limit. Set `resources.limits.memory` in Kubernetes to force OOM kills before the node is affected.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/memory-leak/leak.pid           # read the pid
ps aux | grep leak.py                          # verify the process
top -p <pid>                                   # watch memory growth live
kill <pid>                                     # terminate the process
kill "$(cat /opt/winlab/memory-leak/leak.pid)" # one-liner using pid file
```

## MENTOR_HINTS
1. Memory is growing unbounded → find the leaking process with ps aux or top
2. leak.py is the culprit, PID is in /opt/winlab/memory-leak/leak.pid → read the pid file
3. Process is confirmed running → kill it using the stored PID
4. Fix → kill "$(cat /opt/winlab/memory-leak/leak.pid)"
