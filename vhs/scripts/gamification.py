"""
WinLab Gamification Engine — Rank, Badges, Leaderboard, Replay
===============================================================
Tracks user progress, assigns ranks and badges, generates
personalized replay videos for failed scenarios.

Usage:
  # Show leaderboard
  python vhs/scripts/gamification.py --leaderboard

  # Simulate user actions
  python vhs/scripts/gamification.py --simulate 50

  # Generate replay video for a user
  python vhs/scripts/gamification.py --replay user_123

  # Export badge overlays
  python vhs/scripts/gamification.py --export-badges
"""

import os
import json
import random
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 1. RANK SYSTEM
# ═══════════════════════════════════════════════════════════════

RANKS = [
    {"name": "Junior",          "min": 0,   "color": "#9ca3af"},
    {"name": "Intermediate",    "min": 100,  "color": "#60a5fa"},
    {"name": "Senior",          "min": 300,  "color": "#22c55e"},
    {"name": "Expert",          "min": 700,  "color": "#f59e00"},
    {"name": "Principal",       "min": 1500, "color": "#a855f7"},
]

BADGES = {
    "first_fix":       {"name": "First Fix",         "icon": "🔧", "desc": "Fixed your first scenario"},
    "no_panic":        {"name": "Stayed Calm",       "icon": "😎", "desc": "Solved without restarting"},
    "log_master":      {"name": "Log Master",        "icon": "📋", "desc": "Used journalctl to debug"},
    "fast_response":   {"name": "Under 5s",          "icon": "⚡", "desc": "Solved in under 5 seconds"},
    "streak_3":        {"name": "3 Day Streak",      "icon": "🔥", "desc": "Practiced 3 days in a row"},
    "streak_7":        {"name": "Week Warrior",      "icon": "🔥", "desc": "Practiced 7 days in a row"},
    "all_base":        {"name": "Base Cleared",      "icon": "🏆", "desc": "Completed all base labs"},
    "first_adv":       {"name": "Advanced First Blood","icon": "💀", "desc": "Completed first advanced lab"},
    "night_owl":       {"name": "Night Owl",         "icon": "🦉", "desc": "Solved at 3AM"},
    "perfect":         {"name": "Perfect Run",       "icon": "✨", "desc": "No wrong choices in a lab"},
}


def get_rank(score):
    """Get rank name and color from score."""
    for r in reversed(RANKS):
        if score >= r["min"]:
            return r["name"], r["color"]
    return RANKS[0]["name"], RANKS[0]["color"]


# ═══════════════════════════════════════════════════════════════
# 2. USER MODEL
# ═══════════════════════════════════════════════════════════════

def create_user(user_id, name=None):
    """Create a new user profile."""
    return {
        "id": user_id,
        "name": name or user_id,
        "score": 0,
        "rank": "Junior",
        "badges": [],
        "choices": [],
        "failures": [],
        "scenarios_completed": [],
        "streak": 0,
        "last_active": None,
        "created_at": datetime.now().isoformat(),
    }


def update_score(user, points):
    """Update user score and rank."""
    user["score"] += points
    rank_name, _ = get_rank(user["score"])
    user["rank"] = rank_name
    return user


def assign_badge(user, badge_key):
    """Assign a badge if not already earned."""
    if badge_key not in user["badges"]:
        user["badges"].append(badge_key)
        return True
    return False


def evaluate_choice(user, scenario, choice, correct, response_time=None):
    """Process a user's choice in a scenario."""
    user["choices"].append({
        "scenario": scenario,
        "choice": choice,
        "correct": correct,
        "timestamp": datetime.now().isoformat(),
    })

    if correct:
        points = 20
        if response_time and response_time < 5:
            points = 30
            assign_badge(user, "fast_response")
        if not user["failures"]:
            assign_badge(user, "first_fix")
        if len(user["choices"]) > 0 and all(c["correct"] for c in user["choices"][-5:]):
            assign_badge(user, "perfect")

        user["scenarios_completed"].append(scenario)
    else:
        points = 0
        user["failures"].append({
            "scenario": scenario,
            "choice": choice,
            "timestamp": datetime.now().isoformat(),
        })

    update_score(user, points)
    return user, points


# ═══════════════════════════════════════════════════════════════
# 3. LEADERBOARD
# ═══════════════════════════════════════════════════════════════

def leaderboard(users, top_n=10):
    """Get top N users by score."""
    sorted_users = sorted(users.values(), key=lambda u: u["score"], reverse=True)
    return sorted_users[:top_n]


def format_leaderboard(users, top_n=10):
    """Format leaderboard for display."""
    lb = leaderboard(users, top_n)
    lines = ["\n  🏆 TOP ENGINEERS\n", "  Rank  Score  Name          Badges"]
    lines.append("  " + "-" * 50)

    for i, u in enumerate(lb, 1):
        rank_name, rank_color = get_rank(u["score"])
        badge_count = len(u["badges"])
        lines.append(f"  {i:4d}  {u['score']:5d}  {u['name']:<14s} 🏅×{badge_count} ({rank_name})")

    lines.append("")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
# 4. PERSONALIZED REPLAY
# ═══════════════════════════════════════════════════════════════

