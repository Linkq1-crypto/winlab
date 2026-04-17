"""
WinLab Hero YouTube Video Generator
=====================================
Generates the 60-90s hero video + thumbnails + titles + A/B variants.

The hero video is the anchor for ALL content (shorts, social, landing).

Usage:
  # Generate hero video (1080p)
  python vhs/scripts/hero_youtube.py --render --output vhs/output

  # Generate thumbnails + titles only
  python vhs/scripts/hero_youtube.py --thumbnails --output vhs/output

  # Generate A/B variants (3 thumbnails + 5 titles)
  python vhs/scripts/hero_youtube.py --ab-test --output vhs/output

  # Full pipeline: video + thumbnails + titles
  python vhs/scripts/hero_youtube.py --full --output vhs/output
"""

import os
import sys
import json
import random
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 1. HERO VIDEO DEFINITION (Apple style, 60-90s)
# ═══════════════════════════════════════════════════════════════

HERO_VIDEO = {
    "name": "hero_youtube",
    "title": "Your Internet Shouldn't Decide Your Career",
    "duration": 75,  # ~75 seconds
    "scenes": [
        # 0-3s: Hook
        {"type": "text",    "text": "Connection lost.",           "duration": 2.0, "size": 52, "color": "error"},
        {"type": "black",   "duration": 0.5},
        {"type": "text",    "text": "Again.",                      "duration": 2.0, "size": 48, "color": "sub"},

        # 7-15s: Story setup
        {"type": "text",    "text": "A few years ago, I helped a junior engineer", "duration": 3.0, "size": 34},
        {"type": "text",    "text": "debug an LDAP issue.",        "duration": 2.5, "size": 34},

        # 15-22s: Character
        {"type": "text",    "text": "Smart. Motivated. Capable.",  "duration": 3.0, "size": 38, "color": "text"},

        # 22-30s: The problem
        {"type": "text",    "text": 'But every time I sent him a lab:', "duration": 2.5, "size": 34},
        {"type": "text",    "text": '"Connection dropped."',       "duration": 3.0, "size": 40, "color": "error"},

        # 30-36s: Empathy
        {"type": "text",    "text": "Not his fault.",              "duration": 2.0, "size": 40},
        {"type": "text",    "text": "His internet wasn't stable.", "duration": 2.5, "size": 34, "color": "sub"},

        # 36-44s: Contrast
        {"type": "text",    "text": "Meanwhile, someone else,",    "duration": 2.5, "size": 34},
        {"type": "text",    "text": "same skills, same ambition,", "duration": 2.5, "size": 34},
        {"type": "text",    "text": "could practice all night.",   "duration": 2.5, "size": 34},

        # 44-50s: The insight
        {"type": "text",    "text": "Same effort.",                "duration": 2.0, "size": 42, "weight": "bold"},
        {"type": "text",    "text": "Different outcome.",          "duration": 2.5, "size": 46, "weight": "bold", "color": "accent"},

        # 50-56s: The realization
        {"type": "text",    "text": "Because of infrastructure.",  "duration": 3.0, "size": 40, "color": "sub"},
        {"type": "black",   "duration": 0.5},
        {"type": "text",    "text": "That didn't sit right with me.", "duration": 3.0, "size": 36},

        # 56-64s: The solution
        {"type": "text",    "text": "So I built something different.", "duration": 3.0, "size": 38, "color": "accent"},

        # 64-72s: Features
        {"type": "text",    "text": "A sysadmin simulator that works:", "duration": 2.5, "size": 34},
        {"type": "text",    "text": "On GSM.",                     "duration": 1.5, "size": 40, "color": "success"},
        {"type": "text",    "text": "Offline.",                    "duration": 1.5, "size": 40, "color": "success"},
        {"type": "text",    "text": "On any device.",              "duration": 1.5, "size": 40, "color": "success"},

        # 72-78s: No friction
        {"type": "text",    "text": "No setup.",                   "duration": 1.5, "size": 38},
        {"type": "text",    "text": "No perfect internet required.", "duration": 2.5, "size": 34, "color": "sub"},

        # 78-86s: Terminal reveal
        {"type": "terminal", "cmd": "systemctl status apache2",    "duration": 3.0},
        {"type": "terminal", "status": "● failed",                 "duration": 2.0, "color": "error"},
        {"type": "text",    "text": "You debug.",                  "duration": 1.5, "size": 38},
        {"type": "text",    "text": "You fix.",                    "duration": 1.5, "size": 38},

        # 86-92s: Philosophy
        {"type": "text",    "text": "And you learn the way",       "duration": 2.0, "size": 34},
        {"type": "text",    "text": "real sysadmins do.",          "duration": 2.0, "size": 38, "color": "success"},

        # 92-98s: Not watching
        {"type": "text",    "text": "Not by watching.",            "duration": 2.0, "size": 42},
        {"type": "text",    "text": "By doing.",                   "duration": 2.0, "size": 46, "weight": "bold", "color": "accent"},

        # 98-105s: CTA
        {"type": "text",    "text": "Same lab.",                   "duration": 2.0, "size": 44, "weight": "bold"},
        {"type": "text",    "text": "Same chance.",                "duration": 2.5, "size": 44, "weight": "bold"},
        {"type": "black",   "duration": 0.5},
        {"type": "text",    "text": "WinLab.cloud",                "duration": 3.0, "size": 56, "color": "accent"},
    ],
}


