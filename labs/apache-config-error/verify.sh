#!/usr/bin/env bash
set -euo pipefail

# Config must be valid
apache2ctl configtest 2>&1 | grep -q "Syntax OK" || exit 1

# apache2 must be running
pgrep -x apache2 > /dev/null || exit 1
