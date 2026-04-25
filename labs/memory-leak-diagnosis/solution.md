# memory-leak-diagnosis — Solution

## INCIDENT SUMMARY
A Python process (`diagnostic_leak.py`) is consuming memory at 1 MB per 100ms with no upper bound. The task requires stopping the process AND documenting the root cause in a structured incident report so the on-call handoff is complete.

## ROOT CAUSE
`/opt/winlab/memory-leak-diagnosis/diagnostic_leak.py` appends 1 MB strings in an infinite loop:

```python
chunks = []
while True:
    chunks.append("X" * 1024 * 1024)
    time.sleep(0.1)
```

No eviction, no cap, no cleanup — the Python garbage collector cannot free memory that still has a live reference in `chunks`.

## FIX

```bash
# Step 1 — find the process
pgrep -f diagnostic_leak.py
# or
cat /opt/winlab/memory-leak-diagnosis/leak.pid

# Step 2 — confirm memory growth
top -p "$(cat /opt/winlab/memory-leak-diagnosis/leak.pid)"

# Step 3 — kill the process
kill "$(cat /opt/winlab/memory-leak-diagnosis/leak.pid)"

# Step 4 — confirm it stopped
pgrep -f diagnostic_leak.py || echo "stopped"

# Step 5 — write the incident report
echo root_cause=memory_leak > /opt/winlab/memory-leak-diagnosis/incident.report
```

## WHY THIS FIX WORKED
Killing the process terminates the allocation loop. The incident report (`root_cause=memory_leak`) is the structured handoff artefact — in production this would trigger a post-mortem and a code fix ticket.

## PRODUCTION LESSON
Every memory incident needs both an immediate mitigation (kill/restart) and a root cause document. Without the report, the leak will recur in the next deploy. Use `tracemalloc` in Python to pinpoint which allocation dominates. In containers, set `memory.limit_in_bytes` to force a clean OOM kill rather than gradual node degradation.

## COMMANDS TO REMEMBER
```bash
pgrep -f diagnostic_leak.py                                    # find by name
cat /opt/winlab/memory-leak-diagnosis/leak.pid                 # read pid
kill "$(cat /opt/winlab/memory-leak-diagnosis/leak.pid)"       # stop it
echo root_cause=memory_leak > /opt/winlab/memory-leak-diagnosis/incident.report
```

## MENTOR_HINTS
1. Memory is growing fast → identify the process with pgrep -f diagnostic_leak.py or ps aux
2. diagnostic_leak.py is confirmed running, PID in leak.pid → observe with top, then kill it
3. Process killed → complete the incident report as part of the handoff
4. Fix → kill "$(cat /opt/winlab/memory-leak-diagnosis/leak.pid)" && echo root_cause=memory_leak > /opt/winlab/memory-leak-diagnosis/incident.report
