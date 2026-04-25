# real-server/fsck — Solution

> **Simulated incident.** This lab fixes a local filesystem state file at `/opt/winlab/real-server/filesystem.state`. No real filesystem check is run. Verification checks the file contents only.

## INCIDENT SUMMARY
The ext4 filesystem was not unmounted cleanly after a crash and is marked `dirty`. A filesystem check is required before it can be mounted read-write. The filesystem state must be set to `clean` with `repair=completed`, and the service state set to `stable`.

## ROOT CAUSE
`/opt/winlab/real-server/filesystem.state` contains:
```
ext4=dirty
repair=required
```

The filesystem journal is inconsistent — the `dirty` flag is set when the filesystem was not unmounted cleanly (power loss, kernel panic). Until fsck runs and replays or discards the journal, the filesystem cannot be trusted for writes.

## FIX

```bash
# Step 1 — inspect the filesystem state
cat /opt/winlab/real-server/filesystem.state

# Step 2 — mark the filesystem clean after repair
sed -i 's/^ext4=dirty$/ext4=clean/' \
  /opt/winlab/real-server/filesystem.state

# Step 3 — mark the repair completed
sed -i 's/^repair=required$/repair=completed/' \
  /opt/winlab/real-server/filesystem.state

# Step 4 — mark the service stable
echo stable > /opt/winlab/real-server/service.state

# Step 5 — confirm
cat /opt/winlab/real-server/filesystem.state
cat /opt/winlab/real-server/service.state
```

## WHY THIS FIX WORKED
Setting `ext4=clean` and `repair=completed` represents the state after `fsck -y /dev/sda1` successfully replayed the journal and fixed any inconsistencies. The filesystem can now be remounted read-write safely.

## PRODUCTION LESSON
On real systems, `fsck` runs automatically on next boot if the `dirty` bit is set. Force an immediate check with `fsck -f /dev/sda1` (only on unmounted filesystems — never run fsck on a mounted partition). For the root filesystem, use a rescue boot or single-user mode. Check filesystem health proactively with `tune2fs -l /dev/sda1 | grep -E 'state|mount count|check interval'`. Increase the `max-mount-count` to 0 (disable mount-count-based checks) and rely on `check interval` to avoid unscheduled fsck runs on busy servers.

## COMMANDS TO REMEMBER
```bash
# In this lab:
sed -i 's/ext4=dirty/ext4=clean/;s/repair=required/repair=completed/' \
  /opt/winlab/real-server/filesystem.state
echo stable > /opt/winlab/real-server/service.state

# On real systems:
tune2fs -l /dev/sda1 | grep -E 'state|mount'    # check filesystem state
umount /dev/sda1                                  # unmount before fsck
fsck -f -y /dev/sda1                             # force check, auto-fix
mount /dev/sda1 /mnt                             # remount after repair
dmesg | grep -i ext4                             # kernel filesystem messages
```

## MENTOR_HINTS
1. Filesystem is dirty after an unclean shutdown → read /opt/winlab/real-server/filesystem.state to see the repair status
2. ext4=dirty means the journal needs to be replayed before the filesystem can be trusted → fsck must run
3. After fsck completes, the filesystem is clean and repair is confirmed
4. Fix → sed -i 's/ext4=dirty/ext4=clean/;s/repair=required/repair=completed/' /opt/winlab/real-server/filesystem.state && echo stable > /opt/winlab/real-server/service.state
