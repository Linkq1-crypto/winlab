#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0
WARN=0

log()  { echo -e "${CYAN}[SEC]${RESET} $*"; }
ok()   { echo -e "${GREEN}  PASS${RESET} $*"; PASS=$((PASS + 1)); }
bad()  { echo -e "${RED}  FAIL${RESET} $*"; FAIL=$((FAIL + 1)); }
warn() { echo -e "${YELLOW}  WARN${RESET} $*"; WARN=$((WARN + 1)); }

run_cmd() {
  local label="$1"
  shift

  log "$label"
  if "$@"; then
    ok "$label"
  else
    bad "$label"
  fi
}

run_optional_vitest() {
  local label="$1"
  local spec="$2"
  local output_file
  output_file="$(mktemp)"

  log "$label"
  if env BASE_URL="$BASE_URL" npx vitest run "$spec" >"$output_file" 2>&1; then
    ok "$label"
  else
    if grep -q "No test files found" "$output_file"; then
      warn "$label skipped: spec excluded from current Vitest config"
    else
      bad "$label"
      cat "$output_file"
    fi
  fi
  rm -f "$output_file"
}

echo -e "${BOLD}Security Checks${RESET}"
echo -e "Target: ${CYAN}${BASE_URL}${RESET}"
echo

run_cmd "Health endpoint reachable" curl -fsS "${BASE_URL}/health"

run_optional_vitest "Vitest security headers suite" tests/security-headers.spec.ts
run_optional_vitest "Vitest production readiness suite" tests/production-readiness.spec.ts
run_optional_vitest "Vitest rate limiting suite" tests/rate-limiting.spec.ts

log "Unauthorized protected route should return structured 401"
UNAUTH_STATUS="$(
  curl -s -o /tmp/winlab-unauth.json -w "%{http_code}" \
    "${BASE_URL}/api/user/me"
)"
if [[ "$UNAUTH_STATUS" == "401" ]] && grep -qi '"error"' /tmp/winlab-unauth.json; then
  ok "Protected route rejects anonymous access with structured 401"
else
  bad "Protected route expected structured 401, got ${UNAUTH_STATUS}"
  cat /tmp/winlab-unauth.json || true
fi

log "CORS should not allow hostile Origin"
HOSTILE_HEADERS="$(mktemp)"
curl -s -D "$HOSTILE_HEADERS" -o /dev/null \
  -H 'Origin: https://evil.example' \
  "${BASE_URL}/health"
if grep -qi '^Access-Control-Allow-Origin:' "$HOSTILE_HEADERS"; then
  bad "Hostile origin unexpectedly received Access-Control-Allow-Origin"
  cat "$HOSTILE_HEADERS"
else
  ok "Hostile origin did not receive Access-Control-Allow-Origin"
fi
rm -f "$HOSTILE_HEADERS"

log "Reject invalid registration email"
INVALID_STATUS="$(
  curl -s -o /tmp/winlab-invalid-register.json -w "%{http_code}" \
    -X POST "${BASE_URL}/api/auth/register" \
    -H 'Content-Type: application/json' \
    -d '{"email":"user@test","password":"Password123!","name":"invalid email probe"}'
)"
if [[ "$INVALID_STATUS" == "400" ]]; then
  ok "Invalid registration email rejected with 400"
else
  bad "Invalid registration email expected 400, got ${INVALID_STATUS}"
  cat /tmp/winlab-invalid-register.json || true
fi

