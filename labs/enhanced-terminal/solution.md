# enhanced-terminal — Solution

## INCIDENT SUMMARY
The application directory at `/opt/winlab/enhanced-terminal/app` is not writable, and a `cache.fill` file is blocking the temp directory. A guided recovery checklist is provided at `runbooks/checklist.txt`. All three steps must be completed to restore service.

## ROOT CAUSE
`seed.sh` creates two faults:
1. `/opt/winlab/enhanced-terminal/tmp/cache.fill` — a blocking file that should not exist
2. `/opt/winlab/enhanced-terminal/app` — set to mode `0555` (read-only), preventing the application from writing its state file

## FIX

```bash
# Step 1 — read the runbook
cat /opt/winlab/enhanced-terminal/runbooks/checklist.txt

# Step 2 — remove the cache blocker
rm /opt/winlab/enhanced-terminal/tmp/cache.fill

# Step 3 — restore write access to app/
chmod 755 /opt/winlab/enhanced-terminal/app

# Step 4 — write the mentor state file
echo "status=ready" > /opt/winlab/enhanced-terminal/app/.mentor

# Step 5 — verify all three conditions
[[ ! -f /opt/winlab/enhanced-terminal/tmp/cache.fill ]] && echo "cache clear"
[[ -w /opt/winlab/enhanced-terminal/app ]] && echo "app writable"
cat /opt/winlab/enhanced-terminal/app/.mentor
```

## WHY THIS FIX WORKED
Removing `cache.fill` unblocks the temp directory. `chmod 755` restores owner-write permission on `app/`. Writing `.mentor` confirms the application can write to its directory — exactly what the verifier tests.

## PRODUCTION LESSON
Always consult the runbook before making changes. A checklist-driven recovery reduces errors under pressure. In production, apply the principle of least privilege: application directories should be writable by the application user only. Use `lsattr` to check for immutable flags if `chmod` alone doesn't solve a write-permission issue.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/enhanced-terminal/runbooks/checklist.txt
rm /opt/winlab/enhanced-terminal/tmp/cache.fill
chmod 755 /opt/winlab/enhanced-terminal/app
echo "status=ready" > /opt/winlab/enhanced-terminal/app/.mentor
ls -la /opt/winlab/enhanced-terminal/app/
```

## MENTOR_HINTS
1. Application cannot write files and tmp is blocked → read the runbook at runbooks/checklist.txt
2. Runbook lists three steps → start with rm /opt/winlab/enhanced-terminal/tmp/cache.fill
3. cache.fill removed → restore write access: chmod 755 /opt/winlab/enhanced-terminal/app
4. Fix → rm /opt/winlab/enhanced-terminal/tmp/cache.fill && chmod 755 /opt/winlab/enhanced-terminal/app && echo "status=ready" > /opt/winlab/enhanced-terminal/app/.mentor
