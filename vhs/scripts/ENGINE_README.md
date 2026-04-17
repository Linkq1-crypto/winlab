# 🎬 WinLab Apple-Style Video Engine

Scene-based timeline renderer with 3 A/B/C test variants.

## 📁 Architecture

```
apple_engine.py
├── ApplePrimitives    # Shared rendering helpers
├── build_text_scene() # Fade in → wait → fade out
├── build_terminal_scene() # Terminal reveal
├── build_logo_scene() # WinLab.cloud CTA
│
└── Variants:
    ├── VariantA       # Emotiva (empathy)
    ├── VariantB       # Apple Minimal (ultra clean)
    └── VariantC       # Provocatoria (viral)
```

## 🚀 Render Commands

### Horizontal (YouTube, 720p)
```bash
python -m manim vhs/scripts/apple_engine.py VariantA -qm --format=mp4
python -m manim vhs/scripts/apple_engine.py VariantB -qm --format=mp4
python -m manim vhs/scripts/apple_engine.py VariantC -qm --format=mp4
```

### Horizontal (YouTube, 1080p)
```bash
python -m manim vhs/scripts/apple_engine.py VariantA -qh --format=mp4
python -m manim vhs/scripts/apple_engine.py VariantB -qh --format=mp4
python -m manim vhs/scripts/apple_engine.py VariantC -qh --format=mp4
```

### Vertical (LinkedIn/IG, 9:16)
```bash
python -m manim vhs/scripts/apple_engine.py VariantA_Vertical -qh --format=mp4 -r 1080,1920
python -m manim vhs/scripts/apple_engine.py VariantB_Vertical -qh --format=mp4 -r 1080,1920
python -m manim vhs/scripts/apple_engine.py VariantC_Vertical -qh --format=mp4 -r 1080,1920
```

## 🎥 Variant Comparison

| Variant | Style | Hook | Target |
|---------|-------|------|--------|
| **A — Emotiva** | Empathy | "Connection lost." → "Again." → "Same skills. Different outcome." | People who relate to frustration |
| **B — Apple Minimal** | Ultra clean | "It's not your skills." → "It's your connection." | Apple-keynote aesthetic lovers |
| **C — Provocatoria** | Viral/Controversial | "Some learn on fiber." → "Others try on a SIM card." | Shareable, debate-trigger |

## 📊 A/B Test Strategy

1. **Upload all 3** to YouTube as unlisted
2. **Share links** in different LinkedIn posts
3. **Track after 48h**:
   - Watch time (hook retention at 3s, 8s, 15s)
   - Click-through to winlab.cloud
   - Shares/comments (engagement)
4. **Kill the loser**, double down on the winner

## 🧩 Adding a New Variant

```python
class VariantD(Scene):
    def construct(self):
        t = ApplePrimitives()
        
        # Your custom scene sequence
        build_text_scene(self, "Your text.", font_size=36)
        build_terminal_scene(self, safe_area_width=8)
        build_logo_scene(self)
```

Then render:
```bash
python -m manim vhs/scripts/apple_engine.py VariantD -qh --format=mp4
```

## 📁 Output Files

| File | Use |
|------|-----|
| `vhs/output/engine_VariantA.mp4` | A/B test — Emotiva |
| `vhs/output/engine_VariantB.mp4` | A/B test — Apple Minimal |
| `vhs/output/engine_VariantC.mp4` | A/B test — Provocatoria |

## 🎨 Customizing Terminal Commands

Edit `ApplePrimitives.draw_terminal_group()`:

```python
cmd1 = Text("$ your command here", ...)
ok = Text("✓ Your success message", ...)
```

## ⚡ Quick Test (Preview in Browser)

Open `vhs/engine/apple-video-engine.html` — interactive preview with play/pause and variant switching (no Manim needed for testing).
