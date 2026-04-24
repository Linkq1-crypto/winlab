#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/security-audit/audit.report"
grep -q '^ssh_root_login=disabled$' "${FILE}" || exit 1
grep -q '^world_writable_backup=false$' "${FILE}" || exit 1
grep -q '^status=passed$' "${FILE}" || exit 1
