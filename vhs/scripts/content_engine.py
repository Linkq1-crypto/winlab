"""
WinLab Content Engine — Auto-Generation + Reinforcement Loop
=============================================================
Generates 50-100+ video variants automatically.
Mutates top performers.
Matches video → landing dynamically.
Tracks performance → evolves.

Usage:
  # Generate 20 variants
  python vhs/scripts/content_engine.py --generate 20 --output vhs/output

  # Run reinforcement loop (requires data)
  python vhs/scripts/content_engine.py --evolve --data data/performance.json

  # Full pipeline: generate → render → track → evolve
  python vhs/scripts/content_engine.py --pipeline
"""

import os
import sys
import json
import random
import uuid
import hashlib
import time
import math
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 1. HOOK LIBRARY
# ═══════════════════════════════════════════════════════════════

HOOKS = [
    # Inequality / Access
    "Connection lost.",
    "Your internet shouldn't decide your career.",
    "Same skills. Different outcome.",
    "Some learn on fiber.",
    "Others try on a SIM card.",
    "Not everyone has gigabit.",
    "Your location shouldn't limit your skills.",
    "Infrastructure inequality is real.",

    # Fear / Pressure
    "One command can take everything down.",
    "Production is down.",
    "3:02 AM. Phone rings.",
    "You have 5 minutes to fix it.",
    "Everyone is waiting on you.",
    "This is why juniors panic.",

    # Identity / Ego
    "Real engineers don't copy commands.",
    "Fake sysadmin: restarts everything.",
    "Real sysadmin: reads the logs.",
    "Everyone else seems to know what they're doing.",
    "You're not behind. You're just untrained.",

    # Failure / Fix
    "System failed.",
    "Watching is easy. Doing is hard.",
    "11 failures. 1 real skill.",
    "Tutorials never look like this.",
    "It works on his machine.",
    "Again.",

    # Speed / Access
    "30 seconds to start.",
    "No VM. No setup.",
    "Free. No signup.",
    "Works offline.",
    "Even on GSM.",

    # Challenge
    "This is what interviews test.",
    "Can you solve Day 1?",
    "Break it. Fix it.",
    "You don't need better skills.",
    "You need practice.",
]

COMMANDS = [
    "sudo systemctl restart apache2",
    "docker run -d --name web nginx",
    "terraform apply -auto-approve",
    "journalctl -xe",
    "mdadm --assemble --scan",
    "fsck /dev/sda1",
    "apt install nginx -y",
    "systemctl restart mysql",
    "service ssh restart",
    "systemctl status httpd",
    "docker compose up -d",
    "kubectl get pods",
    "systemctl restart nginx",
    "iptables -L -n",
    "df -h",
    "free -m",
    "top -bn1 | head -20",
    "cat /var/log/syslog | tail -50",
    "netstat -tulpn",
    "ss -tulpn",
]

STATUS_MESSAGES = [
    "✓ Active: running",
    "✓ Service started",
    "✓ Container running",
    "✓ VM deployed",
    "✓ RAID assembled",
    "✓ Filesystem clean",
    "✓ nginx installed",
    "✓ mysql is running",
    "→ 847 lines of errors",
    "✗ Failed — timeout",
    "→ You find the answer",
]

SUPPORT_LINES = [
    "Again.",
    "Now fix it.",
    "This is how you learn.",
    "Real skills only.",
    "Not tutorials.",
    "Break it.",
    "Fix it.",
    "Same lab. Same chance.",
    "Start now.",
    "WinLab.cloud",
    "And it happens fast.",
    "Practice before it matters.",
    "No idea why.",
    "Still broken.",
    "Fix it. Fast.",
    "Something clicks.",
    "It works.",
    "Finally.",
    "Ready?",
    "What would you do?",
]

# ═══════════════════════════════════════════════════════════════
# 2. VIDEO GENERATORS
# ═══════════════════════════════════════════════════════════════

