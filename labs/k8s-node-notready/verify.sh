#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/winlab/k8s-node-notready/node.status"
grep -q '^Ready=True$' "${FILE}" || exit 1
grep -q '^Kubelet=running$' "${FILE}" || exit 1
