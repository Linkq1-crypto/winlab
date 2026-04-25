# disk-full — Solution

## INCIDENT SUMMARY
The filesystem is under artificial disk pressure. A 64 MB filler file was created at `/opt/winlab/disk-full/filler.img` to simulate a disk-full condition. Writes to the affected path are failing. The pressure must be relieved to restore normal operation.

## ROOT CAUSE
`/opt/winlab/disk-full/filler.img` — a 64 MB file allocated by `fallocate` — is holding disk space. No legitimate process created it; it is the injected fault. Removing it immediately frees the space.

## FIX

```bash
# Step 1 — confirm the filler
ls -lh /opt/winlab/disk-full/

# Step 2 — identify disk pressure
df -h /opt/winlab/disk-full/

# Step 3 — remove the filler
rm /opt/winlab/disk-full/filler.img

# Step 4 — confirm space is free
df -h /opt/winlab/disk-full/
```

## WHY THIS FIX WORKED
The filler file had no useful data. Removing it immediately reclaims the allocated blocks. On real incidents, the same approach applies to rotated logs, old core dumps, and abandoned temp files.

## PRODUCTION LESSON
Set up disk usage alerts at 80% and 90%. Use `du -sh /* | sort -h` to find the largest consumers quickly. On production, avoid `rm -rf` on unknown directories — always inspect with `ls -lh` first. Core dumps at `/var/crash` and unrotated logs at `/var/log` are the most common real culprits.

## COMMANDS TO REMEMBER
```bash
df -h                          # filesystem usage overview
du -sh /opt/winlab/disk-full/* # size per item in the target directory
ls -lh /opt/winlab/disk-full/  # list with sizes
rm /opt/winlab/disk-full/filler.img  # remove filler
```

## MENTOR_HINTS
1. Disk writes are failing → check available space with df -h
2. /opt/winlab/disk-full/ is consuming space → inspect with du -sh and ls -lh
3. filler.img is the injected fault — 64 MB with no purpose → remove it
4. Fix → rm /opt/winlab/disk-full/filler.img
