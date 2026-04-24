#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/docker-container-crash/container.state"
grep -q '^restart_policy=unless-stopped$' "${FILE}" || exit 1
grep -q '^status=running$' "${FILE}" || exit 1
