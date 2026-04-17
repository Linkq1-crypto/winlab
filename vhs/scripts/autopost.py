"""
WinLab Auto-Post & Growth Engine
==================================
Complete pipeline: Render → Thumbnail → Schedule → Post → Track → Scale

Features:
  - Face/emotion-based thumbnail generation
  - Multi-platform scheduler (YouTube, TikTok, IG, LinkedIn, FB)
  - Growth engine: repost winners, scale to all platforms
  - Live analytics dashboard
  - CTR optimization with A/B testing

Usage:
  # Generate emotion-based thumbnails with faces
  python vhs/scripts/autopost.py --thumbnails --hook "Connection lost"

  # Schedule a launch (video + all platforms)
  python vhs/scripts/autopost.py --launch vhs/output/hero.mp4

  # Run growth loop (repost winners + scale)
  python vhs/scripts/autopost.py --growth

  # Launch dashboard
  streamlit run vhs/scripts/dashboard.py
"""

import os
import sys
import json
import random
import time
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

# ═══════════════════════════════════════════════════════════════
# 1. EMOTION → FACE THUMBNAIL GENERATOR
# ═══════════════════════════════════════════════════════════════

# Hook → Emotion mapping
EMOTION_MAP = {
    "connection": "frustrated",
    "internet": "determined",
    "lost": "stressed",
    "failed": "focused",
    "fail": "stressed",
    "down": "panicked",
    "fix": "determined",
    "broken": "worried",
    "panic": "anxious",
    "skill": "confident",
    "learn": "curious",
    "practice": "focused",
    "incident": "urgent",
    "3am": "tired but alert",
    "fiber": "frustrated",
    "sim": "resigned",
    "restart": "hopeful",
    "logs": "analytical",
    "interview": "confident",
    "career": "ambitious",
}

# Emotion → AI Image Prompt
EMOTION_PROMPTS = {
    "frustrated": "A young sysadmin engineer in a dark room, illuminated by a computer screen showing red error messages, expression frustrated and determined, cinematic lighting, high contrast, minimal dark background, tech atmosphere, photorealistic portrait, YouTube thumbnail style, 4k",
    "determined": "A young engineer looking at a monitor with intense determination, dark room lit by screen glow, focused expression, cinematic portrait lighting, shallow depth of field, professional photography, YouTube thumbnail",
    "stressed": "A sysadmin with hands on head looking at a terminal error, stressed expression, dark room with screen light on face, dramatic lighting, high contrast, cinematic portrait, photorealistic",
    "focused": "A young engineer reading terminal logs with intense focus, screen light illuminating face, analytical expression, dark minimal background, cinematic portrait photography, YouTube thumbnail style",
    "panicked": "A sysadmin looking at a 'Production Down' alert with wide eyes, panicked expression, dark server room with red emergency lighting, dramatic cinematic portrait, photorealistic",
    "worried": "An engineer looking at a RAID failure alert, worried expression, dimly lit room with monitor glow, cinematic portrait, dark moody atmosphere, YouTube thumbnail style",
    "confident": "A sysadmin with arms crossed, confident smile, standing in front of server racks, blue ambient lighting, professional portrait, cinematic quality, YouTube thumbnail",
    "curious": "A young engineer tilting head while reading error logs, curious and engaged expression, dark room lit by screen, cinematic portrait, photorealistic",
    "urgent": "A sysadmin typing rapidly with intense urgency, phone ringing, 3AM setting, dramatic lighting, cinematic portrait, dark atmosphere with warm screen glow",
    "tired but alert": "An engineer at 3AM with coffee, tired eyes but alert expression, dark room with multiple monitors, cinematic portrait, photorealistic YouTube thumbnail",
    "analytical": "A sysadmin studying terminal output with deep concentration, analytical expression, dark room with blue screen light, cinematic portrait, professional photography",
    "hopeful": "An engineer watching a service restart with hopeful expression, screen light on face, dark minimal background, cinematic portrait, photorealistic",
    "ambitious": "A young sysadmin looking at camera with confident ambitious expression, dark professional setting, dramatic lighting, portrait photography, YouTube thumbnail style",
    "resigned": "An engineer looking at a slow connection indicator with resigned expression, dark room, moody lighting, cinematic portrait, photorealistic",
}

