#!/usr/bin/env bash
set -euo pipefail

LAB_ID="${LAB_ID:-nginx-port-conflict}"
FAILURES=()

fail() {
  FAILURES+=("$1")
}

ok() {
  echo "VERIFY_STEP_OK $1"
}

check_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

check_port_free_from_conflict_pid() {
  local pidfile="$1"

  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"

    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      fail "port conflict still active: pid $pid"
    else
      ok "conflict pid not running"
    fi
  else
    ok "conflict pidfile absent"
  fi
}

check_nginx_config() {
  if nginx -t >/tmp/nginx-test.out 2>&1; then
    ok "nginx config valid"
  else
    fail "nginx config invalid: $(cat /tmp/nginx-test.out)"
  fi
}

check_single_default_server() {
  local count
  count="$(
    grep -R "listen .*80.*default_server" /etc/nginx 2>/dev/null \
      | grep -v "\.bak" \
      | wc -l \
      | tr -d ' '
  )"

  if [[ "$count" -eq 1 ]]; then
    ok "single default_server on port 80"
  else
    fail "expected exactly one default_server on port 80, found $count"
  fi
}

check_nginx_running() {
  if pgrep -x nginx >/dev/null 2>&1; then
    ok "nginx running"
  else
    fail "nginx not running"
  fi
}

check_http_response() {
  local expected="$1"
  local body

  body="$(curl -fsS --max-time 3 http://127.0.0.1/ || true)"

  if echo "$body" | grep -q "$expected"; then
    ok "http response contains expected marker"
  else
    fail "http response missing expected marker: $expected"
  fi
}

main() {
  echo "VERIFY_START $LAB_ID"

  check_command nginx
  check_command curl

  check_port_free_from_conflict_pid "/var/run/winlab/port-conflict.pid"
  check_nginx_config
  check_single_default_server
  check_nginx_running
  check_http_response "WinLab nginx recovered"

  if [[ "${#FAILURES[@]}" -eq 0 ]]; then
    echo "VERIFY_OK"
    exit 0
  fi

  echo "VERIFY_FAIL"
  for failure in "${FAILURES[@]}"; do
    echo "- $failure"
  done

  exit 1
}

main "$@"