log "Temporary registration should issue hardened auth cookies"
TMP_EMAIL="sec-check-$(date +%s)-$$@example.com"
TMP_PASSWORD="Password123!"
COOKIE_JAR="$(mktemp)"
REGISTER_HEADERS="$(mktemp)"
TMP_REGISTER_STATUS="$(
  curl -s -D "$REGISTER_HEADERS" -c "$COOKIE_JAR" -o /tmp/winlab-tmp-register.json -w "%{http_code}" \
    -X POST "${BASE_URL}/api/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${TMP_EMAIL}\",\"password\":\"${TMP_PASSWORD}\",\"name\":\"security check temp user\"}"
)"
if [[ "$TMP_REGISTER_STATUS" == "200" ]]; then
  COOKIE_OK=1
  if ! grep -qi 'Set-Cookie: winlab_token=.*HttpOnly' "$REGISTER_HEADERS"; then COOKIE_OK=0; fi
  if ! grep -qi 'Set-Cookie: winlab_refresh=.*HttpOnly' "$REGISTER_HEADERS"; then COOKIE_OK=0; fi
  if ! grep -qi 'Set-Cookie: winlab_token=.*SameSite=Strict' "$REGISTER_HEADERS"; then COOKIE_OK=0; fi
  if ! grep -qi 'Set-Cookie: winlab_refresh=.*SameSite=Strict' "$REGISTER_HEADERS"; then COOKIE_OK=0; fi

  if [[ "$COOKIE_OK" -eq 1 ]]; then
    ok "Registration issued hardened auth cookies"
  else
    bad "Registration cookies missing HttpOnly or SameSite=Strict"
    cat "$REGISTER_HEADERS"
  fi

  log "Authenticated /api/user/me should work with issued cookies"
  AUTH_STATUS="$(
    curl -s -b "$COOKIE_JAR" -o /tmp/winlab-auth-user.json -w "%{http_code}" \
      "${BASE_URL}/api/user/me"
  )"
  if [[ "$AUTH_STATUS" == "200" ]] && grep -q "${TMP_EMAIL}" /tmp/winlab-auth-user.json; then
    ok "Issued cookies grant authenticated access"
  else
    bad "Issued cookies did not authenticate /api/user/me"
    cat /tmp/winlab-auth-user.json || true
  fi

  log "Delete temporary security-check account"
  DELETE_STATUS="$(
    curl -s -b "$COOKIE_JAR" -X DELETE -o /tmp/winlab-delete-user.json -w "%{http_code}" \
      "${BASE_URL}/api/user/account"
  )"
  if [[ "$DELETE_STATUS" == "200" ]]; then
    ok "Temporary security-check account deleted"
  else
    warn "Temporary account cleanup returned ${DELETE_STATUS}"
    cat /tmp/winlab-delete-user.json || true
  fi
else
  bad "Temporary registration failed with status ${TMP_REGISTER_STATUS}"
  cat /tmp/winlab-tmp-register.json || true
fi
rm -f "$COOKIE_JAR" "$REGISTER_HEADERS"

log "Brute-force login should trigger 429"
LOGIN_CODES_FILE="$(mktemp)"
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "${BASE_URL}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"attacker@test.com","password":"wrongpass"}' >> "$LOGIN_CODES_FILE"
done
if grep -q '^429$' "$LOGIN_CODES_FILE"; then
  ok "Login brute-force limiter triggered 429"
else
  bad "Login brute-force limiter never returned 429"
  cat "$LOGIN_CODES_FILE"
fi
rm -f "$LOGIN_CODES_FILE"

log "Unknown API endpoint should not leak stack traces"
NOT_FOUND_STATUS="$(
  curl -s -o /tmp/winlab-404.json -w "%{http_code}" \
    "${BASE_URL}/api/non-existent-endpoint-xyz"
)"
if [[ "$NOT_FOUND_STATUS" == "404" ]] && ! grep -Eq 'node_modules|at Object\.|ReferenceError|TypeError' /tmp/winlab-404.json; then
  ok "404 response is clean and does not leak stack traces"
else
  bad "404 response leaked implementation details or wrong status ${NOT_FOUND_STATUS}"
  cat /tmp/winlab-404.json || true
fi

log "Gzip enabled on hashed JS asset"
ASSET_PATH="$(curl -fsS "${BASE_URL}" | grep -oE '/assets/index-[^"]+\.js' | head -n 1 || true)"
if [[ -n "${ASSET_PATH}" ]]; then
  ASSET_HEADERS="$(mktemp)"
  curl -s -D "$ASSET_HEADERS" -o /dev/null -H 'Accept-Encoding: gzip' "${BASE_URL}${ASSET_PATH}"
  if grep -qi '^Content-Encoding: gzip' "$ASSET_HEADERS"; then
    ok "Hashed JS asset served with gzip"
  else
    bad "Hashed JS asset missing gzip encoding"
    cat "$ASSET_HEADERS"
  fi

  if grep -qi '^Cache-Control: public, max-age=31536000, immutable' "$ASSET_HEADERS"; then
    ok "Hashed JS asset served with immutable cache-control"
  else
    bad "Hashed JS asset missing immutable cache-control"
    cat "$ASSET_HEADERS"
  fi
  rm -f "$ASSET_HEADERS"
else
  warn "Could not resolve hashed index asset path from homepage"
fi

if command -v k6 >/dev/null 2>&1; then
  run_cmd "k6 stress test" env BASE_URL="$BASE_URL" npm run test:k6
else
  warn "k6 not installed - skipped stress test"
fi

echo
echo -e "${BOLD}Summary${RESET}"
echo -e "  ${GREEN}pass${RESET}: ${PASS}"
echo -e "  ${RED}fail${RESET}: ${FAIL}"
echo -e "  ${YELLOW}warn${RESET}: ${WARN}"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