# Thumbnail text per emotion
THUMBNAIL_TEXTS = {
    "frustrated": "CONNECTION\nLOST",
    "determined": "SAME SKILLS\nDIFFERENT OUTCOME",
    "stressed": "SYSTEM\nFAILED",
    "focused": "READ THE\nLOGS",
    "panicked": "PRODUCTION\nDOWN",
    "worried": "WHAT\nNOW?",
    "confident": "REAL\nSKILLS",
    "curious": "WHY DID IT\nFAIL?",
    "urgent": "3AM\nINCIDENT",
    "analytical": "FIND THE\nBUG",
    "hopeful": "IT'S\nFIXED",
    "ambitious": "LEARN\nFOR REAL",
    "resigned": "NO\nINTERNET",
    "tired but alert": "3:02 AM\nCALL",
}


def detect_emotion(hook):
    """Detect emotion from hook text."""
    hook_lower = hook.lower()
    for keyword, emotion in EMOTION_MAP.items():
        if keyword in hook_lower:
            return emotion
    return "focused"  # default


def get_thumbnail_text(emotion):
    """Get optimal thumbnail text for an emotion."""
    return THUMBNAIL_TEXTS.get(emotion, "WHAT\nNOW?")


def get_face_prompt(emotion):
    """Get AI image generation prompt for an emotion."""
    return EMOTION_PROMPTS.get(emotion, EMOTION_PROMPTS["focused"])


