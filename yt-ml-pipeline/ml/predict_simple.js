/**
 * Node.js wrapper for Python Ridge Regression model prediction
 * Calls Python script via spawnSync
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const MODEL_DIR = path.join(__dirname);
const MODEL_PATH = path.join(MODEL_DIR, "video_quality_model.joblib");

// Cache: load model once
let modelData = null;

function loadModel() {
  if (modelData) return modelData;
  
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Model not found: ${MODEL_PATH}`);
  }

  // Use Python to load and serialize model
  const result = spawnSync("python", [
    "-c",
    `
import joblib, json, sys
model_data = joblib.load("${MODEL_PATH.replace(/\\/g, "\\\\")}")
m = model_data['model']
s = model_data['scaler']
# Output coefficients for Ridge
result = {
  "coef": m.coef_.tolist(),
  "intercept": float(m.intercept_),
  "mean": s.mean_.tolist(),
  "scale": s.scale_.tolist(),
  "input_dim": int(model_data['input_dim'])
}
print(json.dumps(result))
`
  ], { encoding: "utf-8" });

  if (result.status !== 0) {
    throw new Error(`Failed to load model: ${result.stderr}`);
  }

  modelData = JSON.parse(result.stdout.trim());
  return modelData;
}

function predict(features) {
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error("Features must be a non-empty array");
  }

  // If single sample, wrap in array
  if (typeof features[0] === "number") {
    features = [features];
  }

  try {
    const model = loadModel();
    
    // Manual Ridge Regression prediction: y = (X - mean) / scale * coef + intercept
    const predictions = features.map(feat => {
      // Standardize
      const standardized = feat.map((v, i) => (v - model.mean[i]) / model.scale[i]);
      
      // Predict: y = X * coef + intercept
      let y = model.intercept;
      for (let i = 0; i < standardized.length && i < model.coef.length; i++) {
        y += standardized[i] * model.coef[i];
      }
      
      return Math.max(0.0, Math.min(1.0, y));
    });

    // Return single value if single input
    return features.length === 1 ? predictions[0] : predictions;
  } catch (err) {
    // Fallback: try calling Python script directly
    const result = spawnSync("python", [
      path.join(__dirname, "predict_simple.py"),
      JSON.stringify(features)
    ], { encoding: "utf-8", timeout: 10000 });

    if (result.status === 0) {
      return parseFloat(result.stdout.trim());
    }

    throw new Error(`Prediction failed: ${err.message}`);
  }
}

module.exports = { predict, loadModel };
