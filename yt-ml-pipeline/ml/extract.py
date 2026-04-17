import os
import json
import subprocess
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(__file__))

from clip_model import get_clip_features
from ocr import get_text_features
from speech import get_speech_text

DATA = os.path.join(os.path.dirname(__file__), "../dataset")
OUT = os.path.join(os.path.dirname(__file__), "../train.json")

def extract_frames(video, out):
    """Extract frames from video at 1fps using FFmpeg"""
    os.makedirs(out, exist_ok=True)
    try:
        subprocess.run([
            "ffmpeg", "-i", video, 
            "-vf", "fps=1", 
            f"{out}/frame_%03d.jpg"
        ], check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg error: {e.stderr.decode()}")
        return False
    except FileNotFoundError:
        print("❌ FFmpeg not found. Please install it: sudo apt install ffmpeg")
        return False

def proxy_score(text_len, speech_len):
    """Calculate proxy quality score based on text and speech content"""
    return min(1.0, 0.3 + 0.3*(text_len/100) + 0.4*(speech_len/100))

def main():
    """Main dataset extraction pipeline"""
    dataset = []
    
    if not os.path.exists(DATA):
        print(f"❌ Dataset directory not found: {DATA}")
        print("Run: node node/fetch.js first")
        return
    
    video_files = [f for f in os.listdir(DATA) if f.endswith(".mp4")]
    print(f"📁 Found {len(video_files)} videos")
    
    for idx, f in enumerate(video_files, 1):
        if not f.endswith(".mp4"):
            continue
            
        vid = f.replace(".mp4","")
        video_path = os.path.join(DATA, f)
        frame_dir = os.path.join(DATA, vid)
        
        print(f"\n[{idx}/{len(video_files)}] 🎬 Processing {vid}...")
        
        # Skip if already processed
        if os.path.exists(frame_dir) and len(os.listdir(frame_dir)) > 0:
            print(f"⏭️  Frames already extracted")
        else:
            print("📸 Extracting frames...")
            if not extract_frames(video_path, frame_dir):
                continue
        
        print("🧠 Extracting CLIP features...")
        clip_vec = get_clip_features(frame_dir)
        
        print("🔤 Extracting OCR text...")
        ocr_text = get_text_features(frame_dir)
        
        print("🎙️ Extracting speech...")
        speech = get_speech_text(video_path)
        
        text_len = len(ocr_text)
        speech_len = len(speech)
        
        # Calculate proxy label
        label = proxy_score(text_len, speech_len)
        
        # Build feature vector: CLIP (128 dims) + text_len + speech_len
        features = list(clip_vec[:128]) + [text_len, speech_len]
        
        dataset.append({
            "id": vid,
            "x": features,
            "y": label
        })
        
        print(f"✅ Score: {label:.2f} | Text: {text_len} | Speech: {speech_len}")
    
    # Save dataset
    with open(OUT, "w") as f:
        json.dump(dataset, f, indent=2)
    
    print(f"\n🔥 Dataset ready! Saved {len(dataset)} samples to {OUT}")

if __name__ == "__main__":
    main()