def generate_face_thumbnail(emotion, output_path, size=(1280, 720)):
    """
    Generate a thumbnail with face-like placeholder + text overlay.
    Since we can't call image APIs directly, we create a stylized
    composition with gradient + text that simulates the face+text layout.

    For production: replace with DALL-E / Stable Diffusion API call.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
    except ImportError:
        print("  ✗ PIL required: pip install pillow")
        return None

    W, H = size
    img = Image.new("RGB", (W, H), (8, 8, 10))
    draw = ImageDraw.Draw(img)

    # ─── Simulated face area (gradient circle) ────────────────
    # Dark gradient to simulate portrait lighting
    cx, cy = W // 2, H // 2 - 40
    face_radius = min(W, H) // 3

    for r in range(face_radius, 0, -2):
        alpha = int(255 * (1 - r / face_radius))
        brightness = int(15 + alpha * 0.1)
        color = (brightness, brightness, brightness + 5)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=color,
        )

    # ─── Screen glow effect (blue from bottom) ────────────────
    for y in range(H - 200, H, 2):
        alpha = int(40 * (1 - (y - (H - 200)) / 200))
        draw.line([(0, y), (W, y)], fill=(30, 50, 80 + alpha))

    # ─── Red error glow (top-left) ────────────────────────────
    if emotion in ["stressed", "panicked", "frustrated"]:
        for r in range(100, 0, -3):
            alpha = int(80 * (1 - r / 100))
            draw.ellipse(
                [100 - r, 100 - r, 100 + r, 100 + r],
                fill=(180 + alpha, 30, 30),
            )

    # ─── Thumbnail text ────────────────────────────────────────
    text = get_thumbnail_text(emotion)
    lines = text.split("\n")

    # Find best font
    font_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\impact.ttf",
    ]
    font = None
    font_size = 100
    for fp in font_paths:
        try:
            font = ImageFont.truetype(fp, font_size)
            break
        except:
            continue
    if font is None:
        font = ImageFont.load_default()

    # Position text at bottom
    line_height = font_size + 15
    total_h = line_height * len(lines)
    start_y = H - 160

    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        x = (W - lw) // 2
        y = start_y + i * line_height

        # Shadow for depth
        draw.text((x + 3, y + 3), line, fill=(0, 0, 0, 150), font=font)

        # Main text (white)
        draw.text((x, y), line, fill=(255, 255, 255), font=font)

        # Accent line under text
        if i == 0:
            draw.line(
                [(x, y + font_size + 5), (x + lw, y + font_size + 5)],
                fill=(239, 68, 68) if emotion in ["stressed", "panicked", "frustrated"] else (59, 130, 246),
                width=3,
            )

    # ─── Save ──────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    img.save(output_path, "PNG")

    print(f"  ✓ Thumbnail: {os.path.basename(output_path)} (emotion: {emotion})")
    return output_path


def generate_all_thumbnails_for_hook(hook, output_dir="vhs/output"):
    """Generate 3 A/B thumbnail variants for a hook."""
    emotion = detect_emotion(hook)
    variants = []

    # V1: Main emotion
    v1_path = os.path.join(output_dir, f"thumb_{emotion.replace(' ', '_')}_main.png")
    generate_face_thumbnail(emotion, v1_path)
    variants.append({"id": "v1", "emotion": emotion, "file": v1_path})

    # V2: Alternative emotion
    alt_emotions = {"frustrated": "determined", "stressed": "focused", "panicked": "worried"}
    alt = alt_emotions.get(emotion, "confident")
    v2_path = os.path.join(output_dir, f"thumb_{alt.replace(' ', '_')}_alt.png")
    generate_face_thumbnail(alt, v2_path)
    variants.append({"id": "v2", "emotion": alt, "file": v2_path})

    # V3: Bold style
    v3_path = os.path.join(output_dir, f"thumb_{emotion.replace(' ', '_')}_bold.png")
    generate_face_thumbnail(emotion, v3_path, size=(1080, 1920))  # vertical too
    variants.append({"id": "v3", "emotion": emotion, "style": "bold", "file": v3_path, "vertical": True})

    return variants


# ═══════════════════════════════════════════════════════════════
# 2. MULTI-PLATFORM SCHEDULER
# ═══════════════════════════════════════════════════════════════

BEST_TIMES = {
    "youtube": ["18:00", "12:00", "20:00"],
    "tiktok": ["20:00", "12:30", "18:30"],
    "instagram": ["20:30", "12:00", "19:00"],
    "linkedin": ["08:00", "12:00", "17:00"],
    "facebook": ["19:00", "13:00", "21:00"],
}

PLATFORM_CONFIG = {
    "youtube": {
        "type": "long",
        "max_duration": 900,
        "needs_title": True,
        "needs_thumbnail": True,
        "needs_description": True,
        "caption_template": "{title}\n\n{description}\n\n→ Try it free: https://winlab.cloud\n\n#SysAdmin #Linux #DevOps #WinLab",
    },
    "tiktok": {
        "type": "short",
        "max_duration": 60,
        "needs_title": False,
        "needs_thumbnail": False,
        "needs_description": False,
        "caption_template": "{hook}\n\n#sysadmin #linux #devops #tech #winlab #coding",
    },
    "instagram": {
        "type": "reel",
        "max_duration": 90,
        "needs_title": False,
        "needs_thumbnail": False,
        "needs_description": True,
        "caption_template": "{hook}\n\n🔗 Link in bio → winlab.cloud\n\n#sysadmin #linux #devops #techcareer #winlab",
    },
    "linkedin": {
        "type": "post",
        "max_duration": 600,
        "needs_title": True,
        "needs_thumbnail": False,
        "needs_description": True,
        "caption_template": "{hook}\n\n{insight}\n\nTry it free → winlab.cloud\n\n#TechEducation #Linux #DevOps #CloudComputing #WinLab",
    },
    "facebook": {
        "type": "reel",
        "max_duration": 90,
        "needs_title": False,
        "needs_thumbnail": False,
        "needs_description": False,
        "caption_template": "{hook}\n\n→ winlab.cloud",
    },
}


def create_launch_schedule(video_file, hook=None, title=None, platforms=None, start_date=None):
    """Create a multi-platform posting schedule for a video."""
    if platforms is None:
        platforms = ["youtube", "tiktok", "instagram", "linkedin"]
    if start_date is None:
        start_date = datetime.now() + timedelta(days=1)

    emotion = detect_emotion(hook) if hook else "focused"
    jobs = []

    for i, platform in enumerate(platforms):
        config = PLATFORM_CONFIG.get(platform, {})
        times = BEST_TIMES.get(platform, ["18:00"])
        time_str = times[i % len(times)]

        # Spread across different days if many platforms
        post_date = start_date + timedelta(hours=i * 2)
        scheduled_time = f"{post_date.strftime('%Y-%m-%d')} {time_str}"

        # Build caption from templates
        caption = config.get("caption_template", "{hook}").format(
            hook=hook or "Practice real sysadmin skills.",
            title=title or "WinLab.cloud",
            description="Practice real sysadmin scenarios in your browser.",
            insight="Your internet shouldn't decide your career.",
        )

        job = {
            "id": f"job_{hashlib.md5(f'{video_file}{platform}{scheduled_time}'.encode()).hexdigest()[:8]}",
            "platform": platform,
            "file": video_file,
            "hook": hook,
            "title": title,
            "caption": caption,
            "time": scheduled_time,
            "status": "scheduled",
            "emotion": emotion,
            "created_at": datetime.now().isoformat(),
        }

        # Attach thumbnail if needed
        if config.get("needs_thumbnail"):
            thumb_path = os.path.join(
                "vhs/output",
                f"thumb_{emotion.replace(' ', '_')}_main.png",
            )
            if os.path.exists(thumb_path):
                job["thumbnail"] = thumb_path

        jobs.append(job)

    return jobs


def schedule_repost(video_data, delay_hours=48):
    """Schedule a repost of a winning video."""
    new_time = datetime.now() + timedelta(hours=delay_hours)
    platform = video_data.get("platform", "tiktok")
    times = BEST_TIMES.get(platform, ["18:00"])

    return {
        "id": f"repost_{video_data['id']}_{int(time.time())}",
        "platform": platform,
        "file": video_data["file"],
        "hook": video_data.get("hook"),
        "caption": video_data.get("caption", ""),
        "time": f"{new_time.strftime('%Y-%m-%d')} {random.choice(times)}",
        "status": "scheduled",
        "is_repost": True,
        "original_id": video_data.get("id"),
        "created_at": datetime.now().isoformat(),
    }


def scale_to_platforms(video_data, platforms=None):
    """Scale a winning video to ALL platforms."""
    if platforms is None:
        platforms = ["youtube", "tiktok", "instagram", "linkedin", "facebook"]

    jobs = []
    for i, platform in enumerate(platforms):
        if platform == video_data.get("platform"):
            continue  # skip original

        job = schedule_repost(video_data, delay_hours=24 + i * 6)
        job["platform"] = platform
        job["is_scale"] = True
        jobs.append(job)

    return jobs


# ═══════════════════════════════════════════════════════════════
# 3. POST EXECUTION ENGINE (with stubs for real APIs)
# ═══════════════════════════════════════════════════════════════

def execute_job(job):
    """Execute a posting job."""
    platform = job["platform"]
    print(f"  📤 Posting to {platform}: {job.get('hook', job.get('title', 'Untitled'))}")

    try:
        if platform == "youtube":
            result = post_youtube(job)
        elif platform == "tiktok":
            result = post_tiktok(job)
        elif platform == "instagram":
            result = post_instagram(job)
        elif platform == "linkedin":
            result = post_linkedin(job)
        elif platform == "facebook":
            result = post_facebook(job)
        else:
            result = {"status": "error", "error": f"Unknown platform: {platform}"}

        job["status"] = "posted" if result.get("status") == "success" else "error"
        job["result"] = result
        job["posted_at"] = datetime.now().isoformat()

        return job

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["retries"] = job.get("retries", 0) + 1
        print(f"  ✗ Error: {e}")
        return job


def post_youtube(job):
    """Post to YouTube (stub — integrate with YouTube Data API v3)."""
    print(f"    → Upload: {job['file']}")
    print(f"    → Title: {job.get('title', 'WinLab')}")
    if job.get('thumbnail'):
        print(f"    → Thumbnail: {job['thumbnail']}")
    print(f"    → Description: {job.get('caption', '')[:80]}...")

    # TODO: Integrate with google-api-python-client
    # from googleapiclient.discovery import build
    # youtube = build('youtube', 'v3', credentials=...)
    # youtube.videos().insert(...)

    return {"status": "success", "platform": "youtube", "url": "https://youtube.com/watch?v=TODO"}


def post_tiktok(job):
    """Post to TikTok (stub — use Playwright or third-party service)."""
    print(f"    → Upload: {job['file']}")
    print(f"    → Caption: {job.get('caption', '')[:60]}...")

    # TODO: Use Playwright for browser automation
    # Or use services like Repurpose.io / Zapier

    return {"status": "success", "platform": "tiktok", "url": "https://tiktok.com/@winlab/TODO"}


def post_instagram(job):
    """Post to Instagram Reels (stub — use Meta Graph API)."""
    print(f"    → Upload: {job['file']}")
    print(f"    → Caption: {job.get('caption', '')[:60]}...")

    # TODO: Use Instagram Graph API
    # POST https://graph.instagram.com/{ig-user-id}/media

    return {"status": "success", "platform": "instagram", "url": "https://instagram.com/reel/TODO"}


def post_linkedin(job):
    """Post to LinkedIn (stub — use LinkedIn API v2)."""
    print(f"    → Upload: {job['file']}")
    print(f"    → Title: {job.get('title', 'WinLab')}")
    print(f"    → Caption: {job.get('caption', '')[:60]}...")

    # TODO: Use LinkedIn API
    # POST https://api.linkedin.com/v2/ugcPosts

    return {"status": "success", "platform": "linkedin", "url": "https://linkedin.com/feed/update/TODO"}


def post_facebook(job):
    """Post to Facebook Reels (stub — use Meta Graph API)."""
    print(f"    → Upload: {job['file']}")
    print(f"    → Caption: {job.get('caption', '')[:60]}...")

    # TODO: Use Facebook Graph API
    # POST https://graph.facebook.com/{page-id}/videos

    return {"status": "success", "platform": "facebook", "url": "https://facebook.com/TODO"}


# ═══════════════════════════════════════════════════════════════
# 4. GROWTH ENGINE (Repost + Scale)
# ═══════════════════════════════════════════════════════════════

def is_winner(video_data, min_ctr=0.05):
    """Check if a video is a winner (CTR > 5%)."""
    views = video_data.get("metrics", {}).get("views", 0)
    clicks = video_data.get("metrics", {}).get("clicks", 0)
    if views == 0:
        return False
    ctr = clicks / views
    return ctr > min_ctr


def mutate_caption(caption):
    """Slightly vary caption to avoid shadow duplicate detection."""
    import re
    variations = [
        lambda t: t.replace(".", "…", 1),
        lambda t: t.replace("!", ".", 1),
        lambda t: t + "\n",
        lambda t: "→ " + t if not t.startswith("→") else t,
    ]
    return random.choice(variations)(caption)


def run_growth_loop(jobs_path="data/scheduled_jobs.json", metrics_path="data/performance.json"):
    """Main growth loop: find winners → repost → scale."""
    # Load performance data
    if not os.path.exists(metrics_path):
        print("  No performance data found. Publish first, then run growth loop.")
        return []

    with open(metrics_path) as f:
        metrics = json.load(f)

    # Find winners
    winners = [v for v in metrics if is_winner(v)]
    print(f"  Found {len(winners)} winners out of {len(metrics)} videos")

    new_jobs = []

    for winner in winners:
        # 1. Repost on same platform
        repost_job = schedule_repost(winner, delay_hours=72)
        repost_job["caption"] = mutate_caption(winner.get("caption", ""))
        new_jobs.append(repost_job)
        print(f"  🔄 Repost scheduled: {winner.get('hook', 'Untitled')} → {repost_job['time']}")

        # 2. Scale to other platforms
        scale_jobs = scale_to_platforms(winner)
        for sj in scale_jobs:
            sj["caption"] = mutate_caption(winner.get("caption", ""))
        new_jobs.extend(scale_jobs)
        print(f"  🌍 Scaled to {len(scale_jobs)} new platforms: {winner.get('hook', 'Untitled')}")

    # Save new jobs
    if new_jobs:
        existing_jobs = []
        if os.path.exists(jobs_path):
            with open(jobs_path) as f:
                existing_jobs = json.load(f)

        all_jobs = existing_jobs + new_jobs
        os.makedirs(os.path.dirname(jobs_path), exist_ok=True)
        with open(jobs_path, "w") as f:
            json.dump(all_jobs, f, indent=2)

        print(f"\n  ✓ Scheduled {len(new_jobs)} new jobs → {jobs_path}")

    return new_jobs


# ═══════════════════════════════════════════════════════════════
# 5. SCHEDULER RUNNER
# ═══════════════════════════════════════════════════════════════

def run_scheduler(jobs_path="data/scheduled_jobs.json", check_interval=30):
    """Run the scheduler loop, posting when time matches."""
    print("═" * 50)
    print("  WINLAB AUTO-POST SCHEDULER")
    print("  Press Ctrl+C to stop")
    print("═" * 50)

    while True:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")

        if os.path.exists(jobs_path):
            with open(jobs_path) as f:
                jobs = json.load(f)

            posted = 0
            for job in jobs:
                if job["status"] == "scheduled" and job["time"][:16] == now[:16]:
                    print(f"\n  ⏰ Time to post: {job['platform']} — {job.get('hook', job.get('title', ''))}")
                    result = execute_job(job)

                    # Update job status
                    job["status"] = result["status"]
                    if result.get("result"):
                        job["result_url"] = result["result"].get("url")

                    posted += 1

                    # Save updated jobs
                    with open(jobs_path, "w") as f:
                        json.dump(jobs, f, indent=2)

            if posted > 0:
                print(f"\n  ✓ Posted {posted} job(s)")

        time.sleep(check_interval)


# ═══════════════════════════════════════════════════════════════
# 6. EXPORT / IMPORT
# ═══════════════════════════════════════════════════════════════

def export_schedule(jobs, output_path="data/schedule.json"):
    """Export schedule to JSON."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(jobs, f, indent=2, default=str)
    print(f"  ✓ Schedule exported: {output_path}")


