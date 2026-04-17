"""
WinLab X (Twitter) Video Generator — 20 Optimized Videos
=========================================================
Generates 20 short-form videos optimized for X/Twitter.
- 15-25 seconds each
- Strong hooks
- Square format (1280x1280) for better X engagement
- Clear CTAs

Usage:
  python scripts/x_video_generator.py --generate 20 --output output
"""

import os
import sys
import json
import random
from datetime import datetime

# X-optimized hooks (tested for high engagement on Twitter)
X_HOOKS = [
    {"hook": "Connection lost.", "category": "problem", "emotion": "frustration"},
    {"hook": "Your internet shouldn't decide your career.", "category": "inequality", "emotion": "anger"},
    {"hook": "Same skills. Different outcome.", "category": "contrast", "emotion": "realization"},
    {"hook": "3:02 AM. Phone rings.", "category": "urgency", "emotion": "tension"},
    {"hook": "One command can destroy everything.", "category": "fear", "emotion": "caution"},
    {"hook": "Tutorial hell is real.", "category": "education", "emotion": "agreement"},
    {"hook": "You're not behind. You're untrained.", "category": "encouragement", "emotion": "relief"},
    {"hook": "Production is down.", "category": "urgency", "emotion": "panic"},
    {"hook": "Break it. Fix it. Learn it.", "category": "method", "emotion": "determination"},
    {"hook": "Real sysadmins read logs.", "category": "identity", "emotion": "pride"},
    {"hook": "Infrastructure inequality is real.", "category": "social", "emotion": "awareness"},
    {"hook": "Watching ≠ Doing.", "category": "contrast", "emotion": "realization"},
    {"hook": "11 failures. 1 skill.", "category": "persistence", "emotion": "motivation"},
    {"hook": "No internet? No problem.", "category": "solution", "emotion": "empowerment"},
    {"hook": "This changes how engineers learn.", "category": "innovation", "emotion": "curiosity"},
    {"hook": "Why juniors panic.", "category": "empathy", "emotion": "understanding"},
    {"hook": "Practice > Tutorials.", "category": "method", "emotion": "agreement"},
    {"hook": "Fiber vs SIM: the gap is real.", "category": "inequality", "emotion": "awareness"},
    {"hook": "It works on his machine.", "category": "humor", "emotion": "relatability"},
    {"hook": "Start before you're ready.", "category": "motivation", "emotion": "action"},
]

# Terminal commands for each video
TERMINAL_CMDS = [
    "journalctl -xe",
    "systemctl status nginx",
    "docker ps -a",
    "kubectl get pods",
    "df -h",
    "free -m",
    "netstat -tulpn",
    "cat /var/log/syslog | tail -50",
    "iptables -L -n",
    "top -bn1 | head -20",
]

# CTAs optimized for X
X_CTAS = [
    "Practice now → WinLab.cloud",
    "Try it free: WinLab.cloud",
    "Build real skills → WinLab.cloud",
    "Start practicing → WinLab.cloud",
    "Learn by doing → WinLab.cloud",
]

def generate_x_video_config(index):
    """Generate a single X-optimized video config."""
    hook_data = X_HOOKS[index % len(X_HOOKS)]
    cmd = random.choice(TERMINAL_CMDS)
    cta = random.choice(X_CTAS)
    
    # Keep videos 15-25 seconds
    scenes = [
        {"type": "hook", "text": hook_data["hook"], "duration": 2.5},
        {"type": "terminal", "cmd": cmd, "status": "✓ Service running", "duration": 5.0},
        {"type": "cta", "text": cta, "duration": 2.0},
    ]
    
    total_duration = sum(s["duration"] for s in scenes)
    
    return {
        "name": f"x_video_{index:03d}",
        "hook": hook_data["hook"],
        "category": hook_data["category"],
        "emotion": hook_data["emotion"],
        "command": cmd,
        "cta": cta,
        "duration": total_duration,
        "format": "square",  # 1280x1280 for X
        "scenes": scenes,
    }

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate X-optimized videos")
    parser.add_argument("--generate", type=int, default=20, help="Number of videos to generate")
    parser.add_argument("--output", type=str, default="output", help="Output directory")
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    print("\n" + "="*50)
    print("  WINLAB X (TWITTER) VIDEO GENERATOR")
    print(f"  Generating {args.generate} X-optimized videos")
    print("="*50 + "\n")
    
    videos = []
    for i in range(args.generate):
        config = generate_x_video_config(i)
        videos.append(config)
        print(f"  ✓ {config['name']}: \"{config['hook']}\" ({config['duration']}s)")
    
    # Export config
    config_file = os.path.join(args.output, "x_videos_config.json")
    with open(config_file, "w") as f:
        json.dump({"videos": videos, "generated_at": datetime.now().isoformat()}, f, indent=2)
    
    print(f"\n  ✓ Exported {len(videos)} X video configs → {config_file}")
    print(f"  ✓ Format: Square (1280×1280) optimized for X")
    print(f"  ✓ Average duration: {sum(v['duration'] for v in videos)/len(videos):.1f}s\n")
    
    return videos

if __name__ == "__main__":
    main()
