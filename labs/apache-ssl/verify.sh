#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="/opt/winlab/apache-ssl"
grep -q '^SSLCertificateFile /etc/ssl/winlab/current.pem$' "${LAB_ROOT}/vhost.conf" || exit 1
[[ "$(tr -d '\r\n' < "${LAB_ROOT}/cert.state")" == "active" ]] || exit 1