STRUCTURES = ["problem", "contrast", "solution", "fear", "identity", "speed"]

def generate_video(name_id, seed=None):
    """Generate a single video variant."""
    if seed is not None:
        random.seed(seed)

    hook = random.choice(HOOKS)
    cmd = random.choice(COMMANDS)
    status = random.choice(STATUS_MESSAGES)
    structure = random.choice(STRUCTURES)

    if structure == "problem":
        scenes = [
            {"type": "black", "duration": 0.5},
            {"type": "text", "text": hook, "duration": 2.0},
            {"type": "text", "text": random.choice(["Again.", "Still broken.", "No idea why."]), "duration": 2.0},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": random.choice(["This is how you learn.", "Real skills only.", "Start now."]), "duration": 2.5},
            {"type": "text", "text": "WinLab.cloud", "duration": 2.0, "color": "accent"},
        ]
    elif structure == "contrast":
        scenes = [
            {"type": "text", "text": hook, "duration": 2.5},
            {"type": "text", "text": random.choice(["But it does.", "Not here.", "Not anymore."]), "duration": 2.0},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": random.choice(["Same lab. Same chance.", "Practice makes the difference."]), "duration": 2.5},
            {"type": "text", "text": "WinLab.cloud", "duration": 2.0, "color": "accent"},
        ]
    elif structure == "solution":
        scenes = [
            {"type": "text", "text": hook, "duration": 2.0},
            {"type": "text", "text": random.choice(["Now fix it.", "Let's go."]), "duration": 1.5},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": random.choice(["Worth it.", "Done.", "That's the difference."]), "duration": 2.5},
        ]
    elif structure == "fear":
        scenes = [
            {"type": "text", "text": hook, "duration": 2.5},
            {"type": "text", "text": random.choice(["And it happens fast.", "No turning back."]), "duration": 2.0},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": "Practice before it matters.", "duration": 2.5},
        ]
    elif structure == "identity":
        scenes = [
            {"type": "text", "text": hook, "duration": 2.5},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": random.choice(["The difference? Practice.", "Not talent. Repetition."]), "duration": 3.0},
        ]
    else:  # speed
        scenes = [
            {"type": "text", "text": hook, "duration": 2.0},
            {"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0},
            {"type": "text", "text": random.choice(["Start now.", "No setup required.", "Just open your browser."]), "duration": 2.5},
            {"type": "text", "text": "WinLab.cloud", "duration": 2.0, "color": "accent"},
        ]

    return {
        "id": f"v{name_id:03d}",
        "name": f"video_{name_id:03d}",
        "hook": hook,
        "command": cmd,
        "structure": structure,
        "scenes": scenes,
        "cluster": classify_hook(hook),
        "is_new": True,
        "created_at": datetime.now().isoformat(),
    }


def classify_hook(hook):
    """Assign hook to content cluster."""
    h = hook.lower()
    if any(w in h for w in ["internet", "connection", "fiber", "gsm", "offline"]):
        return "inequality"
    if any(w in h for w in ["learn", "practice", "skill", "tutorial"]):
        return "learning"
    if any(w in h for w in ["fail", "fix", "broken", "down", "panic"]):
        return "challenge"
    if any(w in h for w in ["real", "fake", "engineer", "junior"]):
        return "identity"
    if any(w in h for w in ["seconds", "fast", "30", "start", "setup"]):
        return "speed"
    if any(w in h for w in ["command", "production", "interview", "test"]):
        return "technical"
    return "general"


def generate_batch(n=20, seed=None):
    """Generate n unique video variants."""
    if seed is not None:
        random.seed(seed)

    videos = []
    used_combos = set()

    attempts = 0
    while len(videos) < n and attempts < n * 10:
        attempts += 1
        v = generate_video(len(videos))
        combo = (v["hook"], v["command"], v["structure"])

        if combo not in used_combos:
            used_combos.add(combo)
            videos.append(v)

    return videos


# ═══════════════════════════════════════════════════════════════
# 3. REINFORCEMENT LOOP
# ═══════════════════════════════════════════════════════════════

def score_experiment(exp):
    """Score based on real engagement metrics."""
    views = exp.get("metrics", {}).get("views", 1)
    clicks = exp.get("metrics", {}).get("clicks", 0)
    signups = exp.get("metrics", {}).get("signups", 0)
    comments = exp.get("metrics", {}).get("comments", 0)

    ctr = clicks / max(views, 1)
    cr = signups / max(clicks, 1)
    engagement = comments / max(views, 1)

    return ctr * 0.4 + cr * 0.4 + engagement * 0.2


def select_top(experiments, n=3):
    """Select top performing experiments."""
    for exp in experiments:
        exp["_score"] = score_experiment(exp)
    return sorted(experiments, key=lambda x: x.get("_score", 0), reverse=True)[:n]


def mutate_video(base_video, new_hook=None, new_cmd=None):
    """Mutate a video with new hook or command."""
    v = {
        "id": f"v{uuid.uuid4().hex[:6]}",
        "name": f"video_{uuid.uuid4().hex[:6]}",
        "hook": new_hook or base_video.get("hook", random.choice(HOOKS)),
        "command": new_cmd or base_video.get("command", random.choice(COMMANDS)),
        "structure": base_video.get("structure", "problem"),
        "cluster": classify_hook(new_hook or base_video.get("hook", "")),
        "is_new": True,
        "created_at": datetime.now().isoformat(),
        "parent_id": base_video.get("id"),
    }

    # Regenerate scenes from mutated hook
    base_scenes = base_video.get("scenes", [])
    new_scenes = []
    for scene in base_scenes:
        if scene["type"] == "text" and scene.get("text") == base_video.get("hook"):
            new_scenes.append({"type": "text", "text": v["hook"], "duration": scene.get("duration", 2.0)})
        elif scene["type"] == "terminal":
            new_scenes.append({
                "type": "terminal",
                "cmd": v["command"],
                "status": random.choice(STATUS_MESSAGES),
                "duration": scene.get("duration", 5.0),
            })
        else:
            new_scenes.append(scene)

    v["scenes"] = new_scenes
    return v


def evolve(experiments, n_new=10):
    """Evolution loop: take top performers, mutate them."""
    top = select_top(experiments)
    new_videos = []

    for exp in top:
        base = {
            "id": exp.get("id"),
            "hook": exp.get("hook"),
            "command": exp.get("command"),
            "structure": exp.get("structure"),
            "scenes": exp.get("scenes", []),
        }
        for _ in range(n_new // len(top)):
            new_hook = random.choice(HOOKS)
            # Prefer hooks from same cluster
            cluster = exp.get("cluster", "general")
            cluster_hooks = [h for h in HOOKS if classify_hook(h) == cluster]
            if cluster_hooks:
                new_hook = random.choice(cluster_hooks)

            mutated = mutate_video(base, new_hook=new_hook)
            new_videos.append(mutated)

    return new_videos


# ═══════════════════════════════════════════════════════════════
# 4. AI HOOK GENERATION (OpenAI-compatible API)
# ═══════════════════════════════════════════════════════════════

AI_HOOK_PROMPT = """
Generate 10 short viral hooks (max 8 words) for a sysadmin training platform.

Constraints:
- Focus on {angle}
- Emotional + simple
- No buzzwords
- Sounds like Apple or Stripe marketing
- No emojis

Output as a simple list, one per line.
"""

def generate_ai_hooks(angle="inequality and access", api_key=None):
    """Generate hooks using LLM API."""
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # Fallback: return curated hooks
        return random.sample(HOOKS, min(10, len(HOOKS)))

    try:
        import requests
        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": AI_HOOK_PROMPT.format(angle=angle)}],
                "temperature": 0.9,
            },
            timeout=15,
        )
        data = res.json()
        text = data["choices"][0]["message"]["content"]
        hooks = [h.strip("- *").strip() for h in text.split("\n") if h.strip() and len(h.strip()) > 5]
        return hooks[:10]
    except:
        return random.sample(HOOKS, min(10, len(HOOKS)))


