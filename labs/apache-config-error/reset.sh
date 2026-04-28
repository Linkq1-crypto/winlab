#!/usr/bin/env bash
set -euo pipefail

pkill apache2 2>/dev/null || true
rm -f /etc/apache2/conf-enabled/winlab.conf
rm -rf /opt/winlab/apache-config-error
