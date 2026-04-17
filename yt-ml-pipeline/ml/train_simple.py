"""
Simple ML Model - Linear Regression for Video Quality
More stable than neural networks for small datasets
"""
import os
import json
import sys
import numpy as np
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib

MODEL_DIR = Path(__file__).parent
MODEL_PATH = MODEL_DIR / "video_quality_model.joblib"
DATASET_PATH = Path(__file__).parent.parent / "train.json"

def load_dataset():
    """Load dataset from JSON file"""
    if not DATASET_PATH.exists():
        print(f"❌ Dataset not found: {DATASET_PATH}")
        sys.exit(1)
    
    with open(DATASET_PATH, 'r') as f:
        data = json.load(f)
    
    X = np.array([sample['x'] for sample in data])
    y = np.array([sample['y'] for sample in data])
    
    print(f"📊 Loaded {len(data)} samples with {X.shape[1]} features")
    return X, y

def train_model(X, y):
    """Train Ridge Regression model"""
    # Split train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Standardize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Ridge Regression
    model = Ridge(alpha=1.0)
    model.fit(X_train_scaled, y_train)
    
    # Evaluate
    train_score = model.score(X_train_scaled, y_train)
    test_score = model.score(X_test_scaled, y_test)
    
    print(f"\n🏋️ Training Complete")
    print(f"  Train samples: {len(X_train)}")
    print(f"  Test samples: {len(X_test)}")
    print(f"  Train R²: {train_score:.4f}")
    print(f"  Test R²: {test_score:.4f}")
    
    # Save model + scaler
    model_data = {
        'model': model,
        'scaler': scaler,
        'input_dim': X.shape[1],
        'feature_names': [
            'file_size_mb',
            'duration_s',
            'bytes_per_sec',
            'duration_norm',
            'size_norm',
            'is_short',
            'duration_shorts',
            'log_size',
            'duration_pattern',
            'mbps'
        ]
    }
    
    joblib.dump(model_data, MODEL_PATH)
    print(f"\n💾 Model saved to: {MODEL_PATH}")
    
    return model, scaler

def predict(model, scaler, features):
    """Predict quality score"""
    features_scaled = scaler.transform([features])
    score = model.predict(features_scaled)[0]
    return max(0.0, min(1.0, score))

def main():
    """Main training pipeline"""
    print("🧠 ML Model Training (Ridge Regression)")
    print("=" * 60)
    
    # Load dataset
    X, y = load_dataset()
    
    # Train model
    model, scaler = train_model(X, y)
    
    # Test predictions
    print("\n🧪 Sample Predictions:")
    print("-" * 70)
    
    test_cases = [
        ("Short video (15s, 5MB)", [5.0, 15.0, 333333.0, 0.25, 0.1, 1.0, 0.33, 0.8, 0.0, 0.33]),
        ("Perfect short (30s, 25MB)", [25.0, 30.0, 833333.0, 0.5, 0.5, 1.0, 0.67, 0.85, 0.0, 0.83]),
        ("Medium video (45s, 40MB)", [40.0, 45.0, 888888.0, 0.75, 0.8, 1.0, 1.0, 0.9, 0.0, 0.89]),
        ("Long video (90s, 100MB)", [100.0, 90.0, 1111111.0, 1.0, 1.0, 0.0, 1.0, 0.95, 0.0, 1.0]),
        ("Very long (120s, 200MB)", [200.0, 120.0, 1666666.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
    ]
    
    for name, features in test_cases:
        score = predict(model, scaler, features)
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        print(f"  {name:30} → {score:.3f} {bar}")
    
    print("\n🎯 Model ready for production!")

if __name__ == "__main__":
    main()
