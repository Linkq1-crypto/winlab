"""
WinLab Comment Engine — AI Responses + Viral Thread Finder
===========================================================
1. Auto-respond to comments (boost algorithm engagement)
2. Find viral threads to "attach" to (growth hack)

Usage:
  # Auto-respond to comments on a platform
  python vhs/scripts/comment_engine.py --respond --platform tiktok --comments-file data/comments.json

  # Find viral threads to engage with
  python vhs/scripts/comment_engine.py --find-threads --platform linkedin --topic "sysadmin"

  # Generate smart replies for all pending comments
  python vhs/scripts/comment_engine.py --smart-replies --comments-file data/comments.json

  # Full engagement loop
  python vhs/scripts/comment_engine.py --engagement-loop
"""

import os
import sys
import json
import random
import hashlib
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 1. COMMENT RESPONSE ENGINE
# ═══════════════════════════════════════════════════════════════

# Response templates by comment type
RESPONSE_TEMPLATES = {
    "question": [
        "Great question! The whole point is that you don't need perfect setup to practice. Try it yourself → winlab.cloud",
        "This is exactly what we built WinLab for. No VM, no setup, just practice → winlab.cloud",
        "You're thinking about it right — real skills come from doing, not watching. Give it a try: winlab.cloud",
    ],
    "praise": [
        "Appreciate that! We built this because tutorials alone aren't enough. Keep practicing 💪",
        "Thank you! The real magic happens when you actually break things and fix them yourself.",
        "Means a lot! We're adding new scenarios every week. Stay tuned.",
    ],
    "skeptic": [
        "Fair point! It's not about replacing real experience — it's about practicing safely before production. Try a free lab and see what you think.",
        "I get the hesitation. That's exactly why we made it free with no signup — zero risk to try it.",
        "Valid! We're not saying it replaces everything. It's a safe sandbox to build muscle memory first.",
    ],
    "technical": [
        "Good catch! We actually cover this in the advanced labs. The terminal simulation is designed to match real behavior, not just output text.",
        "You're right to ask — we model real system states, not fake outputs. That's the whole difference.",
        "Nice insight! We're adding more scenarios every week. What would you want to see next?",
    ],
    "personal_story": [
        "This is exactly why we built WinLab. Everyone deserves a chance to practice, regardless of their setup.",
        "Your story is why this matters. Access shouldn't be the barrier to learning real skills.",
        "Thank you for sharing this. It's real stories like yours that drive what we build.",
    ],
    "humor": [
        "😂 We've all been there. That's why you practice in a sandbox, not production.",
        "HAHA yes. This is why we need safe places to break things before they matter.",
        "😅 Classic. Practice makes it a lot less painful when it happens for real.",
    ],
    "generic": [
        "Thanks for engaging! If you ever want to practice real sysadmin scenarios, check out winlab.cloud",
        "Appreciate the comment! We're building this for engineers who want to practice safely.",
        "Good to connect with fellow engineers! WinLab.cloud if you ever want hands-on practice.",
    ],
}


def classify_comment(comment):
    """Classify a comment by type."""
    text = comment.get("text", "").lower()

    # Questions
    if any(w in text for w in ["?", "how", "what", "why", "when", "where", "does it", "can i", "is it"]):
        return "question"

    # Praise
    if any(w in text for w in ["great", "awesome", "love", "amazing", "cool", "nice", "good job", "brilliant", "🔥", "👏", "💯"]):
        return "praise"

    # Skeptic
    if any(w in text for w in ["not real", "fake", "too good", "scam", "bs", "doesn't work"]):
        return "skeptic"

    # Technical
    if any(w in text for w in ["systemctl", "docker", "linux", "terminal", "scenario", "lab", "vm", "server"]):
        return "technical"

    # Personal story
    if any(w in text for w in ["i had", "my experience", "when i", "i was", "i remember", "back when", "my story"]):
        return "personal_story"

    # Humor
    if any(w in text for w in ["😂", "haha", "lol", "lmao", "😅", "😆", "funny", "same", "meirl"]):
        return "humor"

    return "generic"


