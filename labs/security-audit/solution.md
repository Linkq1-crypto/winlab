# security-audit — Solution

## INCIDENT SUMMARY
A security audit has flagged two critical misconfigurations. `audit.report` shows `ssh_root_login=enabled` and `world_writable_backup=true`. Both must be remediated and `status` set to `passed` to clear the audit finding.

## ROOT CAUSE
`/opt/winlab/security-audit/audit.report` contains:
```
ssh_root_login=enabled
world_writable_backup=true
status=failed
```

Two independent security issues:
1. Root SSH login is enabled — allows direct root access from the network, bypassing sudo audit trails
2. A backup directory is world-writable — any local user can overwrite or corrupt backups

## FIX

```bash
# Step 1 — inspect the audit report
cat /opt/winlab/security-audit/audit.report

# Step 2 — disable root SSH login
sed -i 's/^ssh_root_login=.*/ssh_root_login=disabled/' \
  /opt/winlab/security-audit/audit.report

# Step 3 — remove world-writable permission from backup
sed -i 's/^world_writable_backup=.*/world_writable_backup=false/' \
  /opt/winlab/security-audit/audit.report

# Step 4 — pass the audit
sed -i 's/^status=.*/status=passed/' \
  /opt/winlab/security-audit/audit.report

# Step 5 — confirm
cat /opt/winlab/security-audit/audit.report
```

## WHY THIS FIX WORKED
Each `sed` command updates a single key-value pair in the audit report. In a real system, disabling root SSH means editing `/etc/ssh/sshd_config` (`PermitRootLogin no`) and reloading sshd; fixing world-writable directories means `chmod o-w /path/to/backup`. The audit report here is the verifiable state marker.

## PRODUCTION LESSON
Run automated security audits on every deploy using tools like `lynis`, `auditd`, or CIS benchmarks. Failing an audit check should block the deployment until remediated. Root SSH login and world-writable directories are CIS Level 1 findings — they should never exist in a production system.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/^ssh_root_login=.*/ssh_root_login=disabled/' audit.report
sed -i 's/^world_writable_backup=.*/world_writable_backup=false/' audit.report
sed -i 's/^status=.*/status=passed/' audit.report

# On real systems:
grep PermitRootLogin /etc/ssh/sshd_config    # check root SSH
chmod o-w /path/to/backup                    # fix world-writable
find / -perm -0002 -type d 2>/dev/null       # find all world-writable dirs
```

## MENTOR_HINTS
1. Audit failed → read /opt/winlab/security-audit/audit.report to find the findings
2. ssh_root_login=enabled is the first finding → set it to disabled
3. world_writable_backup=true is the second finding → set it to false
4. Fix → sed -i 's/ssh_root_login=enabled/ssh_root_login=disabled/;s/world_writable_backup=true/world_writable_backup=false/;s/status=failed/status=passed/' /opt/winlab/security-audit/audit.report
