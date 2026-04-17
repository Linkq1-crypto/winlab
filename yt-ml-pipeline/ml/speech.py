import whisper
import os

# Load Whisper model once at module level
print("🎙️ Loading Whisper model...")
model = whisper.load_model("base")

def get_speech_text(video_path):
    """Transcribe speech from video and return text"""
    if not os.path.exists(video_path):
        print(f"⚠️  Video not found: {video_path}")
        return ""
    
    try:
        result = model.transcribe(video_path)
        return result["text"][:300]
    except Exception as e:
        print(f"❌ Speech recognition error: {e}")
        return ""