def generate_reply(comment, style="friendly"):
    """Generate a smart reply to a comment."""
    ctype = classify_comment(comment)
    templates = RESPONSE_TEMPLATES.get(ctype, RESPONSE_TEMPLATES["generic"])

    # Pick a template
    reply = random.choice(templates)

    # Personalize with commenter name if available
    name = comment.get("author", "").split()[0] if comment.get("author") else ""
    if name and random.random() > 0.5:
        reply = f"{name}, " + reply[0].lower() + reply[1:]

    return {
        "reply": reply,
        "type": ctype,
        "style": style,
        "generated_at": datetime.now().isoformat(),
    }


def generate_ai_reply(comment, api_key=None):
    """Generate a reply using LLM API (more contextual)."""
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return generate_reply(comment)  # Fallback to templates

    try:
        import requests

        prompt = f"""
        Reply to this YouTube/TikTok comment naturally and briefly.

        Comment: "{comment.get('text', '')}"
        Author: {comment.get('author', 'User')}
        Video topic: WinLab — sysadmin training platform that works offline

        Rules:
        - Max 2 sentences
        - Friendly, not salesy
        - Mention winlab.cloud only if natural
        - Sound like a real person, not a bot
        - No hashtags, no emojis unless the comment used them

        Reply:
        """

        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.8,
                "max_tokens": 100,
            },
            timeout=10,
        )
        data = res.json()
        reply = data["choices"][0]["message"]["content"].strip()

        return {
            "reply": reply,
            "type": classify_comment(comment),
            "style": "ai",
            "generated_at": datetime.now().isoformat(),
        }
    except:
        return generate_reply(comment)


# ═══════════════════════════════════════════════════════════════
# 2. VIRAL THREAD FINDER
# ═══════════════════════════════════════════════════════════════

# Keywords that signal viral opportunity
VIRAL_KEYWORDS = {
    "sysadmin": [
        "linux", "systemd", "apache", "nginx", "mysql", "docker",
        "kubernetes", "terraform", "ansible", "devops",
        "server down", "production issue", "outage", "incident",
        "sysadmin life", "sysadmin problems", "system administrator",
    ],
    "career": [
        "junior engineer", "first job", "tech career", "learn to code",
        "tech interview", "engineering interview", "break into tech",
        "self taught", "bootcamp", "cs degree",
        "tech skills", "career advice", "get hired",
    ],
    "infrastructure": [
        "internet access", "digital divide", "infrastructure inequality",
        "rural internet", "developing country tech", "tech access",
        "learning barriers", "education gap", "opportunity gap",
    ],
    "learning": [
        "learn linux", "practice devops", "hands-on learning",
        "tutorial vs practice", "learn by doing", "real experience",
        "theory vs practice", "how to learn sysadmin",
    ],
}

# Platforms to search
PLATFORMS = ["linkedin", "twitter", "reddit", "hackernews"]

# Thread quality scoring
def score_thread(thread):
    """Score a thread's viral potential."""
    score = 0

    # Engagement
    score += thread.get("likes", 0) * 0.5
    score += thread.get("comments", 0) * 2  # Comments more valuable
    score += thread.get("shares", 0) * 3
    score += thread.get("views", 0) * 0.01

    # Recency (prefer < 48h old)
    hours_old = thread.get("hours_old", 999)
    if hours_old < 2:
        score *= 2
    elif hours_old < 12:
        score *= 1.5
    elif hours_old < 48:
        score *= 1.2
    else:
        score *= 0.5

    # Relevance
    score += thread.get("relevance", 0) * 10

    return score


