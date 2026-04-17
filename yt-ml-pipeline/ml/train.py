import json
import torch
import torch.nn as nn
import torch.optim as optim
import os

# Load dataset
dataset_path = os.path.join(os.path.dirname(__file__), "../train.json")

print("📊 Loading dataset...")
with open(dataset_path) as f:
    data = json.load(f)

if len(data) == 0:
    print("❌ Empty dataset. Run extract.py first.")
    exit(1)

print(f"✅ Loaded {len(data)} samples")

# Prepare data
X = torch.tensor([d["x"] for d in data], dtype=torch.float32)
Y = torch.tensor([[d["y"]] for d in data], dtype=torch.float32)

# Normalize features
X_mean = X.mean(dim=0)
X_std = X.std(dim=0) + 1e-8
X = (X - X_mean) / X_std

# Save normalization params
norm_params = {
    "mean": X_mean.tolist(),
    "std": X_std.tolist()
}
with open(os.path.join(os.path.dirname(__file__), "norm_params.json"), "w") as f:
    json.dump(norm_params, f)

# Define model
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
            nn.Sigmoid()  # Output between 0 and 1
        )
    
    def forward(self, x):
        return self.net(x)

# Initialize model
input_dim = len(X[0])
model = VideoQualityModel(input_dim)

# Training setup
optimizer = optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.MSELoss()

# Training loop
print(f"\n🏋️ Training model with {input_dim} input features...")
epochs = 500

for epoch in range(epochs):
    # Forward pass
    pred = model(X)
    loss = loss_fn(pred, Y)
    
    # Backward pass
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    
    # Log progress
    if epoch % 50 == 0:
        print(f"Epoch {epoch:3d}/{epochs} | Loss: {loss.item():.6f}")

# Save model
model_path = os.path.join(os.path.dirname(__file__), "model.pt")
torch.save({
    "model_state_dict": model.state_dict(),
    "input_dim": input_dim,
    "norm_params": norm_params
}, model_path)

print(f"\n🔥 Model trained and saved to {model_path}")

# Final evaluation
with torch.no_grad():
    final_pred = model(X)
    final_loss = loss_fn(final_pred, Y)
    print(f"Final Loss: {final_loss.item():.6f}")
    
    # Show predictions vs actuals for first 5 samples
    print("\n📋 Sample predictions:")
    for i in range(min(5, len(data))):
        print(f"  {data[i]['id']}: Predicted={final_pred[i].item():.2f} | Actual={Y[i].item():.2f}")
