# advanced-scenarios/cron-stopped-jobs — Solution

> **Simulated incident.** This lab fixes a local scheduler state file at `/opt/winlab/advanced-scenarios/scheduler.state`. No real cron daemon is running. Verification checks the file contents only. The production lesson maps directly to real cron failure diagnosis.

## INCIDENT SUMMARY
Scheduled jobs have stopped running. The scheduler state file shows `cron=stopped` and `backup_job=missed`. No backups have been created since cron was stopped. Both fields must be corrected and the service state set to `resumed`.

## ROOT CAUSE
`/opt/winlab/advanced-scenarios/scheduler.state` contains:
```
cron=stopped
backup_job=missed
```

The cron daemon stopped, preventing all scheduled tasks from executing. The backup job that runs nightly has missed its scheduled window, leaving a gap in the backup chain.

## FIX

```bash
# Step 1 — inspect the scheduler state
cat /opt/winlab/advanced-scenarios/scheduler.state

# Step 2 — restart cron
sed -i 's/^cron=stopped$/cron=running/' \
  /opt/winlab/advanced-scenarios/scheduler.state

# Step 3 — reschedule the backup job
sed -i 's/^backup_job=missed$/backup_job=scheduled/' \
  /opt/winlab/advanced-scenarios/scheduler.state

# Step 4 — mark the service resumed
echo resumed > /opt/winlab/advanced-scenarios/service.state

# Step 5 — confirm
cat /opt/winlab/advanced-scenarios/scheduler.state
cat /opt/winlab/advanced-scenarios/service.state
```

## WHY THIS FIX WORKED
Setting `cron=running` restores the scheduler so future jobs fire on schedule. Resetting `backup_job=scheduled` confirms the job is queued for its next window. In production, you would also trigger a manual backup run to fill the missed window before declaring the incident resolved.

## PRODUCTION LESSON
When cron stops in production, no alert fires — that is the dangerous part. Monitor the scheduler with a heartbeat: schedule a job every minute that writes a timestamp to a file and alert if that file is older than 5 minutes. After restoring cron (`systemctl restart cron`), check `grep CRON /var/log/syslog` or `journalctl -u cron` to confirm jobs are firing. For missed backup windows, run the backup job manually and verify the output before closing the incident — a gap in backup chain can violate RPO.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/cron=stopped/cron=running/;s/backup_job=missed/backup_job=scheduled/' \
  /opt/winlab/advanced-scenarios/scheduler.state
echo resumed > /opt/winlab/advanced-scenarios/service.state

# On real systems:
systemctl status cron                    # check cron daemon status
systemctl restart cron                   # restart it
journalctl -u cron -n 50 --no-pager     # recent cron logs
grep CRON /var/log/syslog | tail -20    # job execution history
crontab -l                              # list current user's cron jobs
```

## MENTOR_HINTS
1. Scheduled jobs are not running and backups are missing → read /opt/winlab/advanced-scenarios/scheduler.state
2. cron=stopped means the scheduler daemon halted → set it to running
3. backup_job=missed records the missed window → reset it to scheduled
4. Fix → sed -i 's/cron=stopped/cron=running/;s/backup_job=missed/backup_job=scheduled/' /opt/winlab/advanced-scenarios/scheduler.state && echo resumed > /opt/winlab/advanced-scenarios/service.state