def generate_engagement_reply(thread):
    """Generate a value-add reply to attach to a viral thread."""
    hook = thread.get("content", "").lower()
    topic = thread.get("topic", "general")

    replies = {
        "sysadmin": [
            "This is exactly why practice in a safe environment matters. Real scenarios > tutorials every time.",
            "Been there. The difference between panic and confidence? Muscle memory from practice.",
            "This scenario is actually one of the labs we built. The key is: always check logs before restarting.",
        ],
        "career": [
            "The real gap isn't talent — it's access to practice. Everyone deserves hands-on experience.",
            "This is why we made a lab that works on any connection. Skills shouldn't depend on infrastructure.",
            "Real talk: tutorials don't build confidence. Breaking things and fixing them does.",
        ],
        "infrastructure": [
            "This is the conversation nobody wants to have. Access inequality is real.",
            "We built WinLab because of exactly this — not everyone has gigabit to practice on.",
            "Internet shouldn't decide your career. Practice should be accessible everywhere.",
        ],
        "learning": [
            "Tutorials create false confidence. Real learning starts when things break.",
            "The best way to learn? Break things safely, then fix them. Repeat until it clicks.",
            "Watching someone fix a server ≠ being able to fix a server. Hands-on is everything.",
        ],
        "general": [
            "This resonates. We built something to help with exactly this → winlab.cloud",
            "100%. This is why practice environments matter more than tutorials.",
            "Real experience comes from real failures. Safe places to fail are underrated.",
        ],
    }

    return random.choice(replies.get(topic, replies["general"]))


def find_viral_threads_mock(platform="linkedin", topic="sysadmin"):
    """
    Mock viral thread finder (simulated data).
    Replace with actual API calls to LinkedIn/Twitter/Reddit.
    """
    # Simulated viral threads
    threads = [
        {
            "id": f"{platform}_001",
            "platform": platform,
            "author": "TechLead_Pro",
            "content": "Hot take: Most junior engineers can't debug because they've never broken anything in production.",
            "likes": 2400,
            "comments": 180,
            "shares": 320,
            "views": 45000,
            "hours_old": 6,
            "topic": "sysadmin",
            "url": f"https://{platform}.com/post/001",
        },
        {
            "id": f"{platform}_002",
            "platform": platform,
            "author": "DevOps_Daily",
            "content": "Your internet speed shouldn't determine your engineering career. But it does.",
            "likes": 1800,
            "comments": 95,
            "shares": 210,
            "views": 32000,
            "hours_old": 12,
            "topic": "infrastructure",
            "url": f"https://{platform}.com/post/002",
        },
        {
            "id": f"{platform}_003",
            "platform": platform,
            "author": "Linux_Enthusiast",
            "content": "Tutorial hell is real. I watched 100 hours of Docker videos and still couldn't run a container.",
            "likes": 3200,
            "comments": 250,
            "shares": 480,
            "views": 67000,
            "hours_old": 3,
            "topic": "learning",
            "url": f"https://{platform}.com/post/003",
        },
        {
            "id": f"{platform}_004",
            "platform": platform,
            "author": "CareerInTech",
            "content": "I failed my first sysadmin interview because I couldn't troubleshoot a real scenario. Theory wasn't enough.",
            "likes": 1500,
            "comments": 120,
            "shares": 190,
            "views": 28000,
            "hours_old": 18,
            "topic": "career",
            "url": f"https://{platform}.com/post/004",
        },
    ]

    # Score and rank
    for t in threads:
        t["score"] = score_thread(t)
        t["suggested_reply"] = generate_engagement_reply(t)

    return sorted(threads, key=lambda x: x["score"], reverse=True)


# ═══════════════════════════════════════════════════════════════
# 3. ENGAGEMENT LOOP
# ═══════════════════════════════════════════════════════════════

def process_comments(comments, use_ai=False, output_dir="data"):
    """Process all pending comments and generate replies."""
    results = []

    for comment in comments:
        if use_ai:
            reply = generate_ai_reply(comment)
        else:
            reply = generate_reply(comment)

        result = {
            "comment_id": comment.get("id", f"c{hashlib.md5(comment.get('text', '').encode()).hexdigest()[:8]}"),
            "author": comment.get("author", "Unknown"),
            "text": comment.get("text", ""),
            "platform": comment.get("platform", "unknown"),
            "reply": reply["reply"],
            "reply_type": reply["type"],
            "style": reply["style"],
            "posted": False,
            "scheduled_at": datetime.now().isoformat(),
        }
        results.append(result)

    # Save replies
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, "generated_replies.json")
    with open(path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"  ✓ Generated {len(results)} replies → {path}")
    return results


