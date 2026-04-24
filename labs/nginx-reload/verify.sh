#!/usr/bin/env bash
set -euo pipefail

nginx -t >/dev/null 2>&1 || exit 1
pgrep nginx >/dev/null 2>&1 || exit 1