def load_schedule(path="data/schedule.json"):
    """Load schedule from JSON."""
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Auto-Post & Growth Engine")
    parser.add_argument("--thumbnails", action="store_true", help="Generate emotion-based thumbnails")
    parser.add_argument("--hook", default="Connection lost", help="Hook text for thumbnail generation")
    parser.add_argument("--launch", help="Schedule a full platform launch (video file path)")
    parser.add_argument("--growth", action="store_true", help="Run growth loop (repost + scale winners)")
    parser.add_argument("--schedule", action="store_true", help="Run scheduler daemon")
    parser.add_argument("--platforms", nargs="+", default=["youtube", "tiktok", "instagram", "linkedin"])
    parser.add_argument("--title", help="Video title (for YouTube)")
    parser.add_argument("--output", "-o", default="vhs/output", help="Output directory")
    parser.add_argument("--data", "-d", default="data", help="Data directory")

    args = parser.parse_args()

    os.makedirs(args.data, exist_ok=True)

    if args.thumbnails:
        print(f"Generating thumbnails for hook: '{args.hook}'")
        variants = generate_all_thumbnails_for_hook(args.hook, args.output)
        print(f"\n  Generated {len(variants)} variants")

    elif args.launch:
        print(f"═" * 50)
        print(f"  SCHEDULING LAUNCH: {args.launch}")
        print(f"═" * 50)

        jobs = create_launch_schedule(
            video_file=args.launch,
            hook=args.hook,
            title=args.title,
            platforms=args.platforms,
        )

        jobs_path = os.path.join(args.data, "scheduled_jobs.json")
        existing = load_schedule(jobs_path)
        all_jobs = existing + jobs
        export_schedule(all_jobs, jobs_path)

        print(f"\n  📅 Scheduled {len(jobs)} posts:")
        for j in jobs:
            print(f"    {j['time']} → {j['platform']}: {j.get('hook', j.get('title', ''))}")

    elif args.growth:
        print("═" * 50)
        print("  GROWTH ENGINE — Finding Winners")
        print("═" * 50)
        print()
        jobs_path = os.path.join(args.data, "scheduled_jobs.json")
        metrics_path = os.path.join(args.data, "performance.json")
        run_growth_loop(jobs_path, metrics_path)

    elif args.schedule:
        jobs_path = os.path.join(args.data, "scheduled_jobs.json")
        run_scheduler(jobs_path)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
