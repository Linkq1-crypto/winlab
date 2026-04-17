"""
WinLab Pre-Launch Video Renderer
==================================
Renders 12 pre-launch videos for the 72h countdown (Friday to Monday).
All videos in English, 1080x1920 vertical format.

Usage:
  python scripts/render_prelaunch.py --all
  python scripts/render_prelaunch.py --index 0  # render first video only
"""

import os
import sys
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vertical_engine import render_black, render_text_frame, render_terminal_frame
from moviepy import VideoClip, concatenate_videoclips, clips_array
import numpy as np

# Import prelaunch config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prelaunch_videos_config import PRELAUNCH_VIDEOS

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output", "prelaunch")

def create_scene_clip(scene):
    """Create a single scene clip from scene definition."""
    scene_type = scene["type"]
    duration = scene["duration"]

    def make_frame(t):
        progress = t / duration

        if scene_type == "black":
            return render_black()

        elif scene_type == "text":
            text = scene["text"]
            img = render_text_frame(text, progress)
            # Apply accent color if specified
            if scene.get("color") == "accent":
                # Blend with accent color
                img = np.clip(img.astype(np.float32) * 0.7 + np.array([59, 130, 246], dtype=np.float32) * 0.3, 0, 255).astype(np.uint8)
            return img

        elif scene_type == "terminal":
            cmd = scene["cmd"]
            status = scene["status"]
            # Replace $(current_date) placeholder
            if "$(current_date)" in status:
                status = status.replace("$(current_date)", datetime.now().strftime("%a %b %d %H:%M:%S UTC %Y"))
            return render_terminal_frame(cmd, status, progress)

        return render_black()

    clip = VideoClip(make_frame, duration=duration)
    return clip

def render_video(video_config, output_path):
    """Render a complete video from config."""
    print(f"\n{'='*60}")
    print(f"  Rendering: {video_config['name']}")
    print(f"  Hook: {video_config['hook']}")
    print(f"  Scenes: {len(video_config['scenes'])}")
    print(f"{'='*60}")

    scenes = video_config["scenes"]
    clips = []

    for i, scene in enumerate(scenes):
        print(f"  Scene {i+1}/{len(scenes)}: {scene['type']} - {scene.get('text', scene.get('cmd', ''))[:40]}")
        clip = create_scene_clip(scene)
        clips.append(clip)

    # Concatenate all scenes
    if len(clips) == 1:
        final_clip = clips[0]
    else:
        final_clip = concatenate_videoclips(clips, method="compose")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Export video
    print(f"  Exporting to: {output_path}")
    final_clip.write_videofile(
        output_path,
        fps=30,
        codec="libx264",
        preset="fast",
        audio=False,
        logger="bar"
    )
    print(f"  ✓ Done: {video_config['name']}")

def main():
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python render_prelaunch.py --all")
        print("  python render_prelaunch.py --index 0 1 2")
        sys.exit(1)

    if sys.argv[1] == "--all":
        indices = range(len(PRELAUNCH_VIDEOS))
    elif sys.argv[1] == "--index":
        indices = [int(i) for i in sys.argv[2:]]
    else:
        print("Unknown argument. Use --all or --index")
        sys.exit(1)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Render videos
    for idx in indices:
        if idx >= len(PRELAUNCH_VIDEOS):
            print(f"Warning: Index {idx} out of range (max: {len(PRELAUNCH_VIDEOS)-1})")
            continue

        video_config = PRELAUNCH_VIDEOS[idx]
        output_path = os.path.join(OUTPUT_DIR, f"{video_config['name']}.mp4")

        render_video(video_config, output_path)

    print(f"\n{'='*60}")
    print(f"  All pre-launch videos rendered!")
    print(f"  Output directory: {OUTPUT_DIR}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
