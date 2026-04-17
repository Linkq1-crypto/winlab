"""
ML Prediction - Load trained Ridge Regression model
"""
import os
import sys
import numpy as np
from pathlib import Path
import joblib

MODEL_PATH = Path(__file__).parent / "video_quality_model.joblib"

def predict(features):
    """Predict quality score for feature vector"""
    if not MODEL_PATH.exists():
        print(f"⚠️  Model not found, using heuristic")
        return heuristic_predict(features)
    
    model_data = joblib.load(MODEL_PATH)
    model = model_data['model']
    scaler = model_data['scaler']
    
    features_scaled = scaler.transform([features])
    score = model.predict(features_scaled)[0]
    
    return max(0.0, min(1.0, score))

def heuristic_predict(features):
    """Fallback heuristic prediction"""
    duration = features[1] if len(features) > 1 else 30
    file_size = features[0] if len(features) > 0 else 25

    # Optimal for shorts: 15-45 seconds
    duration_score = max(0, 1.0 - abs(duration - 30) / 45)
    
    # Optimal size: 5-50MB
    size_score = max(0, 1.0 - abs(file_size - 25) / 50)
    
    # Combined score
    score = (duration_score * 0.7 + size_score * 0.3)
    
    return max(0.0, min(1.0, score))

def main():
    """Test prediction or serve as API for Node.js"""
    # Check if called with JSON features from Node
    if len(sys.argv) > 1:
        try:
            import json
            features = json.loads(sys.argv[1])
            # Handle nested array
            if isinstance(features[0], list):
                features = features[0]
            score = predict(features)
            print(f"{score:.6f}")
            return
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    print("🧪 Testing ML Prediction")
    print("=" * 60)

    test_cases = [
        ("Short video (15s, 5MB)", [5.0, 15.0, 333333.0, 0.25, 0.1, 1.0, 0.33, 0.8, 0.0, 0.33]),
        ("Perfect short (30s, 25MB)", [25.0, 30.0, 833333.0, 0.5, 0.5, 1.0, 0.67, 0.85, 0.0, 0.83]),
        ("Medium video (45s, 40MB)", [40.0, 45.0, 888888.0, 0.75, 0.8, 1.0, 1.0, 0.9, 0.0, 0.89]),
        ("Long video (90s, 100MB)", [100.0, 90.0, 1111111.0, 1.0, 1.0, 0.0, 1.0, 0.95, 0.0, 1.0]),
        ("Very long (120s, 200MB)", [200.0, 120.0, 1666666.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
    ]

    print("\n📊 Predictions:")
    print("-" * 70)
    for name, features in test_cases:
        score = predict(features)
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        print(f"  {name:30} → {score:.3f} {bar}")

    print("\n💡 Model ready for integration!")

if __name__ == "__main__":
    main()
