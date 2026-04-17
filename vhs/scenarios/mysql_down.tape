# WinLab Terminal Scenario: MySQL Down → Fix
#
# Usage: vhs mysql_down.tape --output mysql_down.mp4

# ─── Output Settings ────────────────────────────────────────────────────────
Output vhs/output/mysql_down.mp4
Output vhs/output/mysql_down.gif

# ─── Canvas Settings ────────────────────────────────────────────────────────
Set FontSize 28
Set Width 1280
Set Height 720
Set Padding 40
Set Margin 60
Set Background "#0a0a0a"
Set FontFamily "JetBrains Mono"
Set BorderRadius 14

# ─── Window Settings ────────────────────────────────────────────────────────
Set WindowBar true
Set WindowBarColor "#1e1e1e"
Set WindowBarControls true

# ─── Typing Settings ────────────────────────────────────────────────────────
Set DefaultTypingSpeed 80ms
Set DefaultWaitSpeed 80ms
Set Shell bash

Hide Underline

# ─── Terminal Session ───────────────────────────────────────────────────────

Sleep 500ms

# Check MySQL status (fails)
Type "systemctl status mysqld"
Enter
Sleep 1.5s

# Check logs for error
Type "journalctl -u mysqld -n 15 --no-pager"
Enter
Sleep 2s

# Check file permissions
Type "ls -la /var/lib/mysql/ | head -5"
Enter
Sleep 1s

# Show the problem (root instead of mysql)
Type "stat -c '%U:%G' /var/lib/mysql"
Enter
Sleep 1s

# Fix permissions
Type "sudo chown -R mysql:mysql /var/lib/mysql"
Enter
Sleep 1s

# Start MySQL
Type "systemctl start mysqld"
Enter
Sleep 1.5s

# Verify it's running
Type "systemctl is-active mysqld"
Enter
Sleep 800ms

# Test connection
Type "mysqladmin ping 2>&1"
Enter
Sleep 1s

# Success
Type "echo '✓ Scenario resolved — MySQL back online (permissions fixed)'"
Enter
Sleep 2s
