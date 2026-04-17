"""
WinLab Series Generator — Episodic Narratives
===============================================
Creates multi-episode video series with continuity.

Series:
  1. "Day 1 as a SysAdmin" (7 episodes: confusion → competence)
  2. "The 3AM Incident" (7 episodes: stress → control)
  3. "Fake vs Real SysAdmin" (7 episodes: identity)

Usage:
  # Generate all episodes for a series
  python vhs/scripts/series_generator.py --series day1 --output vhs/output

  # List all series
  python vhs/scripts/series_generator.py --list
"""

import os
import json
import random
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# SERIES DEFINITIONS
# ═══════════════════════════════════════════════════════════════

SERIES = {
    "day1": {
        "name": "Day 1 as a SysAdmin",
        "arc": "confusion → competence",
        "episodes": [
            {
                "day": 1,
                "title": "First day. Nothing works.",
                "hook": "Day 1.",
                "tension": "First job. Nothing works.",
                "cmd": "systemctl status apache2",
                "status": "● failed",
                "cliffhanger": "No idea why.",
                "cta": "What would you do?",
            },
            {
                "day": 2,
                "title": "You try restarting.",
                "hook": "Day 2.",
                "tension": "You try restarting.",
                "cmd": "sudo systemctl restart apache2",
                "status": "✖ failed again",
                "cliffhanger": "Still broken.",
                "cta": "Now what?",
            },
            {
                "day": 3,
                "title": "Production is down.",
                "hook": "Day 3.",
                "tension": "Production is down.",
                "cmd": "journalctl -xe",
                "status": "ERROR: config invalid",
                "cliffhanger": "People are waiting.",
                "cta": "Fix it. Fast.",
            },
            {
                "day": 4,
                "title": "Something clicks.",
                "hook": "Day 4.",
                "tension": "You read the logs.",
                "cmd": "cat /etc/apache2/sites-enabled/000-default.conf",
                "status": "Syntax error on line 15",
                "cliffhanger": "One line is wrong.",
                "cta": "Do you see it?",
            },
            {
                "day": 5,
                "title": "Small win.",
                "hook": "Day 5.",
                "tension": "You fix the config.",
                "cmd": "sudo systemctl restart apache2",
                "status": "✓ running",
                "cliffhanger": "It works.",
                "cta": "Finally.",
            },
            {
                "day": 6,
                "title": "New problem.",
                "hook": "Day 6.",
                "tension": "New problem. Database lag.",
                "cmd": "mysql -e 'SHOW SLAVE STATUS\\G'",
                "status": "Replication delayed",
                "cliffhanger": "Again.",
                "cta": "Ready?",
            },
            {
                "day": 7,
                "title": "You don't panic anymore.",
                "hook": "Day 7.",
                "tension": "You don't panic anymore.",
                "cmd": "You've seen this before.",
                "status": "✓ Confident",
                "cliffhanger": "Practice makes the difference.",
                "cta": "Try it yourself → WinLab",
                "is_cta": True,
            },
        ],
    },
    "3am": {
        "name": "The 3AM Incident",
        "arc": "stress → control",
        "episodes": [
            {
                "day": 1,
                "title": "3:02 AM",
                "hook": "3:02 AM.",
                "tension": "Phone rings.",
                "cmd": "",
                "status": "",
                "cliffhanger": "Production is down.",
                "cta": "",
            },
            {
                "day": 2,
                "title": "You log in",
                "hook": "You log in.",
                "tension": "CPU at 100%.",
                "cmd": "top -bn1 | head -20",
                "status": "PID 4521: 99.8% cpu",
                "cliffhanger": "Something's wrong.",
                "cta": "Where do you start?",
            },
            {
                "day": 3,
                "title": "Tickets flooding",
                "hook": "Users can't access anything.",
                "tension": "Tickets flooding in.",
                "cmd": "systemctl status nginx",
                "status": "Active: active (running) but 0 connections",
                "cliffhanger": "Not the webserver.",
                "cta": "Dig deeper.",
            },
            {
                "day": 4,
                "title": "Logs show spikes",
                "hook": "Logs show memory spikes.",
                "tension": "Something is leaking.",
                "cmd": "free -m && cat /proc/meminfo | head -5",
                "status": "Available: 12MB",
                "cliffhanger": "Memory leak?",
                "cta": "Find the process.",
            },
            {
                "day": 5,
                "title": "Temporary fix",
                "hook": "You kill the process.",
                "tension": "System stabilizes.",
                "cmd": "kill -9 4521",
                "status": "✓ System responsive",
                "cliffhanger": "Temporary fix.",
                "cta": "Not done yet.",
            },
            {
                "day": 6,
                "title": "Root cause",
                "hook": "Root cause matters.",
                "tension": "You dig deeper.",
                "cmd": "journalctl -u app --since '03:00' | grep leak",
                "status": "Found: unclosed connection pool",
                "cliffhanger": "Find it.",
                "cta": "Fix it properly.",
            },
            {
                "day": 7,
                "title": "Next time",
                "hook": "Next time… you'll be ready.",
                "tension": "Practice real incidents.",
                "cmd": "WinLab.cloud",
                "status": "Start Free Lab →",
                "cliffhanger": "",
                "cta": "WinLab.cloud",
                "is_cta": True,
            },
        ],
    },
    "fake_vs_real": {
        "name": "Fake vs Real SysAdmin",
        "arc": "identity / ego",
        "episodes": [
            {"day": 1, "hook": "Fake sysadmin:", "tension": "copies commands.", "cmd": "", "status": "", "cliffhanger": "Without understanding.", "cta": ""},
            {"day": 2, "hook": "Real sysadmin:", "tension": "reads the logs.", "cmd": "journalctl -xe", "status": "→ finds the root cause", "cliffhanger": "Asks why.", "cta": ""},
            {"day": 3, "hook": 'Fake: "Stack Overflow said this."', "tension": "", "cmd": "sudo systemctl restart everything", "status": "✖ still broken", "cliffhanger": "No idea why.", "cta": ""},
            {"day": 4, 'hook': 'Real: "Why did it fail?"', "tension": "", "cmd": "cat /var/log/syslog | tail -20", "status": "→ error found", "cliffhanger": "Understands.", "cta": ""},
            {"day": 5, "hook": "Fake: restarts everything.", "tension": "Breaks more things.", "cmd": "systemctl restart nginx mysql redis", "status": "✖ cascading failures", "cliffhanger": "Now what?", "cta": ""},
            {"day": 6, "hook": "Real: fixes the root cause.", "tension": "One change. Permanent fix.", "cmd": "apt update && apt upgrade -y", "status": "✓ stable", "cliffhanger": "Solves it.", "cta": ""},
            {"day": 7, "hook": "The difference?", "tension": "Practice.", "cmd": "WinLab.cloud", "status": "Start Free Lab →", "cliffhanger": "", "cta": "WinLab.cloud", "is_cta": True},
        ],
    },
}


