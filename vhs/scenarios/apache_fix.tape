# WinLab Terminal Scenario: Apache Down → Fix
# Generated for YouTube ML Pipeline + LinkedIn Marketing
#
# Usage: vhs apache_fix.tape --output apache_fix.mp4

# ─── Output Settings ────────────────────────────────────────────────────────
Output vhs/output/apache_fix.mp4
Output vhs/output/apache_fix.gif

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

# ─── Hide Underline (cleaner look) ──────────────────────────────────────────
Hide Underline

# ─── Terminal Session ───────────────────────────────────────────────────────

# Initial pause (dramatic effect)
Sleep 500ms

# Check Apache status
Type "systemctl status httpd"
Enter
Sleep 1s

# Show journal logs
Type "journalctl -u httpd -n 5 --no-pager"
Enter
Sleep 1.5s

# Start Apache
Type "systemctl start httpd"
Enter
Sleep 1s

# Verify it's working
Type "curl -I http://localhost 2>&1 | head -1"
Enter
Sleep 1s

# Final status check
Type "systemctl is-active httpd"
Enter
Sleep 800ms

# Success message
Type "echo '✓ Scenario resolved — Apache back online'"
Enter
Sleep 2s
