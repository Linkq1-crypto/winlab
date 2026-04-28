#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/linux-terminal"

mkdir -p "${LAB_ROOT}/incoming"
rm -rf "${LAB_ROOT}/archive"   # archive/ is missing — student must mkdir

cat > "${LAB_ROOT}/README.txt" <<'EOF'
Linux Terminal — Intake Pipeline Recovery

The intake pipeline has stalled. Investigate and recover:
  1. Check what is in incoming/ and why it cannot be processed
  2. Create the archive/ directory (it is missing)
  3. Move incident.log from incoming/ to archive/
  4. Create archive/recovered.flag with the exact content:
     linux-terminal-ok

Type hint for guidance · Type verify when done
EOF

cat > "${LAB_ROOT}/incoming/incident.log" <<'EOF'
2026-04-28T09:14:32.441Z [ERROR] intake-worker: failed to process batch id=8f3a1c
2026-04-28T09:14:32.442Z [ERROR] FS_READER: EACCES /data/intake/batch-2026-04-28.tar.gz
  at Object.openSync (node:fs:596:3)
  at Object.writeFileSync (node:fs:2327:35)
  at IntakePipeline.flush (/srv/intake/pipeline.js:142:12)
  at processTicksAndRejections (node:internal/process/task_queues:95:5)
2026-04-28T09:14:32.443Z [WARN]  retrying in 5000ms (attempt 1/3)
2026-04-28T09:14:37.445Z [ERROR] FS_READER: EACCES /data/intake/batch-2026-04-28.tar.gz
2026-04-28T09:14:37.445Z [WARN]  retrying in 5000ms (attempt 2/3)
2026-04-28T09:14:42.447Z [ERROR] FS_READER: EACCES /data/intake/batch-2026-04-28.tar.gz
2026-04-28T09:14:42.448Z [ERROR] retries exhausted — intake pipeline halted
2026-04-28T09:14:42.449Z [INFO]  batch status=failed file=incoming/incident.log
2026-04-28T09:14:42.450Z [INFO]  STATUS: stalled. Manual recovery required.
EOF

chmod 000 "${LAB_ROOT}/incoming/incident.log"
