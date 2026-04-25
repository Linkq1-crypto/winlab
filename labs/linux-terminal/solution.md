# linux-terminal — Solution

## INCIDENT SUMMARY
An incident log file is stuck in the `incoming/` intake queue and has not been archived. The filesystem intake is stalled. The recovery procedure requires moving the log to `archive/` and creating a `recovered.flag` marker to confirm the action.

## ROOT CAUSE
`/opt/winlab/linux-terminal/incoming/incident.log` exists and has not been moved to `archive/`. The intake pipeline is blocked — any new logs cannot be processed while old ones remain in `incoming/`. The `archive/recovered.flag` marker is absent, indicating no recovery action has been taken.

## FIX

```bash
# Step 1 — confirm the incident log is in incoming/
ls /opt/winlab/linux-terminal/incoming/
ls /opt/winlab/linux-terminal/archive/

# Step 2 — move the log to archive
mv /opt/winlab/linux-terminal/incoming/incident.log \
   /opt/winlab/linux-terminal/archive/

# Step 3 — create the recovery flag
echo "linux-terminal-ok" > /opt/winlab/linux-terminal/archive/recovered.flag

# Step 4 — confirm
ls /opt/winlab/linux-terminal/archive/
cat /opt/winlab/linux-terminal/archive/recovered.flag
```

## WHY THIS FIX WORKED
Moving the file clears the intake queue. The `recovered.flag` with the exact content `linux-terminal-ok` is the verifiable signal that recovery was performed intentionally and not by accident.

## PRODUCTION LESSON
Log pipelines must include dead-letter handling for files that fail processing. Use inotify-based watchers (like `incron` or a custom daemon) with a maximum retry count and a separate dead-letter directory. Always use `mv` rather than `cp` to ensure atomic delivery — `cp` followed by `rm` risks duplication if interrupted.

## COMMANDS TO REMEMBER
```bash
ls /opt/winlab/linux-terminal/incoming/                  # check intake queue
mv incoming/incident.log archive/                        # move atomically
echo "linux-terminal-ok" > archive/recovered.flag        # write recovery marker
cat archive/recovered.flag                               # verify content
```

## MENTOR_HINTS
1. Intake pipeline is stalled → check incoming/ for unprocessed files
2. incident.log is in incoming/ and has not been archived → move it to archive/
3. File moved → create the recovered.flag with the exact content linux-terminal-ok
4. Fix → mv /opt/winlab/linux-terminal/incoming/incident.log /opt/winlab/linux-terminal/archive/ && echo linux-terminal-ok > /opt/winlab/linux-terminal/archive/recovered.flag