# ═══════════════════════════════════════════════════════════════
# 5. LANDING PAGE MATCHER
# ═══════════════════════════════════════════════════════════════

LANDING_TEMPLATES = {
    "inequality": {
        "headline": "Your internet shouldn't decide your career.",
        "sub": "Practice real sysadmin skills without needing stable internet.",
        "cta": "Start Free Lab",
        "bullets": ["Works offline", "Runs on GSM", "No setup required"],
    },
    "learning": {
        "headline": "You don't learn sysadmin by watching.",
        "sub": "Practice real scenarios in a realistic terminal sandbox.",
        "cta": "Start Free Lab",
        "bullets": ["Hands-on practice", "Real Linux scenarios", "Instant feedback"],
    },
    "challenge": {
        "headline": "Break it. Fix it.",
        "sub": "Learn by solving real production failures.",
        "cta": "Start Free Lab",
        "bullets": ["11 scenarios", "No consequences", "Real skills"],
    },
    "identity": {
        "headline": "Real skills. No shortcuts.",
        "sub": "The difference between tutorials and real practice.",
        "cta": "Start Free Lab",
        "bullets": ["Not copy-paste", "Real troubleshooting", "Build confidence"],
    },
    "speed": {
        "headline": "30 seconds to a real lab.",
        "sub": "No VM. No setup. Just practice.",
        "cta": "Start Free Lab",
        "bullets": ["Instant start", "No install", "Browser-based"],
    },
    "technical": {
        "headline": "This is what interviews actually test.",
        "sub": "Real sysadmin scenarios. Not theory.",
        "cta": "Start Free Lab",
        "bullets": ["RAID, LDAP, vSphere", "Real failures", "Verified skills"],
    },
    "general": {
        "headline": "Practice real sysadmin skills.",
        "sub": "Free Linux labs. No setup required.",
        "cta": "Start Free Lab",
        "bullets": ["Browser-based", "Real scenarios", "AI Mentor"],
    },
}


