"""
WinLab X (Twitter) Video Renderer — Square 1280×1280
=====================================================
Renders 20 X-optimized videos from configs.
- Square format (1280×1280)
- 9-15 seconds each
- Strong visual hierarchy
- Apple-style minimalism

Usage:
  python scripts/x_video_renderer.py --config output/x_videos_config.json --output output
  python scripts/x_video_renderer.py --batch --output output
"""

import os
import sys
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoClip, concatenate_videoclips
import time

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════

W, H = 1280, 1280  # Square format for X

COLORS = {
    "bg":        (10, 10, 10),
    "terminal":  (18, 18, 18),
    "header":    (30, 30, 30),
    "text":      (240, 240, 240),
    "sub":       (107, 114, 128),
    "accent":    (59, 130, 246),
    "success":   (34, 197, 94),
    "error":     (239, 68, 68),
    "cmd":       (96, 165, 250),
}

FONT_PATHS = {
    "sans": "C:\\Windows\\Fonts\\segoeui.ttf",
    "sans_bold": "C:\\Windows\\Fonts\\segoeuib.ttf",
    "mono": "C:\\Windows\\Fonts\\consola.ttf",
}

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

def sans(size):  return get_font(FONT_PATHS["sans"], size)
def sans_b(size): return get_font(FONT_PATHS["sans_bold"], size)
def mono(size):  return get_font(FONT_PATHS["mono"], size)

def fit_text(text, max_width, font_fn=sans, start_size=80, min_size=36):
    size = start_size
    while size >= min_size:
        font = font_fn(size)
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
        if tw <= max_width:
            return font
        size -= 2
    return font_fn(min_size)

# ═══════════════════════════════════════════════════════════════
# SCENE RENDERERS
# ═══════════════════════════════════════════════════════════════

def create_hook_scene(text, duration=2.5):
    """Create hook scene with large centered text."""
    def make_frame(t):
        img = Image.new('RGB', (W, H), COLORS["bg"])
        draw = ImageDraw.Draw(img)
        
        # Main hook text - centered
        font = fit_text(text, W - 200, sans_b, start_size=100, min_size=48)
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (W - tw) // 2
        y = (H - th) // 2 - 100
        
        # Draw shadow
        for dy in [-2, 0, 2]:
            for dx in [-2, 0, 2]:
                draw.text((x + dx, y + dy), text, font=font, fill=(60, 60, 60))
        draw.text((x, y), text, font=font, fill=COLORS["text"])
        
        return np.array(img)
    
    return VideoClip(make_frame, duration=duration)

def create_terminal_scene(cmd, status, duration=5.0):
    """Create terminal scene with command and output."""
    def make_frame(t):
        img = Image.new('RGB', (W, H), COLORS["terminal"])
        draw = ImageDraw.Draw(img)
        
        # Terminal header
        header_h = 80
        draw.rectangle([0, 0, W, header_h], fill=COLORS["header"])
        
        # Terminal dots (macOS style)
        for i, color in enumerate([(255, 95, 87), (255, 189, 46), (39, 201, 63)]):
            draw.ellipse([30 + i*35, 25, 50 + i*35, 45], fill=color)
        
        # Terminal title
        draw.text((150, 25), "bash — 120×40", font=sans(28), fill=COLORS["sub"])
        
        # Command prompt
        y_start = header_h + 100
        prompt_font = mono(48)
        cmd_font = mono(48)
        status_font = mono(42)
        
        # $ symbol
        draw.text((100, y_start), "$ ", font=prompt_font, fill=COLORS["success"])
        
        # Typing animation for command
        chars_typed = int((t / 1.5) * len(cmd))
        typed_cmd = cmd[:chars_typed]
        draw.text((160, y_start), typed_cmd, font=cmd_font, fill=COLORS["cmd"])
        
        # Cursor blink
        if int(t * 3) % 2 == 0 and chars_typed < len(cmd):
            cursor_x = 160 + cmd_font.getbbox(typed_cmd)[2]
            draw.rectangle([cursor_x, y_start, cursor_x + 3, y_start + 50], fill=COLORS["cmd"])
        
        # Show status after typing
        if t > 2.0:
            status_y = y_start + 120
            
            # Status indicator
            if "✓" in status:
                draw.text((100, status_y), status, font=status_font, fill=COLORS["success"])
            elif "✗" in status:
                draw.text((100, status_y), status, font=status_font, fill=COLORS["error"])
            else:
                draw.text((100, status_y), status, font=status_font, fill=COLORS["sub"])
        
        # Progress bar at bottom
        progress = min(1.0, t / duration)
        bar_h = 8
        bar_y = H - 50
        draw.rectangle([0, bar_y, W, bar_y + bar_h], fill=(30, 30, 30))
        draw.rectangle([0, bar_y, int(W * progress), bar_y + bar_h], fill=COLORS["accent"])
        
        return np.array(img)
    
    return VideoClip(make_frame, duration=duration)

