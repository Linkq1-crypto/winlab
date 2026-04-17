# WinLab Terminal Scenario: SSH Brute Force → Defense
#
# Usage: vhs ssh_brute_force.tape --output ssh_brute_force.mp4

# ─── Output Settings ────────────────────────────────────────────────────────
Output vhs/output/ssh_brute_force.mp4
Output vhs/output/ssh_brute_force.gif

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

# Show failed login attempts
Type "lastb | head -15"
Enter
Sleep 2s

# Count total attempts
Type "lastb | wc -l"
Enter
Sleep 1s

# Show journal logs
Type "journalctl -u sshd -n 10 --no-pager"
Enter
Sleep 2s

# Enable fail2ban
Type "systemctl start fail2ban"
Enter
Sleep 1s

# Check fail2ban status
Type "fail2ban-client status sshd"
Enter
Sleep 1.5s

# Show banned IPs
Type "fail2ban-client banned"
Enter
Sleep 1s

# Add manual iptables block (extra security)
Type "sudo iptables -A INPUT -s 185.234.12.45 -j DROP"
Enter
Sleep 800ms

# Success
Type "echo '✓ Scenario resolved — SSH attack mitigated, attacker banned'"
Enter
Sleep 2s