def generate_landing_for_video(video):
    """Generate matched landing page content for a video."""
    cluster = video.get("cluster", "general")
    template = LANDING_TEMPLATES.get(cluster, LANDING_TEMPLATES["general"])

    # Customize with actual hook if it fits the cluster
    hook = video.get("hook", "")
    if cluster == "inequality" and any(w in hook.lower() for w in ["connection", "internet"]):
        template = dict(template)
        template["headline"] = hook

    return {
        "headline": template["headline"],
        "sub": template["sub"],
        "cta": template["cta"],
        "bullets": template["bullets"],
        "cluster": cluster,
        "source_url": f"https://winlab.cloud/?src={cluster}&vid={video.get('id', 'unknown')}",
    }


# ═══════════════════════════════════════════════════════════════
# 6. EXPORT + INTEGRATION
# ═══════════════════════════════════════════════════════════════

def export_videos(videos, out_dir="vhs/output"):
    """Export video definitions as JSON for the vertical engine."""
    os.makedirs(out_dir, exist_ok=True)
    manifest = []

    for v in videos:
        path = os.path.join(out_dir, f"{v['name']}.json")
        with open(path, "w") as f:
            json.dump(v, f, indent=2)
        manifest.append({"id": v["id"], "name": v["name"], "file": path})

    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  ✓ Exported {len(videos)} videos → {out_dir}/")
    return manifest_path