def run_engagement_loop(comments_path="data/comments.json", use_ai=False):
    """Full engagement loop: find threads → respond → track."""
    # Load comments
    if os.path.exists(comments_path):
        with open(comments_path) as f:
            comments = json.load(f)
    else:
        print(f"  No comments file at {comments_path}. Using mock data.")
        comments = [
            {"id": "c1", "author": "DevUser42", "text": "This is amazing! How do I try it?", "platform": "tiktok"},
            {"id": "c2", "author": "SkepticEng", "text": "But is it really like production?", "platform": "linkedin"},
            {"id": "c3", "author": "JuniorOps", "text": "I had the exact same problem last week 😂", "platform": "tiktok"},
            {"id": "c4", "author": "SysAdmin_Pro", "text": "What scenarios do you cover?", "platform": "youtube"},
            {"id": "c5", "author": "CareerChanger", "text": "Finally something accessible. My internet is terrible.", "platform": "linkedin"},
        ]

    print(f"  Processing {len(comments)} comments...")
    replies = process_comments(comments, use_ai=use_ai)

    # Show preview
    for r in replies[:5]:
        print(f"    @{r['author']}: {r['text'][:50]}...")
        print(f"    → {r['reply'][:80]}...")
        print()

    # Also find viral threads
    print("  Finding viral threads to engage with...")
    threads = find_viral_threads_mock("linkedin", "sysadmin")
    print(f"  Found {len(threads)} viral threads")

    for t in threads[:3]:
        print(f"    🔥 {t['score']:.0f} pts — {t['author']}: {t['content'][:60]}...")
        print(f"       Suggested: {t['suggested_reply'][:70]}...")
        print()

    return replies, threads


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Comment Engine")
    parser.add_argument("--respond", action="store_true", help="Auto-respond to comments")
    parser.add_argument("--find-threads", action="store_true", help="Find viral threads to engage with")
    parser.add_argument("--smart-replies", action="store_true", help="Generate smart replies for pending comments")
    parser.add_argument("--engagement-loop", action="store_true", help="Run full engagement loop")
    parser.add_argument("--comments-file", default="data/comments.json", help="Path to comments JSON")
    parser.add_argument("--platform", default="linkedin", help="Platform to search/respond on")
    parser.add_argument("--topic", default="sysadmin", help="Topic to search for")
    parser.add_argument("--ai", action="store_true", help="Use AI for reply generation")
    parser.add_argument("--output", "-o", default="data", help="Output directory")
    parser.add_argument("--count", "-n", type=int, default=10, help="Number of threads to find")

    args = parser.parse_args()

    if args.engagement_loop:
        print("═" * 50)
        print("  WINLAB ENGAGEMENT LOOP")
        print("═" * 50)
        print()
        run_engagement_loop(args.comments_file, use_ai=args.ai)

    elif args.respond:
        print(f"Auto-responding to comments on {args.platform}...")
        if os.path.exists(args.comments_file):
            with open(args.comments_file) as f:
                comments = json.load(f)
            replies = process_comments(comments, use_ai=args.ai, output_dir=args.output)
            for r in replies:
                print(f"  @{r['author']}: {r['reply'][:80]}...")
        else:
            print(f"  No comments file at {args.comments_file}")

    elif args.find_threads:
        print(f"Finding viral threads on {args.platform} about {args.topic}...")
        threads = find_viral_threads_mock(args.platform, args.topic)
        print(f"\n  Found {len(threads)} viral threads:\n")
        for i, t in enumerate(threads[:args.count], 1):
            print(f"  {i}. 🔥 {t['score']:.0f} pts — {t['platform']}/{t['author']}")
            print(f"     {t['content'][:80]}")
            print(f"     👍 {t['likes']} 💬 {t['comments']} 🔄 {t['shares']} 👁 {t['views']}")
            print(f"     ⏰ {t['hours_old']}h ago")
            print(f"     💬 Suggested: {t['suggested_reply'][:80]}...")
            print()

    elif args.smart_replies:
        print("Generating smart replies...")
        if os.path.exists(args.comments_file):
            with open(args.comments_file) as f:
                comments = json.load(f)
            for c in comments:
                ctype = classify_comment(c)
                reply = generate_ai_reply(c) if args.ai else generate_reply(c)
                print(f"  [{ctype}] @{c.get('author', '?')}: {c.get('text', '')[:50]}...")
                print(f"    → {reply['reply'][:80]}...")
                print()
        else:
            print(f"  No comments file at {args.comments_file}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
