"""Test trained model on ALL videos from dataset"""
import joblib
import glob
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "ml"))
from extract_simple import extract_simple_features

MODEL_PATH = Path(__file__).parent / "ml" / "video_quality_model.joblib"

model_data = joblib.load(MODEL_PATH)
model = model_data['model']
scaler = model_data['scaler']

videos = glob.glob("dataset/*.mp4")

scores = []
print(f"🎬 Testing on ALL {len(videos)} videos:\n")

for v in videos:
    feat = extract_simple_features(v)
    if feat:
        features_scaled = scaler.transform([feat['x']])
        score = model.predict(features_scaled)[0]
        score = max(0.0, min(1.0, score))
        scores.append((os.path.basename(v), score))

# Sort by score descending
scores.sort(key=lambda x: x[1], reverse=True)

passed = [s for s in scores if s[1] >= 0.75]
failed = [s for s in scores if s[1] < 0.75]

print(f"🏆 TOP 20 videos (by score):")
print("-" * 70)
for name, score in scores[:20]:
    bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
    status = "✅" if score >= 0.75 else "❌"
    print(f"  {status} {name:25} {score:.3f} {bar}")

print(f"\n📊 Summary:")
print(f"  Total: {len(scores)}")
print(f"  ✅ PASS (>=0.75): {len(passed)}")
print(f"  ❌ SKIP (<0.75): {len(failed)}")
print(f"  Avg score: {sum(s[1] for s in scores)/len(scores):.3f}")
print(f"  Median: {sorted(s[1] for s in scores)[len(scores)//2]:.3f}")