# ═══════════════════════════════════════════════════════════════
# 2. TITLE GENERATOR (patterns + AI)
# ═══════════════════════════════════════════════════════════════

TITLE_PATTERNS = [
    "Your {pain} Shouldn't Decide Your Career",
    "I Built a Sysadmin Lab That Works {condition}",
    "Why Most Engineers Can't {action} (And How I Fixed It)",
    "The Real Reason You Can't {action}",
    "Learn {skill} Without {pain}",
    "This Changes How Engineers Practice",
    "I Made a Lab That Works on {condition}",
    "{pain} Is Blocking Engineers. I Fixed It.",
]

TITLE_VARS = {
    "pain": ["Internet", "Connection", "Setup", "Infrastructure"],
    "condition": ["Offline", "On GSM", "Without Perfect Internet", "On Any Device"],
    "action": ["Practice", "Learn Sysadmin", "Get Real Experience"],
    "skill": ["Linux", "Sysadmin Skills", "Real Engineering"],
}


def generate_titles(n=10, hook=None):
    """Generate n title variants."""
    titles = []

    # Pattern-based titles
    for _ in range(n // 2):
        pattern = random.choice(TITLE_PATTERNS)
        title = pattern.format(**{
            k: random.choice(v) for k, v in TITLE_VARS.items()
        })
        titles.append(title)

    # Curated high-performers
    curated = [
        "Your Internet Shouldn't Decide Your Career",
        "I Built a Sysadmin Lab That Works Offline",
        "Why Most Engineers Can't Practice (And How I Fixed It)",
        "This Is How Real Sysadmins Learn",
        "The Infrastructure Inequality Nobody Talks About",
        "Practice Sysadmin Without Internet",
        "Why Tutorials Don't Work (And What Does)",
    ]

    for t in curated:
        if t not in titles:
            titles.append(t)
        if len(titles) >= n:
            break

    # If hook provided, generate hook-specific titles
    if hook:
        hook_titles = [
            f'{hook} — And What I Did About It',
            f'What "{hook}" Taught Me About Engineering',
            f'I Solved the "{hook}" Problem for Engineers',
        ]
        titles.extend(hook_titles)

    return titles[:n]


# ═══════════════════════════════════════════════════════════════
# 3. THUMBNAIL GENERATOR
# ═══════════════════════════════════════════════════════════════

THUMBNAIL_TEXTS = [
    "CONNECTION\nLOST",
    "SAME SKILLS\nDIFFERENT OUTCOME",
    "NO INTERNET\nNO PROBLEM",
    "SYSTEM\nFAILED",
    "PRODUCTION\nDOWN",
    "FIX THIS",
    "WHAT NOW?",
    "3AM\nINCIDENT",
]

THUMBNAIL_STYLES = {
    "minimal": {
        "bg": (10, 10, 10),
        "text": (255, 255, 255),
        "accent": (239, 68, 68),  # red error
        "font_size": 120,
    },
    "bold": {
        "bg": (10, 10, 10),
        "text": (255, 255, 255),
        "accent": (59, 130, 246),  # blue accent
        "font_size": 130,
    },
    "glitch": {
        "bg": (10, 10, 10),
        "text": (239, 68, 68),  # red text
        "accent": (255, 255, 255),
        "font_size": 120,
    },
}

def generate_thumbnail(text, style="minimal", filename="thumbnail.png", output_dir="vhs/output"):
    """Generate a YouTube thumbnail (1280x720)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("  ✗ PIL required: pip install pillow")
        return None

    W, H = 1280, 720
    s = THUMBNAIL_STYLES.get(style, THUMBNAIL_STYLES["minimal"])

    img = Image.new("RGB", (W, H), s["bg"])
    draw = ImageDraw.Draw(img)

    # Try to find a bold font
    font_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\impact.ttf",
    ]
    font = None
    for fp in font_paths:
        try:
            font = ImageFont.truetype(fp, s["font_size"])
            break
        except:
            continue
    if font is None:
        font = ImageFont.load_default()

    # Text positioning
    lines = text.split("\n")
    line_height = s["font_size"] + 10
    total_h = line_height * len(lines)

    # Calculate width for centering
    max_w = max(font.getbbox(line)[2] for line in lines)

    start_y = (H - total_h) // 2 + s["font_size"] // 2
    start_x = (W - max_w) // 2

    # Draw text with shadow for depth
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        x = (W - lw) // 2
        y = start_y + i * line_height - s["font_size"] // 2

        # Shadow
        draw.text((x + 3, y + 3), line, fill=(0, 0, 0, 128), font=font)
        # Main text
        color = s["accent"] if i == 0 and style == "glitch" else s["text"]
        draw.text((x, y), line, fill=color, font=font)

    # For glitch style: add RGB split effect on first line
    if style == "glitch" and len(lines) > 0:
        line = lines[0]
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        x = (W - lw) // 2
        y = start_y - s["font_size"] // 2

        # Red channel offset
        draw.text((x + 4, y), line, fill=(255, 0, 0, 80), font=font)
        # Blue channel offset
        draw.text((x - 4, y), line, fill=(0, 0, 255, 80), font=font)

    # Save
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)
    img.save(path, "PNG")
    print(f"  ✓ Thumbnail: {filename} ({style})")
    return path


def generate_all_thumbnails(output_dir="vhs/output"):
    """Generate 3 A/B thumbnail variants for the hero video."""
    variants = []

    # Variant 1: CONNECTION LOST (minimal)
    v1 = generate_thumbnail("CONNECTION\nLOST", "minimal", "thumb_v1_connection_lost.png", output_dir)
    variants.append({"id": "v1", "text": "CONNECTION LOST", "style": "minimal", "file": v1})

    # Variant 2: SAME SKILLS DIFFERENT OUTCOME (bold)
    v2 = generate_thumbnail("SAME SKILLS\nDIFFERENT OUTCOME", "bold", "thumb_v2_same_skills.png", output_dir)
    variants.append({"id": "v2", "text": "SAME SKILLS / DIFFERENT OUTCOME", "style": "bold", "file": v2})

    # Variant 3: NO INTERNET NO PROBLEM (glitch)
    v3 = generate_thumbnail("NO INTERNET\nNO PROBLEM", "glitch", "thumb_v3_no_internet.png", output_dir)
    variants.append({"id": "v3", "text": "NO INTERNET / NO PROBLEM", "style": "glitch", "file": v3})

    return variants


def smart_thumbnail_from_hook(hook):
    """Match thumbnail text to video hook."""
    h = hook.lower()
    if "connection" in h or "internet" in h:
        return "CONNECTION\nLOST"
    if "fail" in h or "broken" in h or "down" in h:
        return "SYSTEM\nFAILED"
    if "skill" in h or "learn" in h:
        return "SAME SKILLS\nDIFFERENT OUTCOME"
    if "practice" in h:
        return "NO INTERNET\nNO PROBLEM"
    return random.choice(THUMBNAIL_TEXTS)


# ═══════════════════════════════════════════════════════════════
# 4. A/B TEST VARIANTS
# ═══════════════════════════════════════════════════════════════

def generate_ab_variants(n=3):
    """Generate n combinations of title + thumbnail for A/B testing."""
    titles = generate_titles(n * 2)
    thumbs = [
        {"text": "CONNECTION\nLOST", "style": "minimal"},
        {"text": "SAME SKILLS\nDIFFERENT OUTCOME", "style": "bold"},
        {"text": "NO INTERNET\nNO PROBLEM", "style": "glitch"},
    ]

    variants = []
    for i in range(min(n, len(thumbs))):
        variants.append({
            "id": f"ab_{i+1}",
            "title": titles[i] if i < len(titles) else titles[0],
            "thumbnail": thumbs[i],
            "description": f"Variant {i+1}: {thumbs[i]['text'].replace(chr(10), ' / ')}",
        })

    return variants


# ═══════════════════════════════════════════════════════════════
# 5. EXPORT METADATA
# ═══════════════════════════════════════════════════════════════

def export_hero_metadata(thumbnails, titles, output_dir="vhs/output"):
    """Export all metadata for the hero video."""
    metadata = {
        "video": HERO_VIDEO,
        "titles": titles,
        "thumbnails": thumbnails,
        "ab_variants": generate_ab_variants(),
        "description": """
Your Internet Shouldn't Decide Your Career.

A few years ago, I helped a junior engineer debug an LDAP issue.
Smart. Motivated. Capable. But every time I sent him a lab: "Connection dropped."

Not his fault. His internet wasn't stable.

Meanwhile, someone else, same skills, same ambition, could practice all night.
Same effort. Different outcome. Because of infrastructure.

That didn't sit right with me. So I built WinLab.

A sysadmin simulator that works on GSM, offline, on any device.
No setup. No perfect internet required. Just real scenarios.

→ Try it free: https://winlab.cloud

#SysAdmin #Linux #DevOps #TechEducation #CloudComputing #Infrastructure
        """.strip(),
        "tags": [
            "sysadmin", "linux", "devops", "cloud computing",
            "tech education", "infrastructure", "networking",
            "system administration", "terraform", "docker",
            "winlab", "hands-on learning",
        ],
        "shorts_strategy": [
            {"hook": "Connection lost.", "cta": "Full story → link in description"},
            {"hook": "Same skills. Different outcome.", "cta": "Full story → link in description"},
            {"hook": "Works offline.", "cta": "Full story → link in description"},
            {"hook": "3AM Incident", "cta": "Full story → link in description"},
        ],
        "created_at": datetime.now().isoformat(),
    }

    path = os.path.join(output_dir, "hero_youtube_metadata.json")
    with open(path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  ✓ Metadata: hero_youtube_metadata.json")
    return path


# ═══════════════════════════════════════════════════════════════
# 6. HERO VIDEO RENDERER (using vertical engine as base, horizontal)
# ═══════════════════════════════════════════════════════════════

def render_hero_video(output_dir="vhs/output"):
    """
    Generate the hero video as a Python config for the render engine.
    The actual rendering uses the same engine as vertical_engine.py but 1280x720.
    """
    config = {
        "name": HERO_VIDEO["name"],
        "width": 1920,  # Render at 1080p, downscale for YouTube
        "height": 1080,
        "fps": 30,
        "duration": HERO_VIDEO["duration"],
        "scenes": HERO_VIDEO["scenes"],
        "style": "apple_hero",
    }

    path = os.path.join(output_dir, "hero_youtube_config.json")
    os.makedirs(output_dir, exist_ok=True)
    with open(path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"  ✓ Hero video config: {path}")
    print(f"  Duration: {HERO_VIDEO['duration']}s ({HERO_VIDEO['duration'] // 60}m {HERO_VIDEO['duration'] % 60}s)")
    print(f"  Scenes: {len(HERO_VIDEO['scenes'])}")
    return path


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(description="WinLab Hero YouTube Generator")
    parser.add_argument("--render", action="store_true", help="Generate hero video config")
    parser.add_argument("--thumbnails", action="store_true", help="Generate thumbnails only")
    parser.add_argument("--titles", action="store_true", help="Generate title variants only")
    parser.add_argument("--ab-test", action="store_true", help="Generate A/B test variants")
    parser.add_argument("--full", action="store_true", help="Full pipeline: video + thumbnails + titles")
    parser.add_argument("--output", "-o", default="vhs/output", help="Output directory")
    parser.add_argument("--hook", help="Custom hook for title/thumbnail generation")

    args = parser.parse_args()

    if args.full or (not args.render and not args.thumbnails and not args.titles and not args.ab_test):
        args.full = True

    if args.render or args.full:
        print("═" * 50)
        print("  WINLAB HERO YOUTUBE VIDEO")
        print("═" * 50)
        print()
        render_hero_video(args.output)
        print()

    if args.thumbnails or args.full:
        print("Generating thumbnails...")
        thumbs = generate_all_thumbnails(args.output)
        print()

    if args.titles or args.full:
        print("Generating title variants...")
        titles = generate_titles(10, hook=args.hook)
        for i, t in enumerate(titles, 1):
            print(f"  {i}. {t}")
        print()

    if args.ab_test or args.full:
        print("Generating A/B variants...")
        variants = generate_ab_variants()
        for v in variants:
            print(f"  {v['id']}: {v['title']}")
            print(f"    Thumbnail: {v['thumbnail']['text'].replace(chr(10), ' / ')}")
        print()

    # Export metadata
    if args.full:
        ab = generate_ab_variants()
        thumbs_data = [{"text": v["thumbnail"]["text"], "style": v["thumbnail"]["style"]} for v in ab]
        titles = generate_titles(10, hook=args.hook)
        export_hero_metadata(thumbs_data, titles, args.output)
        print()
        print("═" * 50)
        print("  RECOMMENDED COMBO:")
        print("═" * 50)
        print(f"  Title: Your Internet Shouldn't Decide Your Career")
        print(f"  Thumbnail: CONNECTION LOST (minimal)")
        print(f"  CTA: Full story → winlab.cloud")
        print()


if __name__ == "__main__":
    main()
