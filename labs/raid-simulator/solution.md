# raid-simulator — Solution

> **Simulated incident.** This lab simulates a degraded RAID-1 array by editing `/opt/winlab/raid-simulator/mdadm.detail` and `array.state`. No real block devices or mdadm are used. Verification checks the file contents only (spacing is significant — match exactly). The production lesson maps directly to real RAID recovery.

## INCIDENT SUMMARY
A RAID-1 mirror is degraded: one disk has been removed and the array is running on a single device. `mdadm.detail` shows `State : clean, degraded`, `Total Devices : 1`, `Failed Devices : 1`, and the second device slot shows `removed`. The array must be repaired to reflect a healthy two-disk mirror.

## ROOT CAUSE
`/opt/winlab/raid-simulator/mdadm.detail` contains:
```
       State : clean, degraded
     Total Devices : 1
Failed Devices : 1
       1       8       17        1      removed
```

And `/opt/winlab/raid-simulator/array.state` contains:
```
degraded
```

The array lost `/dev/sdb1` — the second mirror member. Running degraded means a second disk failure would cause total data loss with no redundancy.

## FIX

```bash
# Step 1 — inspect the degraded array
cat /opt/winlab/raid-simulator/mdadm.detail
cat /opt/winlab/raid-simulator/array.state

# Step 2 — clear the degraded state (spacing is critical — 7 spaces before State)
sed -i 's/^       State : clean, degraded$/       State : clean/' \
  /opt/winlab/raid-simulator/mdadm.detail

# Step 3 — restore the device count (5 spaces before Total)
sed -i 's/^     Total Devices : 1$/     Total Devices : 2/' \
  /opt/winlab/raid-simulator/mdadm.detail

# Step 4 — clear the failed device count (no leading spaces on Failed Devices)
sed -i 's/^Failed Devices : 1$/Failed Devices : 0/' \
  /opt/winlab/raid-simulator/mdadm.detail

# Step 5 — replace the removed device with the rebuilt member
sed -i 's/.*removed$/       1       8       17        1      active sync   \/dev\/sdb1/' \
  /opt/winlab/raid-simulator/mdadm.detail

# Step 6 — mark the array as rebuilt
echo rebuilt > /opt/winlab/raid-simulator/array.state

# Step 7 — confirm
cat /opt/winlab/raid-simulator/mdadm.detail
cat /opt/winlab/raid-simulator/array.state
```

## WHY THIS FIX WORKED
Each edit corrects one aspect of the array state record: removing `, degraded` from the State line signals the array is fully synchronised; setting `Total Devices : 2` records that both members are present; zeroing `Failed Devices` clears the fault; replacing `removed` with `active sync   /dev/sdb1` shows the device is participating in the mirror. The `array.state` file records the overall outcome for monitoring.

## PRODUCTION LESSON
A degraded RAID-1 array offers no redundancy — a second disk failure causes data loss. In real recovery: (1) confirm the failed device with `mdadm --detail /dev/md0`; (2) replace the physical disk; (3) add it back with `mdadm /dev/md0 --add /dev/sdb1`; (4) monitor resync progress with `cat /proc/mdstat` — a 500 GB mirror takes 30–90 minutes to resync. Never reboot a degraded array without first confirming the surviving disk is healthy (`smartctl -a /dev/sda`). After resync, force-assemble with `mdadm --examine --scan >> /etc/mdadm/mdadm.conf` to persist the config.

## COMMANDS TO REMEMBER
```bash
# In this lab (spacing must be exact):
sed -i 's/^       State : clean, degraded$/       State : clean/' mdadm.detail
sed -i 's/^     Total Devices : 1$/     Total Devices : 2/' mdadm.detail
sed -i 's/^Failed Devices : 1$/Failed Devices : 0/' mdadm.detail
sed -i 's/.*removed$/       1       8       17        1      active sync   \/dev\/sdb1/' mdadm.detail
echo rebuilt > array.state

# On real systems:
mdadm --detail /dev/md0           # current array status
cat /proc/mdstat                  # live resync progress
mdadm /dev/md0 --add /dev/sdb1   # add replacement disk
smartctl -a /dev/sda              # check surviving disk health
```

## MENTOR_HINTS
1. RAID array is degraded → read /opt/winlab/raid-simulator/mdadm.detail and array.state to understand the failure
2. State shows clean, degraded and Total Devices is 1 → one disk was removed from the mirror
3. Fix mdadm.detail: change State to clean, Total Devices to 2, Failed Devices to 0, replace removed with active sync /dev/sdb1
4. Fix → edit mdadm.detail with sed to correct all four fields (exact spacing required), then echo rebuilt > /opt/winlab/raid-simulator/array.state
