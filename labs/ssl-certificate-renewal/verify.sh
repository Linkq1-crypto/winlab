#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/ssl-certificate-renewal"
CERT_FILE="${LAB_ROOT}/certs/current.pem"

grep -q "^CN=app.winlab.local$" "${CERT_FILE}" || exit 1
grep -Eq "^not_after=202[6-9]-" "${CERT_FILE}" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/cert.state")" == "renewed" ]] || exit 1