def create_cta_scene(text, duration=2.0):
    """Create CTA scene with WinLab.cloud branding."""
    def make_frame(t):
        img = Image.new('RGB', (W, H), COLORS["bg"])
        draw = ImageDraw.Draw(img)
        
        # WinLab.cloud logo
        logo_font = sans_b(72)
        logo_text = "WinLab.cloud"
        bbox = logo_font.getbbox(logo_text)
        tw = bbox[2] - bbox[0]
        logo_x = (W - tw) // 2
        logo_y = H // 2 - 150
        
        draw.text((logo_x, logo_y), logo_text, font=logo_font, fill=COLORS["accent"])
        
        # CTA text
        cta_font = fit_text(text, W - 200, sans, start_size=64, min_size=36)
        cta_bbox = cta_font.getbbox(text)
        cta_tw = cta_bbox[2] - cta_bbox[0]
        cta_x = (W - cta_tw) // 2
        cta_y = H // 2 + 50
        
        # Fade in
        alpha = min(1.0, t / 0.5)
        draw.text((cta_x, cta_y), text, font=cta_font, fill=COLORS["text"])
        
        # Arrow animation
        if t > 1.0:
            arrow_y = cta_y + 80
            arrow_text = "→"
            arrow_font = sans_b(48)
            draw.text((logo_x + tw + 20, arrow_y), arrow_text, font=arrow_font, fill=COLORS["accent"])
        
        return np.array(img)
    
    return VideoClip(make_frame, duration=duration)

# ═══════════════════════════════════════════════════════════════
# VIDEO BUILDER
# ═══════════════════════════════════════════════════════════════

def render_video(config, output_path):
    """Render a complete X video from config."""
    print(f"  Building: {config['name']} ({len(config['scenes'])} scenes)")
    
    clips = []
    for scene in config['scenes']:
        if scene['type'] == 'hook':
            clip = create_hook_scene(scene['text'], scene['duration'])
        elif scene['type'] == 'terminal':
            clip = create_terminal_scene(scene['cmd'], scene['status'], scene['duration'])
        elif scene['type'] == 'cta':
            clip = create_cta_scene(scene['text'], scene['duration'])
        elif scene['type'] == 'black':
            clip = VideoClip(lambda t: np.full((H, W, 3), 10, dtype=np.uint8), duration=scene['duration'])
        else:
            clip = create_hook_scene(scene.get('text', ''), scene.get('duration', 2.0))
        
        clips.append(clip)
    
    # Concatenate all clips
    final = concatenate_videoclips(clips)
    
    # Export with optimized settings
    final.write_videofile(
        output_path,
        fps=30,
        codec='libx264',
        audio=False,
        preset='fast',
        logger=None
    )
    
    print(f"  ✓ {output_path}")
    return output_path

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Render X-optimized videos")
    parser.add_argument("--config", type=str, help="Path to x_videos_config.json")
    parser.add_argument("--batch", action="store_true", help="Render all videos from config")
    parser.add_argument("--output", type=str, default="output", help="Output directory")
    args = parser.parse_args()
    
    os.makedirs(args.output, exist_ok=True)
    
    print("\n" + "="*50)
    print("  WINLAB X VIDEO RENDERER")
    print("  Rendering videos for X (Twitter)")
    print("="*50 + "\n")
    
    # Load config
    config_path = args.config or os.path.join(args.output, "x_videos_config.json")
    if not os.path.exists(config_path):
        print(f"  ✗ Config not found: {config_path}")
        print("  Run x_video_generator.py first\n")
        return
    
    with open(config_path, "r") as f:
        data = json.load(f)
    
    videos = data.get("videos", [])
    print(f"  Loaded {len(videos)} video configs\n")
    
    # Render all videos
    start_time = time.time()
    rendered = 0
    
    for i, video_config in enumerate(videos):
        output_file = os.path.join(args.output, f"x_{video_config['name']}.mp4")
        try:
            render_video(video_config, output_file)
            rendered += 1
        except Exception as e:
            print(f"  ✗ Failed to render {video_config['name']}: {e}\n")
    
    elapsed = time.time() - start_time
    print(f"\n  ✓ Rendered {rendered}/{len(videos)} videos")
    print(f"  ✓ Total time: {elapsed:.1f}s")
    print(f"  ✓ Output: {args.output}\n")

if __name__ == "__main__":
    main()
