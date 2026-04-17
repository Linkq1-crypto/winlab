import torch
import os
import sys
from PIL import Image

# Global variables for CLIP model
model = None
preprocess = None

# Try to import clip, fallback to transformers CLIP
try:
    import clip
    model, preprocess = clip.load("ViT-B/32", device="cpu")
    print("✅ CLIP model loaded (openai/clip)")
except ImportError:
    try:
        from transformers import CLIPProcessor, CLIPModel
        clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        preprocess = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        model = clip_model
        print("✅ CLIP model loaded (transformers)")
    except Exception as e:
        print(f"⚠️  CLIP model not available: {e}")
        print("👉 Install with: pip install git+https://github.com/openai/CLIP.git")
        model = None
        preprocess = None


def get_clip_features(folder):
    """Extract CLIP embeddings from all frames in folder and return average vector"""
    if model is None or preprocess is None:
        print(f"⚠️  CLIP not loaded, returning zero vector for {folder}")
        return [0] * 512

    vecs = []
    frame_files = [f for f in os.listdir(folder) if f.endswith(".jpg")]
    
    if not frame_files:
        print(f"⚠️  No frames found in {folder}")
        return [0] * 512

    print(f"  📊 Processing {len(frame_files)} frames with CLIP...")

    for idx, f in enumerate(frame_files):
        try:
            img_path = os.path.join(folder, f)
            img = Image.open(img_path).convert("RGB")
            
            # Different preprocessing based on library
            if hasattr(preprocess, '__call__') and not hasattr(preprocess, 'images'):
                # Original CLIP
                img_input = preprocess(img).unsqueeze(0)
                with torch.no_grad():
                    features = model.encode_image(img_input)
                    vecs.append(features.squeeze().numpy())
            else:
                # Transformers CLIP
                inputs = preprocess(images=[img], return_tensors="pt", padding=True)
                with torch.no_grad():
                    features = model.get_image_features(**inputs)
                    vecs.append(features.squeeze().numpy())
            
            if (idx + 1) % 50 == 0:
                print(f"    ✅ {idx + 1}/{len(frame_files)} frames processed")
                
        except Exception as e:
            print(f"    ⚠️  Error processing {f}: {e}")
            continue

    # Return average embedding vector
    if vecs:
        avg = sum(vecs) / len(vecs)
        return avg.tolist()
    else:
        return [0] * 512
