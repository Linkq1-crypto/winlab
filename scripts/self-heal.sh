#!/bin/bash
# scripts/self-heal.sh – Self-Healing Automation
# Run every minute via cron: * * * * * /var/www/simulator/scripts/self-heal.sh
#
# What it does:
# 1. Check PM2 process health
# 2. Restart crashed nodes
# 3. Check backend API health
# 4. If all nodes down → emergency restart
# 5. Log all actions

LOGFILE="/var/log/winlab-heal.log"
NODES=("3001" "3002" "3003")
HEALTH_URL="http://localhost:%d/health"
MAX_RESTARTS=5
RESTART_WINDOW=300 # 5 minutes

log() {
    echo "[$(date -Iseconds)] $1" >> "$LOGFILE"
    echo "[$(date -Iseconds)] $1"
}

# ── 1. Check PM2 Health ────────────────────────────────────────────────────
check_pm2() {
    local status
    status=$(pm2 jlist 2>/dev/null)

    if [ $? -ne 0 ]; then
        log "ERROR: PM2 is not running. Attempting to start..."
        pm2 resurrect || pm2 start /var/www/simulator/ecosystem.config.js
        return 1
    fi

    # Check for stopped or errored processes
    local stopped
    stopped=$(echo "$status" | jq -r '.[] | select(.pm2_env.status == "stopped" or .pm2_env.status == "errored") | .name')

    if [ -n "$stopped" ]; then
        log "WARNING: PM2 processes stopped: $stopped"
        pm2 restart all
        return 1
    fi

    return 0
}

# ── 2. Check Backend API Health ────────────────────────────────────────────
check_api() {
    local port=$1
    local url=$(printf "$HEALTH_URL" "$port")

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url/health" 2>/dev/null)

    if [ "$http_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# ── 3. Self-Heal Loop ──────────────────────────────────────────────────────
heal_nodes() {
    local all_down=true

    for port in "${NODES[@]}"; do
        if check_api "$port"; then
            log "OK: Node :$port is healthy"
            all_down=false
        else
            log "WARN: Node :$port is DOWN"
        fi
    done

    # If all nodes are down, emergency restart
    if [ "$all_down" = true ]; then
        log "CRITICAL: All backend nodes are DOWN. Emergency restart..."
        pm2 restart winlab
        sleep 10

        # Verify restart
        for port in "${NODES[@]}"; do
            if check_api "$port"; then
                log "OK: Node :$port recovered after restart"
                return 0
            fi
        done

        log "CRITICAL: Emergency restart failed. Manual intervention required."
        return 1
    fi

    return 0
}

# ── 4. Cleanup Old Logs ───────────────────────────────────────────────────
cleanup_logs() {
    # Keep only last 7 days of heal logs
    find /var/log/ -name "winlab-*.log" -mtime +7 -delete 2>/dev/null
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
    log "=== Self-Heal Check Start ==="

    # Check PM2
    check_pm2

    # Check and heal nodes
    heal_nodes
    local heal_result=$?

    # Cleanup
    cleanup_logs

    if [ $heal_result -ne 0 ]; then
        log "=== Self-Heal Check FAILED ==="
        exit 1
    fi

    log "=== Self-Heal Check OK ==="
    exit 0
}

main
