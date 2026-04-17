"""Test trained model on videos from dataset"""
import joblib
import json
import glob
import os
import sys
from pathlib import Path

# Add ml to path
sys.path.insert(0, str(Path(__file__).parent / "ml"))
from extract_simple import extract_simple_features

MODEL_PATH = Path(__file__).parent / "ml" / "video_quality_model.joblib"

# Load model
model_data = joblib.load(MODEL_PATH)
model = model_data['model']
scaler = model_data['scaler']

# Get videos
videos = glob.glob("dataset/*.mp4")

print(f"🎬 Testing trained model on {min(10, len(videos))} videos:\n")

for v in videos[:10]:
    feat = extract_simple_features(v)
    if feat:
        features_scaled = scaler.transform([feat['x']])
        score = model.predict(features_scaled)[0]
        score = max(0.0, min(1.0, score))
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        status = "✅ PASS" if score >= 0.75 else "❌ SKIP"
        print(f"  {os.path.basename(v):25} → {score:.3f} {bar} {status}")

print(f"\n🎯 Threshold: 0.75")
