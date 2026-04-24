#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/k8s-crashloop/deployment.yaml"
grep -q '^livenessProbe: healthy$' "${FILE}" || exit 1
grep -q '^imageTag: stable$' "${FILE}" || exit 1
grep -q '^podStatus: Running$' "${FILE}" || exit 1
