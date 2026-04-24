#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/raid-simulator"
mkdir -p "${LAB_ROOT}"

cat > "${LAB_ROOT}/mdadm.detail" <<'EOF'
/dev/md0:
           Version : 1.2
     Creation Time : today
        Raid Level : raid1
        Array Size : 524288 blocks
     Used Dev Size : 524288 blocks
      Raid Devices : 2
     Total Devices : 1
       State : clean, degraded
Active Devices : 1
Working Devices : 1
Failed Devices : 1
Spare Devices : 0
    Number   Major   Minor   RaidDevice State
       0       8        1        0      active sync   /dev/sda1
       1       8       17        1      removed
EOF

cat > "${LAB_ROOT}/README.txt" <<'EOF'
RAID recovery simulation:
1. Edit /opt/winlab/raid-simulator/mdadm.detail
2. Change State to clean
3. Set Total Devices to 2
4. Set Failed Devices to 0
5. Replace removed with active sync /dev/sdb1
6. Write rebuilt to /opt/winlab/raid-simulator/array.state
EOF

echo degraded > "${LAB_ROOT}/array.state"
