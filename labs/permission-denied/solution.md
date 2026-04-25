# permission-denied — Solution

## INCIDENT SUMMARY
The application user `winlabapp` cannot write to `/opt/winlab/permission-denied/data/`. The directory is owned by `root:root` with mode `0555` (read+execute, no write for anyone). The verify check runs `touch` as `winlabapp` to confirm write access is restored.

## ROOT CAUSE
`seed.sh` sets:
```bash
chown -R root:root /opt/winlab/permission-denied
chmod 0555 /opt/winlab/permission-denied/data
```

Mode `0555` grants no write permission to any user including the owner. `winlabapp` cannot create files, which breaks the application.

## FIX

```bash
# Step 1 — confirm the problem
ls -la /opt/winlab/permission-denied/
su -s /bin/bash -c "touch /opt/winlab/permission-denied/data/test" winlabapp
# Expected: Permission denied

# Step 2 — fix ownership so winlabapp owns the directory
chown -R winlabapp:winlabapp /opt/winlab/permission-denied/data

# Step 3 — fix permissions to allow owner writes
chmod 0755 /opt/winlab/permission-denied/data

# Step 4 — confirm winlabapp can now write
su -s /bin/bash -c "touch /opt/winlab/permission-denied/data/test" winlabapp \
  && echo "write OK" \
  && rm /opt/winlab/permission-denied/data/test
```

## WHY THIS FIX WORKED
Changing ownership to `winlabapp` and mode to `0755` gives the application user write access to its own directory without opening it to all other users.

## PRODUCTION LESSON
Application processes should never run as root. Each service should own its data directory and nothing else. Audit with `find /opt/myapp -not -user appuser` after every deployment to catch permission regressions. In containers, use `USER` in your Dockerfile and set correct file ownership in the image build.

## COMMANDS TO REMEMBER
```bash
ls -la /opt/winlab/permission-denied/       # inspect ownership and mode
stat /opt/winlab/permission-denied/data     # detailed permissions
su -s /bin/bash -c "touch /tmp/t" winlabapp # test as target user
chown -R winlabapp:winlabapp /opt/winlab/permission-denied/data
chmod 0755 /opt/winlab/permission-denied/data
```

## MENTOR_HINTS
1. Application cannot write files → check directory ownership and mode with ls -la
2. data/ is owned by root with mode 0555 → winlabapp has no write permission
3. Need to give winlabapp ownership and write access → chown + chmod
4. Fix → chown -R winlabapp:winlabapp /opt/winlab/permission-denied/data && chmod 0755 /opt/winlab/permission-denied/data
