# WinLab Terminal Scenario: SELinux Denial → Fix
#
# Usage: vhs selinux_fix.tape --output selinux_fix.mp4

# ─── Output Settings ────────────────────────────────────────────────────────
Output vhs/output/selinux_fix.mp4
Output vhs/output/selinux_fix.gif

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

# Try to access the site (fails)
Type "curl -s -o /dev/null -w '%{http_code}' http://localhost"
Enter
Sleep 1.5s

# Check SELinux audit logs
Type "ausearch -m avc -ts recent | head -10"
Enter
Sleep 2s

# Show wrong file context
Type "ls -Z /var/www/html/index.html"
Enter
Sleep 1s

# Fix the context
Type "restorecon -v /var/www/html/index.html"
Enter
Sleep 1s

# Restart Apache
Type "systemctl restart httpd"
Enter
Sleep 1s

# Verify it's working now
Type "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\\n' http://localhost"
Enter
Sleep 1.5s

# Success
Type "echo '✓ Scenario resolved — SELinux context restored'"
Enter
Sleep 2s
