import sys
import json
import torch
import torch.nn as nn
import os

# Load model and metadata
model_path = os.path.join(os.path.dirname(__file__), "model.pt")

if not os.path.exists(model_path):
    print("❌ Model not found. Run train.py first.")
    sys.exit(1)

print("🔮 Loading model...")
checkpoint = torch.load(model_path, map_location="cpu")

input_dim = checkpoint["input_dim"]
norm_params = checkpoint["norm_params"]

# Define same model architecture
class VideoQualityModel(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        return self.net(x)

model = VideoQualityModel(input_dim)
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

# Get features from command line argument
if len(sys.argv) < 2:
    print("Usage: python predict.py '[feature1, feature2, ...]'")
    sys.exit(1)

features = json.loads(sys.argv[1])

# Validate feature count
if len(features) != input_dim:
    print(f"❌ Expected {input_dim} features, got {len(features)}")
    sys.exit(1)

# Normalize features
x = torch.tensor(features, dtype=torch.float32)
x_mean = torch.tensor(norm_params["mean"])
x_std = torch.tensor(norm_params["std"])
x = (x - x_mean) / x_std

# Predict
with torch.no_grad():
    score = model(x.unsqueeze(0)).item()

print(f"{score:.4f}")
