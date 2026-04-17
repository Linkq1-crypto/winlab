# 🎬 WinLab Vertical Content Engine

**Native 1080×1920** vertical video generator for TikTok, Instagram Reels, LinkedIn.

## ✅ Features

- **1080×1920 canvas** — built for mobile, not adapted after
- **Terminal 70-80% of screen** — occupies almost the full height
- **Auto-scaling fonts ≥ 60px** — readable on any phone
- **Safe areas respected** — no text under TikTok captions or IG buttons
- **Typing animation** with easing (realistic, not robotic)
- **Apple-style fades** — smooth in/out
- **10 viral templates** ready to render
- **Batch generation** — all 10 at once

## 🚀 Usage

### Single video
```bash
python vhs/scripts/vertical_engine.py --template T1 --output vhs/output
```

### Batch all 10
```bash
python vhs/scripts/vertical_engine.py --batch --output vhs/output
```

## 📋 10 Templates

| ID | Name | Hook | Style |
|----|------|------|-------|
| T1 | Connection Lost | "Connection lost. Again. Same skills. Different outcome." | Hero |
| T2 | Career | "Your internet shouldn't decide your career." | Empathy |
| T3 | Fiber vs SIM | "Some learn on fiber. Others try on a SIM card." | Viral |
| T4 | Fail → Fix | "System failed. Now fix it." | Dopamine |
| T5 | Interview | "This is what interviews test." | Credibility |
| T6 | Watching vs Doing | "Watching is easy. Doing is hard." | Educational |
| T7 | 11 Failures | "11 failures. 1 real skill." | Story |
| T8 | AI Mentor | "It doesn't give answers. It asks questions." | Feature |
| T9 | Speed | "30 seconds. You're inside a real lab." | Friction killer |
| T10 | CTA | "Break things. Fix them. Learn for real." | Conversion |

## 📁 Output Files

Generated in `vhs/output/`:
- `connection_lost.mp4` — 1080×1920
- `career.mp4` — 1080×1920
- `fiber_vs_sim.mp4` — 1080×1920
- ... (one per template)

## 🎨 Design Specs

| Property | Value |
|----------|-------|
| Resolution | 1080 × 1920 |
| Terminal size | 75% of screen height |
| Font size | 60–72px (auto-fit) |
| Safe top | 120px |
| Safe bottom | 300px |
| Safe left | 80px |
| Safe right | 120px |
| Background | #0a0a0a |
| Terminal | #121212 |
| Text | #f0f0f0 |
| Commands | #60a5fa |
| Success | #22c55e |

## ⚡ Rendering Speed

- **~30-60 seconds per video** (with `preset=fast`)
- **~5-10 minutes for all 10**

## 🧩 Add Custom Template

Edit `vertical_engine.py` → add to `TEMPLATES` dict:

```python
"T11": {
    "name": "my_video",
    "scenes": [
        {"type": "text", "text": "Hook text.", "duration": 2.0},
        {"type": "terminal", "cmd": "your command", "status": "✓ success", "duration": 5.0},
        {"type": "text", "text": "CTA", "duration": 3.0, "color": "accent"},
    ]
}
```

Scene types:
- `"black"` — pause
- `"text"` — centered text (colors: "text", "error", "success", "accent")
- `"terminal"` — command + status with typing animation

## 📤 Upload Strategy

| Platform | Format | Notes |
|----------|--------|-------|
| TikTok | MP4 1080×1920 | Add music in-app |
| Instagram Reels | MP4 1080×1920 | No edits needed |
| LinkedIn | MP4 1080×1920 | Works natively |
| YouTube Shorts | MP4 1080×1920 | Add #shorts in title |