def generate_replay_video(user):
    """Generate a personalized replay video for a user's last failure."""
    if not user["failures"]:
        return None

    last_fail = user["failures"][-1]
    rank_name, _ = get_rank(user["score"])

    scenes = [
        {"type": "text", "text": f"You failed this before.", "duration": 2.5},
        {"type": "text", "text": f"Rank: {rank_name}", "duration": 2.0, "color": "accent"},
        {"type": "text", "text": "Try again.", "duration": 2.0},
    ]

    # Re-present the failed scenario
    scenario_cmds = {
        "apache_down": ("systemctl status apache2", "● failed"),
        "mysql_crash": ("systemctl status mysqld", "Active: failed"),
        "disk_full": ("df -h", "/dev/sda1  100%"),
        "ssh_refused": ("ssh user@server", "Connection refused"),
        "dns_broken": ("nslookup google.com", "connection timed out"),
    }

    scenario = last_fail["scenario"]
    if scenario in scenario_cmds:
        cmd, status = scenario_cmds[scenario]
        scenes.append({"type": "terminal", "cmd": cmd, "status": status, "duration": 5.0})
    else:
        scenes.append({"type": "text", "text": f"Scenario: {scenario}", "duration": 3.0})

    scenes.append({"type": "text", "text": "What do you do now?", "duration": 2.5, "color": "accent"})

    return {
        "id": f"replay_{user['id']}_{len(user['failures'])}",
        "name": f"replay_{user['id']}",
        "type": "replay",
        "user_id": user["id"],
        "failed_scenario": scenario,
        "scenes": scenes,
        "created_at": datetime.now().isoformat(),
    }


def generate_hardcore_video(user):
    """Generate a timed challenge video."""
    scenes = [
        {"type": "text", "text": "HARDCORE MODE", "duration": 1.5, "color": "error"},
        {"type": "text", "text": "You have 10 seconds.", "duration": 2.0},
        {"type": "terminal", "cmd": "Production is down.", "status": "⚡ 10s timer", "duration": 4.0},
        {"type": "text", "text": "What's your first command?", "duration": 3.0},
    ]

    return {
        "id": f"hardcore_{user['id']}",
        "name": f"hardcore_{user['id']}",
        "type": "hardcore",
        "user_id": user["id"],
        "scenes": scenes,
        "created_at": datetime.now().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# 5. BADGE OVERLAY RENDERER (for video frames)
# ═══════════════════════════════════════════════════════════════

def render_badge_overlay(user):
    """Generate badge overlay data for video rendering."""
    rank_name, rank_color = get_rank(user["score"])

    overlay = {
        "rank": rank_name,
        "rank_color": rank_color,
        "score": user["score"],
        "badges": [],
    }

    for badge_key in user["badges"]:
        if badge_key in BADGES:
            badge = BADGES[badge_key]
            overlay["badges"].append({
                "icon": badge["icon"],
                "name": badge["name"],
                "color": rank_color,
            })

    return overlay


# ═══════════════════════════════════════════════════════════════
# 6. SIMULATION
# ═══════════════════════════════════════════════════════════════

SCENARIOS = ["apache_down", "mysql_crash", "disk_full", "ssh_refused", "dns_broken"]

def simulate_user(user_id, actions=20):
    """Simulate a user's journey for testing."""
    random.seed(hash(user_id))
    user = create_user(user_id, name=f"User_{user_id}")

    for i in range(actions):
        scenario = random.choice(SCENARIOS)
        choice = random.choice(["A", "B"])
        correct = random.random() > 0.4  # 60% success rate
        response_time = random.uniform(2, 15)

        user, points = evaluate_choice(user, scenario, choice, correct, response_time)

        # Random badge events
        if random.random() < 0.1:
            assign_badge(user, "no_panic")
        if random.random() < 0.05:
            assign_badge(user, "log_master")
        if random.random() < 0.03:
            assign_badge(user, "night_owl")

    return user


def simulate_users(n=20):
    """Simulate n users for leaderboard testing."""
    users = {}
    for i in range(n):
        uid = f"user_{i:03d}"
        users[uid] = simulate_user(uid, actions=random.randint(10, 50))
    return users


# ═══════════════════════════════════════════════════════════════
# 7. DATA PERSISTENCE
# ═══════════════════════════════════════════════════════════════

def save_users(users, path="data/users.json"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(users, f, indent=2)


def load_users(path="data/users.json"):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Gamification Engine")
    parser.add_argument("--leaderboard", "-l", action="store_true", help="Show leaderboard")
    parser.add_argument("--simulate", "-s", type=int, help="Simulate N users")
    parser.add_argument("--replay", "-r", help="Generate replay for user ID")
    parser.add_argument("--export-badges", action="store_true", help="Export badge definitions")
    parser.add_argument("--data", "-d", default="data/users.json", help="Data file path")
    parser.add_argument("--output", "-o", default="vhs/output", help="Output directory")

    args = parser.parse_args()

    users = load_users(args.data)

    if args.simulate:
        print(f"Simulating {args.simulate} users...")
        sim_users = simulate_users(args.simulate)
        users.update(sim_users)
        save_users(users, args.data)
        print(f"  ✓ Saved to {args.data}")
        print(format_leaderboard(users))

    elif args.leaderboard:
        if not users:
            print("No users found. Run --simulate first.")
            return
        print(format_leaderboard(users))

    elif args.replay:
        if args.replay not in users:
            print(f"User not found: {args.replay}")
            return
        user = users[args.replay]
        replay = generate_replay_video(user)
        if replay:
            os.makedirs(args.output, exist_ok=True)
            path = os.path.join(args.output, f"{replay['name']}.json")
            with open(path, "w") as f:
                json.dump(replay, f, indent=2)
            print(f"  ✓ Replay generated: {path}")
            print(f"  Scenario: {replay['failed_scenario']}")
            for s in replay["scenes"]:
                print(f"    {s.get('text', s.get('cmd', ''))}")
        else:
            print(f"  No failures for user {args.replay}")

    elif args.export_badges:
        os.makedirs(args.output, exist_ok=True)
        path = os.path.join(args.output, "badges.json")
        with open(path, "w") as f:
            json.dump(BADGES, f, indent=2)
        print(f"  ✓ Exported {len(BADGES)} badges → {path}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
