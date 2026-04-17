# WinLab Terminal Scenario: Hero Launch Video
# Script: "Same skills. Different outcome."
# Duration: 25 seconds
#
# This generates the terminal portion only.
# The full video (with text overlays, split screen, voice) 
# is assembled by assemble_hero_video.bat

Output vhs/output/hero_terminal.mp4

Set FontSize 28
Set Width 1280
Set Height 720
Set Padding 40
Set Margin 60
Set Background "#0a0a0a"
Set FontFamily "JetBrains Mono"
Set BorderRadius 14

Set WindowBar true
Set WindowBarColor "#1e1e1e"
Set WindowBarControls true

Set DefaultTypingSpeed 80ms
Set Shell bash

Hide Underline

# ─── TIMING: 0-3s (HOOK - terminal appears) ─────────────────────────────
Sleep 300ms

# ─── TIMING: 3-8s (PROBLEM - connection dropped) ─────────────────────────
Type "curl -I http://localhost"
Enter
Sleep 1s

# Show error (dramatic)
Type "curl: (7) Failed to connect to localhost port 80"
Type "Connection refused"
Enter
Sleep 1.5s

# Timeout indicator
Type "❌ Connection timeout — site unreachable"
Enter
Sleep 1s

# ─── TIMING: 8-12s (INSIGHT - diagnose) ──────────────────────────────────
Type "systemctl status httpd"
Enter
Sleep 1s

Type "● httpd.service - inactive (dead)"
Enter
Sleep 800ms

# ─── TIMING: 12-20s (SOLUTION - fix) ─────────────────────────────────────
Type "sudo systemctl start httpd"
Enter
Sleep 1s

Type "Started httpd.service"
Enter
Sleep 800ms

Type "curl -I http://localhost 2>&1 | head -1"
Enter
Sleep 1s

Type "HTTP/1.1 200 OK"
Enter
Sleep 800ms

# Success indicators (overlay will add: Works on GSM, offline, anywhere)
Type "✓ Active: running since Mon 2024-03-04"
Enter
Sleep 500ms

Type "✓ Site responding on port 80"
Enter
Sleep 500ms

Type "✓ Scenario resolved"
Enter
Sleep 1s

# ─── TIMING: 20-25s (CTA - final pause for overlay) ──────────────────────
Sleep 2s
