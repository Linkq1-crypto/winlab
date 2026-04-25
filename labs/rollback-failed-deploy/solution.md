# rollback-failed-deploy — Solution

## INCIDENT SUMMARY
A deployment to v1.4.0 has failed. `deploy.state` reads `failed` and `current_version` points to the broken release. A known-good version v1.3.9 exists at `releases/v1.3.9/` with `status.txt=healthy`. The rollback must restore `current_version` to v1.3.9, update `deploy.state` to `rolled_back`, and create `rollback.complete` to confirm the action.

## ROOT CAUSE
`v1.4.0` was deployed without a verified health check gate. The release at `releases/v1.4.0/status.txt` is `broken`, meaning the post-deploy smoke test failed. No automated rollback was triggered. `current_version` was left pointing at the broken release.

## FIX

```bash
# Step 1 — inspect the current state
cat /opt/winlab/rollback-failed-deploy/current_version
cat /opt/winlab/rollback-failed-deploy/deploy.state
cat /opt/winlab/rollback-failed-deploy/releases/v1.4.0/status.txt

# Step 2 — confirm the safe version exists and is healthy
cat /opt/winlab/rollback-failed-deploy/safe_version
cat /opt/winlab/rollback-failed-deploy/releases/v1.3.9/status.txt

# Step 3 — roll back current_version
echo v1.3.9 > /opt/winlab/rollback-failed-deploy/current_version

# Step 4 — update deploy state
echo rolled_back > /opt/winlab/rollback-failed-deploy/deploy.state

# Step 5 — create rollback completion marker
echo ok > /opt/winlab/rollback-failed-deploy/rollback.complete
```

## WHY THIS FIX WORKED
Restoring `current_version` to the last known-good release and updating the state files mirrors a real rollback operation — reverting the deploy pointer without touching the code. The `rollback.complete` marker triggers downstream monitoring to clear the incident.

## PRODUCTION LESSON
Every deploy pipeline must have an automated rollback gate: if health checks fail within N minutes, roll back automatically. Store the previous version in a `safe_version` file (or a Git tag) before every deploy. Rollbacks should take less than 60 seconds — if they don't, your deploy process is too slow.

## COMMANDS TO REMEMBER
```bash
cat /opt/winlab/rollback-failed-deploy/current_version
cat /opt/winlab/rollback-failed-deploy/safe_version
echo v1.3.9 > /opt/winlab/rollback-failed-deploy/current_version
echo rolled_back > /opt/winlab/rollback-failed-deploy/deploy.state
echo ok > /opt/winlab/rollback-failed-deploy/rollback.complete
```

## MENTOR_HINTS
1. Deploy has failed, current_version is v1.4.0 → check safe_version for the last known-good release
2. safe_version is v1.3.9 and its status.txt is healthy → restore current_version to v1.3.9
3. current_version restored → update deploy.state to rolled_back
4. Fix → echo v1.3.9 > current_version && echo rolled_back > deploy.state && echo ok > rollback.complete
