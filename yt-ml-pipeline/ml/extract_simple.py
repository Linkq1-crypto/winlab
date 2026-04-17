"""
Simple dataset extraction - creates training data from videos
Uses basic features + synthetic augmentation for robust training
"""
import os
import json
import subprocess
import sys
from pathlib import Path
import random
import math

DATA_DIR = Path(__file__).parent.parent / "dataset"
OUTPUT_FILE = Path(__file__).parent.parent / "train.json"

def get_video_duration(video_path):
    """Get video duration using ffprobe"""
    try:
        result = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            str(video_path)
        ], capture_output=True, text=True, check=True)
        
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception as e:
        return 30.0

def extract_simple_features(video_path):
    """Extract basic features from video file"""
    video_path = Path(video_path)
    
    if not video_path.exists():
        return None
    
    # Get file size
    file_size = video_path.stat().st_size
    
    # Get duration
    duration = get_video_duration(video_path)
    
    # Extract video ID from filename
    video_id = video_path.stem
    
    # Create feature vector (10 features)
    features = [
        file_size / (1024 * 1024),  # File size in MB
        duration,                    # Duration in seconds
        file_size / duration if duration > 0 else 0,  # Bytes per second
        min(duration, 60) / 60,     # Normalized duration
        min(file_size / (50 * 1024 * 1024), 1.0),  # Normalized size
        1.0 if duration < 60 else 0.0,  # Is short form
        min(duration, 45) / 45,     # Duration for shorts
        math.log1p(file_size) / 20, # Log normalized size
        (duration % 15) / 15,       # Duration pattern
        min(file_size / duration / 1000000, 1.0) if duration > 0 else 0,  # Mbps
    ]
    
    # Create quality score based on heuristics for tutorials
    # Optimal: 1-5 minutes, 10-150MB (tutorial content, not shorts)
    # Acceptable range: 30s-10min, 1-300MB
    duration_min = duration / 60
    
    if duration_min <= 1:
        # Too short for a tutorial (<1min) - low score
        duration_score = 0.3
    elif duration_min <= 5:
        # Sweet spot: 1-5 minutes
        duration_score = 0.9 + 0.1 * (1 - abs(duration_min - 3) / 2)
    elif duration_min <= 10:
        # Good: 5-10 minutes
        duration_score = 0.75
    elif duration_min <= 20:
        # Acceptable: 10-20 minutes
        duration_score = 0.6
    else:
        # Too long: >20 minutes
        duration_score = max(0.2, 0.6 - (duration_min - 20) / 40)

    # Size scoring: tutorials are larger than shorts
    size_mb = file_size / (1024 * 1024)
    if size_mb < 2:
        size_score = 0.2  # Too small, likely corrupted
    elif size_mb < 10:
        size_score = 0.6
    elif size_mb < 150:
        # Sweet spot for tutorials
        size_score = 0.9
    elif size_mb < 300:
        size_score = 0.7
    else:
        size_score = max(0.3, 0.7 - (size_mb - 300) / 500)
    
    quality_score = max(0.0, min(1.0, (duration_score * 0.6 + size_score * 0.4)))
    
    return {
        "id": video_id,
        "x": [round(f, 4) for f in features],
        "y": round(quality_score, 3)
    }

def generate_synthetic_samples(n=300):
    """Generate synthetic training samples with balanced tutorial quality distribution"""
    samples = []

    for _ in range(n):
        # Generate samples with DIFFERENT quality profiles for TUTORIALS
        quality_target = random.random()  # Uniform distribution 0-1

        if quality_target > 0.7:
            # High quality tutorials: 1-8 minutes, 10-150MB
            duration = random.uniform(60, 480)
            file_size = random.uniform(10, 150) * 1024 * 1024
        elif quality_target > 0.4:
            # Medium quality: 30s-15 minutes, 5-200MB
            duration = random.uniform(30, 900)
            file_size = random.uniform(5, 200) * 1024 * 1024
        else:
            # Low quality: <30s or >25 minutes, <2MB or >400MB
            if random.random() > 0.5:
                duration = random.uniform(5, 30)
                file_size = random.uniform(0.5, 2) * 1024 * 1024
            else:
                duration = random.uniform(1500, 3600)
                file_size = random.uniform(400, 800) * 1024 * 1024

        features = [
            file_size / (1024 * 1024),
            duration,
            file_size / duration if duration > 0 else 0,
            min(duration, 60) / 60,
            min(file_size / (50 * 1024 * 1024), 1.0),
            1.0 if duration < 60 else 0.0,
            min(duration, 45) / 45,
            math.log1p(file_size) / 20,
            (duration % 15) / 15,
            min(file_size / duration / 1000000, 1.0) if duration > 0 else 0,
        ]

        # Quality scoring matching the new tutorial heuristics
        duration_min = duration / 60
        
        if duration_min <= 1:
            duration_score = 0.3
        elif duration_min <= 5:
            duration_score = 0.9 + 0.1 * (1 - abs(duration_min - 3) / 2)
        elif duration_min <= 10:
            duration_score = 0.75
        elif duration_min <= 20:
            duration_score = 0.6
        else:
            duration_score = max(0.2, 0.6 - (duration_min - 20) / 40)

        size_mb = file_size / (1024 * 1024)
        if size_mb < 2:
            size_score = 0.2
        elif size_mb < 10:
            size_score = 0.6
        elif size_mb < 150:
            size_score = 0.9
        elif size_mb < 300:
            size_score = 0.7
        else:
            size_score = max(0.3, 0.7 - (size_mb - 300) / 500)
        
        quality_score = max(0.0, min(1.0, (duration_score * 0.6 + size_score * 0.4)))

        # Add small noise
        quality_score += random.gauss(0, 0.03)
        quality_score = max(0.0, min(1.0, quality_score))

        samples.append({
            "id": f"synthetic_{_}",
            "x": [round(f, 4) for f in features],
            "y": round(quality_score, 3)
        })

    return samples

def main():
    """Main extraction"""
    print("📁 Dataset Extraction + Synthetic Augmentation")
    print(f"📂 Dataset: {DATA_DIR}")
    print(f"📄 Output: {OUTPUT_FILE}")
    
    dataset = []
    
    # Process real videos
    if DATA_DIR.exists():
        video_files = list(DATA_DIR.glob("*.mp4"))
        print(f"\n🎬 Processing {len(video_files)} real videos...")
        
        for idx, video in enumerate(video_files, 1):
            features = extract_simple_features(video)
            if features:
                dataset.append(features)
        
        print(f"✅ Extracted {len(dataset)} real samples")
    
    # Generate synthetic samples
    print(f"\n🎲 Generating 300 synthetic samples...")
    synthetic = generate_synthetic_samples(300)
    dataset.extend(synthetic)
    
    # Save dataset
    OUTPUT_FILE.write_text(json.dumps(dataset, indent=2))
    
    # Statistics
    scores = [s["y"] for s in dataset]
    print(f"\n📊 Dataset Statistics:")
    print(f"  Total samples: {len(dataset)}")
    print(f"  Real videos: {len(dataset) - len(synthetic)}")
    print(f"  Synthetic: {len(synthetic)}")
    print(f"  Feature dimensions: {len(dataset[0]['x']) if dataset else 0}")
    print(f"  Score range: {min(scores):.3f} - {max(scores):.3f}")
    print(f"  Average score: {sum(scores)/len(scores):.3f}")
    print(f"📄 Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
