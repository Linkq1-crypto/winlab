#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# WinLab — Production Test Runner
#
# Ordine di esecuzione:
#   1. Health check rapido (abort se il server non risponde)
#   2. Vitest — production-readiness API suite
#   3. Playwright — E2E browser (user simulation, 2G, mobile)
#   4. K6 — stress test (ramp-up → 200 VUs → load shedding)
#   5. Launch checklist — early access, idempotency, seats
#
# Uso:
#   bash scripts/run-prod-tests.sh                   # → winlab.cloud
#   BASE_URL=https://staging.winlab.cloud bash ...   # → staging
#   BASE_URL=http://localhost:3001 bash ...          # → locale
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-https://winlab.cloud}"
PASS=0
FAIL=0
SKIP=0
REPORT_DIR="qa-report/prod-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[TEST]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓ $*${RESET}"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ $*${RESET}"; ((FAIL++)); }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; ((SKIP++)); }

echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  WinLab Production Test Suite${RESET}"
echo -e "  Target: ${CYAN}${BASE_URL}${RESET}"
echo -e "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"

# ── 0. Pre-flight health check ────────────────────────────────────────────────
log "0. Pre-flight: server raggiungibile?"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$BASE_URL/health" || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "Server attivo — $BASE_URL/health → 200"
else
  fail "Server NON raggiungibile (HTTP $HTTP_STATUS) — abort."
  echo -e "\n${RED}Impossibile procedere: server giù.${RESET}\n"
  exit 1
fi

# ── 1. Vitest — Production Readiness ─────────────────────────────────────────
log "1. Vitest — Production Readiness API Suite"
if npx vitest run tests/production-readiness.spec.ts \
    --reporter=verbose \
    --outputFile="$REPORT_DIR/vitest-prod-readiness.json" \
    2>&1 | tee "$REPORT_DIR/vitest-prod-readiness.log"; then
  ok "Vitest production-readiness: PASS"
else
  fail "Vitest production-readiness: FAIL (vedi $REPORT_DIR/vitest-prod-readiness.log)"
fi

# ── 2. Vitest — Circuit Breaker + Self Healing ───────────────────────────────
log "2. Vitest — Circuit Breaker & Self-Healing"
if npx vitest run tests/circuit-breaker.spec.ts tests/selfHealing.test.js \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-resilience.log"; then
  ok "Vitest resilience: PASS"
else
  fail "Vitest resilience: FAIL"
fi

# ── 2b. Vitest — Session Persistence ────────────────────────────────────────
log "2b. Vitest — Session Persistence & Resume"
if BASE_URL="$BASE_URL" npx vitest run tests/session-persistence.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-session-persistence.log"; then
  ok "Session persistence: PASS"
else
  fail "Session persistence: FAIL"
fi

# ── 2c. Vitest — Security Headers ────────────────────────────────────────────
log "2b. Vitest — Security Headers"
if BASE_URL="$BASE_URL" npx vitest run tests/security-headers.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-security-headers.log"; then
  ok "Security headers: PASS"
else
  fail "Security headers: FAIL"
fi

# ── 2c. Vitest — Rate Limiting ────────────────────────────────────────────────
log "2c. Vitest — Rate Limiting"
if BASE_URL="$BASE_URL" npx vitest run tests/rate-limiting.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-rate-limiting.log"; then
  ok "Rate limiting: PASS"
else
  fail "Rate limiting: FAIL"
fi

# ── 2d. Vitest — I18N Integrity ───────────────────────────────────────────────
log "2d. Vitest — I18N Integrity"
if BASE_URL="$BASE_URL" npx vitest run tests/i18n-integrity.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-i18n-integrity.log"; then
  ok "I18N integrity: PASS"
else
  fail "I18N integrity: FAIL"
fi

# ── 2e. Vitest — Stripe Webhook ───────────────────────────────────────────────
log "2e. Vitest — Stripe Webhook Guard"
if BASE_URL="$BASE_URL" npx vitest run tests/stripe-webhook.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-stripe-webhook.log"; then
  ok "Stripe webhook guard: PASS"
else
  fail "Stripe webhook guard: FAIL"
fi

# ── 3. Playwright — E2E Browser ───────────────────────────────────────────────
log "3. Playwright — E2E Browser (user simulation, 2G, mobile)"
if command -v npx &>/dev/null; then
  if BASE_URL="$BASE_URL" PROD=1 npx playwright test \
      tests/winlab.spec.ts tests/landing.spec.ts tests/health.spec.ts tests/lighthouse.spec.ts tests/network-conditions.spec.ts tests/session-resume-ui.spec.ts \
      --reporter=list \
      2>&1 | tee "$REPORT_DIR/playwright.log"; then
    ok "Playwright E2E: PASS"
  else
    fail "Playwright E2E: FAIL (screenshots in qa-report/)"
  fi
else
  warn "Playwright non installato — skip (npx playwright install)"
fi

# ── 3b. Vitest — WebSocket Stability ─────────────────────────────────────────
log "3b. Vitest — WebSocket Stability"
if BASE_URL="$BASE_URL" npx vitest run tests/websocket.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-websocket.log"; then
  ok "WebSocket stability: PASS"
else
  fail "WebSocket stability: FAIL"
fi

# ── 4. K6 — Stress Test ───────────────────────────────────────────────────────
log "4. K6 — Stress Test (ramp 0→200 VUs, 60s)"
if command -v k6 &>/dev/null; then
  if BASE_URL="$BASE_URL" k6 run \
      --out json="$REPORT_DIR/k6-results.json" \
      stress-test.js \
      2>&1 | tee "$REPORT_DIR/k6.log"; then
    ok "K6 stress test: PASS"
  else
    fail "K6 stress test: FAIL (soglie superate)"
  fi
else
  warn "k6 non installato — skip"
  echo -e "     ${YELLOW}Installa con: brew install k6 | choco install k6 | apt install k6${RESET}"
fi

# ── 4b. Vitest — Helpdesk Suite ──────────────────────────────────────────────
log "4b. Vitest — Helpdesk Full API Suite"
if BASE_URL="$BASE_URL" npx vitest run tests/helpdesk.spec.ts \
    --reporter=verbose \
    2>&1 | tee "$REPORT_DIR/vitest-helpdesk.log"; then
  ok "Helpdesk suite: PASS"
else
  fail "Helpdesk suite: FAIL"
fi

# ── 5. Launch Checklist ───────────────────────────────────────────────────────
log "5. Launch Checklist (seats, idempotency, webhooks)"
if BASE_URL="$BASE_URL" node scripts/test-launch-checklist.js \
    2>&1 | tee "$REPORT_DIR/launch-checklist.log"; then
  ok "Launch checklist: PASS"
else
  fail "Launch checklist: FAIL"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  RISULTATI — $BASE_URL${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}PASS${RESET}  $PASS / $TOTAL"
echo -e "  ${RED}FAIL${RESET}  $FAIL / $TOTAL"
[[ $SKIP -gt 0 ]] && echo -e "  ${YELLOW}SKIP${RESET}  $SKIP / $TOTAL (tool mancante)"
echo -e "  Report: ${CYAN}$REPORT_DIR/${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