def export_for_vertical_engine(videos, out_dir="vhs/output"):
    """Generate Python render calls for each video."""
    lines = [
        "# Auto-generated video configs for vertical_engine.py",
        f"# {len(videos)} videos generated at {datetime.now().isoformat()}",
        "",
        "AUTO_VIDEOS = [",
    ]

    for v in videos:
        lines.append("    {")
        lines.append(f'        "name": "{v["name"]}",')
        lines.append(f'        "hook": "{v["hook"]}",')
        lines.append(f'        "command": "{v["command"]}",')
        lines.append(f'        "structure": "{v["structure"]}",')
        lines.append(f'        "cluster": "{v["cluster"]}",')
        lines.append(f'        "scenes": {json.dumps(v["scenes"])},')
        lines.append("    },")

    lines.append("]")
    lines.append("")

    path = os.path.join(out_dir, "auto_videos_config.py")
    with open(path, "w") as f:
        f.write("\n".join(lines))

    print(f"  ✓ Generated {path}")
    return path


# ═══════════════════════════════════════════════════════════════
# 7. PIPELINE
# ═══════════════════════════════════════════════════════════════

def run_pipeline(n=20, out_dir="vhs/output", data_path=None):
    """Full pipeline: generate → optionally evolve → export."""
    print("═" * 50)
    print("  WINLAB CONTENT ENGINE")
    print(f"  Generating {n} video variants")
    print("═" * 50)

    # If we have performance data, evolve instead of random
    if data_path and os.path.exists(data_path):
        print(f"\n  Loading performance data: {data_path}")
        with open(data_path) as f:
            experiments = json.load(f)
        print(f"  Found {len(experiments)} experiments")
        print(f"  Evolving top performers...")
        videos = evolve(experiments, n_new=n)
    else:
        print(f"\n  Fresh generation (no performance data found)")
        videos = generate_batch(n)

    # Show stats
    structures = {}
    clusters = {}
    for v in videos:
        structures[v["structure"]] = structures.get(v["structure"], 0) + 1
        clusters[v["cluster"]] = clusters.get(v["cluster"], 0) + 1

    print(f"\n  Structure distribution:")
    for s, c in sorted(structures.items()):
        print(f"    {s}: {c}")
    print(f"\n  Cluster distribution:")
    for cl, c in sorted(clusters.items()):
        print(f"    {cl}: {c}")

    # Export
    print()
    manifest = export_videos(videos, out_dir)
    py_config = export_for_vertical_engine(videos, out_dir)

    # Generate landing mappings
    landings = []
    for v in videos:
        landing = generate_landing_for_video(v)
        landings.append({"video_id": v["id"], "video_name": v["name"], **landing})

    landing_path = os.path.join(out_dir, "landings.json")
    with open(landing_path, "w") as f:
        json.dump(landings, f, indent=2)
    print(f"  ✓ Generated {landing_path}")

    return videos, manifest, landings


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Content Engine")
    parser.add_argument("--generate", "-g", type=int, help="Generate N video variants")
    parser.add_argument("--evolve", "-e", action="store_true", help="Evolve from performance data")
    parser.add_argument("--data", "-d", default="data/performance.json", help="Performance data path")
    parser.add_argument("--output", "-o", default="vhs/output", help="Output directory")
    parser.add_argument("--pipeline", "-p", action="store_true", help="Run full pipeline")
    parser.add_argument("--ai-hooks", action="store_true", help="Generate hooks with AI")
    parser.add_argument("--angle", default="inequality and access", help="AI hook generation angle")
    parser.add_argument("--seed", type=int, help="Random seed for reproducibility")

    args = parser.parse_args()

    if args.ai_hooks:
        hooks = generate_ai_hooks(args.angle)
        print(f"Generated {len(hooks)} AI hooks for angle: {args.angle}")
        for i, h in enumerate(hooks, 1):
            print(f"  {i}. {h}")
        return

    n = args.generate or 20

    if args.pipeline:
        run_pipeline(n, out_dir=args.output, data_path=args.data if args.evolve else None)
    elif args.generate or args.evolve:
        data = args.data if args.evolve else None
        run_pipeline(n, out_dir=args.output, data_path=data)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
