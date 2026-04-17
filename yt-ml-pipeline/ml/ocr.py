import cv2
import os
import pytesseract

# Windows Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def get_text_features(folder):
    """Extract OCR text from all frames in folder and return text features"""
    text = []
    for f in os.listdir(folder):
        if f.endswith(".jpg"):
            try:
                img = cv2.imread(os.path.join(folder, f))
                if img is None:
                    continue
                    
                # Try OCR
                t = pytesseract.image_to_string(img)
                if len(t.strip()) > 5:
                    text.append(t)
            except Exception as e:
                print(f"⚠️  OCR error on {f}: {e}")
                continue
    
    # Return concatenated text (truncated)
    return " ".join(text)[:300]