def generate_episode_video_def(series_key, episode_idx):
    """Generate a video definition for a single episode."""
    series = SERIES[series_key]
    ep = series["episodes"][episode_idx]

    scenes = [
        {"type": "text", "text": ep["hook"], "duration": 2.5},
    ]

    if ep["tension"]:
        scenes.append({"type": "text", "text": ep["tension"], "duration": 2.0})

    if ep["cmd"]:
        scenes.append({"type": "terminal", "cmd": ep["cmd"], "status": ep["status"], "duration": 5.0})

    if ep["cliffhanger"]:
        scenes.append({"type": "text", "text": ep["cliffhanger"], "duration": 2.0})

    if ep["cta"]:
        color = "accent" if ep.get("is_cta") else "text"
        scenes.append({"type": "text", "text": ep["cta"], "duration": 2.5, "color": color})

    return {
        "id": f"series_{series_key}_ep{episode_idx + 1:02d}",
        "name": f"{series_key}_day{episode_idx + 1:02d}",
        "series": series["name"],
        "episode": episode_idx + 1,
        "total_episodes": len(series["episodes"]),
        "hook": ep["hook"],
        "scenes": scenes,
        "cluster": "challenge" if series_key == "3am" else "identity" if series_key == "fake_vs_real" else "learning",
        "created_at": datetime.now().isoformat(),
    }


def generate_full_series(series_key, out_dir="vhs/output"):
    """Generate all episodes for a series."""
    series = SERIES[series_key]
    videos = []

    for i in range(len(series["episodes"])):
        v = generate_episode_video_def(series_key, i)
        videos.append(v)

    os.makedirs(out_dir, exist_ok=True)

    # Export each episode
    for v in videos:
        path = os.path.join(out_dir, f"{v['name']}.json")
        with open(path, "w") as f:
            json.dump(v, f, indent=2)

    # Export series manifest
    manifest = {
        "series": series["name"],
        "arc": series["arc"],
        "total_episodes": len(videos),
        "episodes": [{"id": v["id"], "name": v["name"], "file": f"{v['name']}.json"} for v in videos],
    }
    manifest_path = os.path.join(out_dir, f"series_{series_key}_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  ✓ Series: {series['name']} ({len(videos)} episodes)")
    print(f"    Arc: {series['arc']}")
    for v in videos:
        print(f"    Ep {v['episode']}: {v['hook']}")
    print(f"    Manifest: {manifest_path}")

    return videos


def list_series():
    """List all available series."""
    print("\nAvailable Series:\n")
    for key, s in SERIES.items():
        print(f"  {key}: {s['name']}")
        print(f"    Arc: {s['arc']}")
        print(f"    Episodes: {len(s['episodes'])}")
        print()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Series Generator")
    parser.add_argument("--series", "-s", help="Series key (day1, 3am, fake_vs_real)")
    parser.add_argument("--list", "-l", action="store_true", help="List all series")
    parser.add_argument("--output", "-o", default="vhs/output", help="Output directory")
    parser.add_argument("--all", "-a", action="store_true", help="Generate all series")

    args = parser.parse_args()

    if args.list:
        list_series()
    elif args.all:
        for key in SERIES:
            generate_full_series(key, out_dir=args.output)
            print()
    elif args.series:
        if args.series not in SERIES:
            print(f"Unknown series: {args.series}")
            print(f"Available: {', '.join(SERIES.keys())}")
            return
        generate_full_series(args.series, out_dir=args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
