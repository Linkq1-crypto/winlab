# WinLab Terminal Scenario: Disk Full → Cleanup
#
# Usage: vhs disk_full.tape --output disk_full.mp4

# ─── Output Settings ────────────────────────────────────────────────────────
Output vhs/output/disk_full.mp4
Output vhs/output/disk_full.gif

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

# Check disk usage (show 100%)
Type "df -h"
Enter
Sleep 1.5s

# Find the culprit
Type "du -sh /var/log/* 2>/dev/null | sort -hr | head -3"
Enter
Sleep 2s

# Show the massive log file
Type "ls -lh /var/log/httpd/access_log"
Enter
Sleep 1s

# Truncate the log (safe cleanup)
Type "sudo truncate -s 0 /var/log/httpd/access_log"
Enter
Sleep 1s

# Verify disk is freed
Type "df -h /"
Enter
Sleep 1.5s

# Show before/after
Type "echo 'Before: 50G used → After: 2G used (48GB freed!)'"
Enter
Sleep 800ms

# Success
Type "echo '✓ Scenario resolved — Disk space recovered'"
Enter
Sleep 2s
