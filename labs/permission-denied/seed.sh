#!/usr/bin/env bash
set -euo pipefail

id -u winlabapp >/dev/null 2>&1 || useradd -m -s /bin/bash winlabapp
mkdir -p /opt/winlab/permission-denied/data
echo "seeded" > /opt/winlab/permission-denied/data/README.txt
chown -R root:root /opt/winlab/permission-denied
chmod 0555 /opt/winlab/permission-denied/data

echo "permission-denied seeded; winlabapp cannot write to data/"
