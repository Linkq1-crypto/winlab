# 🎬 HERO LAUNCH VIDEO - Complete Script
# Duration: 25 seconds
# Format: 16:9 (YouTube) + 9:16 (LinkedIn/IG)

## ─── VIDEO STRUCTURE ─────────────────────────────────────────────────────

### ⏱️ 0-3s: HOOK
**Visual**: Black screen → Terminal fades in
**Text**: "Same skills. Different outcome."
**Voice**: "A junior engineer in Bangalore..."
**Music**: Ambient, low bass

---

### ⏱️ 3-8s: PROBLEM
**Visual**: Split screen
- Left: Red "TIMEOUT ❌" 
- Right: Terminal active ⚡
**Text**: "Connection dropped."
**Voice**: "...loses internet connection."
**Music**: Tension build-up

---

### ⏱️ 8-12s: INSIGHT (HARD HIT)
**Visual**: Full screen, slow zoom
**Text**: "Because of a SIM card."
**Voice**: "Because of a SIM card."
**Music**: Silence for 0.5s, then bass drop

---

### ⏱️ 12-20s: SOLUTION
**Visual**: Terminal commands typing (Apple style)
**Text Overlay** (appears sequentially):
```
✓ Works on GSM
✓ Works offline
✓ Works anywhere
```
**Voice**: "WinLab works on any connection. Even 2G."
**Music**: Uplifting, building

---

### ⏱️ 20-25s: CLOSING + CTA
**Visual**: Clean terminal → Fade to logo
**Text**: 
```
Same lab. Same chance.

WinLab.cloud
```
**Voice**: "Same lab. Same chance. WinLab.cloud"
**Music**: Resolution, fade out

---

## ─── VOICEOVER SCRIPT (English) ──────────────────────────────────────────

**Tone**: Calm, authoritative, story-driven
**Pace**: Slow, deliberate (Apple keynote style)

```
[0-3s]    "A junior engineer in Bangalore..."
[3-8s]    "...loses internet connection."
[8-12s]   "Because of a SIM card."
[12-20s]  "WinLab works on any connection. Even 2G."
[20-25s]  "Same lab. Same chance. WinLab dot cloud."
```

---

## ─── VOICEOVER SCRIPT (Hindi) ────────────────────────────────────────────

**Tone**: Professional, inspiring

```
[0-3s]    "बैंगलोर में एक जूनियर इंजीनियर..."
[3-8s]    "...इंटरनेट कनेक्शन खो देता है।"
[8-12s]   "एक SIM कार्ड की वजह से।"
[12-20s]  "WinLab किसी भी कनेक्शन पर काम करता है। 2G पर भी।"
[20-25s]  "Same lab. Same chance. WinLab.cloud"
```

---

## ─── TEXT OVERLAY SPECIFICATIONS ─────────────────────────────────────────

### Font
- **Primary**: Montserrat Bold (free, Google Fonts)
- **Fallback**: Arial Bold
- **Size**: 64px (hook/CTA), 48px (problem), 36px (solution bullets)

### Colors
- **Hook**: White (#ffffff)
- **Problem**: Red (#ff4444)
- **Insight**: Orange (#ffaa00)
- **Solution**: Green (#22c55e)
- **CTA**: Blue (#3b82f6)

### Position
- **Hook/CTA**: Center screen
- **Problem**: Bottom center
- **Insight**: Center (slow zoom)
- **Solution**: Left side (sequential)

---

## ─── MARKETING COPY ──────────────────────────────────────────────────────

### YouTube Title
```
Fix a Broken Server in 15 Seconds | WinLab
```

### YouTube Description
```
Watch how fast you can diagnose and restart a downed web server 
in WinLab's realistic terminal sandbox.

✅ No VM required
✅ Works on 2G/3G/4G
✅ Real Linux scenarios
✅ Browser-based

Try it free: https://winlab.cloud

#Linux #SysAdmin #DevOps #CloudComputing #TechSkills
```

### LinkedIn Post
```
Same skills. Different outcome.

A junior engineer in Bangalore lost his internet connection 
because of a SIM card issue.

But he could still complete his Linux lab.

WinLab works on:
✓ 2G connections
✓ Offline mode
✓ Any device, any browser

Because talent is universal. Access shouldn't be the barrier.

Try it free → winlab.cloud

#TechEducation #Linux #DevOps #Cloud #InclusiveTech #WinLab
```

### Instagram Caption
```
When your internet drops but your lab doesn't 🌍💻

WinLab adapts to YOUR connection — 2G, 3G, or 4G

🔗 Link in bio to try free

#linux #sysadmin #devops #cloudcomputing #techskills #coding #programming
```

---

## ─── PRODUCTION NOTES ───────────────────────────────────────────────────

### Music
- **Style**: Ambient electronic (similar to Apple product videos)
- **Recommended**: 
  - "Digital Ambience" by Scott Buckley (free, CC BY 4.0)
  - "Innovation" by Bensound (free with attribution)
- **Volume**: -18 LUFS (background, not overpowering)

### Voice Recording
- **Mic**: USB condenser mic (Blue Yeti or similar)
- **Room**: Quiet, minimal reverb
- **Software**: Audacity (free) or Adobe Audition
- **Processing**: 
  - Noise reduction
  - Compression (3:1 ratio)
  - EQ (boost 2-4kHz for clarity)

### Alternative: AI Voice
If recording isn't possible, use:
- **ElevenLabs** (elevenlabs.io) - "Adam" voice (authoritative, calm)
- **Murf.ai** - "Marcus" (professional, tech-friendly)

---

## ─── GENERATION WORKFLOW ───────────────────────────────────────────────

1. **Generate terminal video**:
   ```bash
   vhs vhs/scenarios/hero_launch.tape --output hero_terminal.mp4
   ```

2. **Assemble with overlays**:
   ```bash
   vhs/scripts/assemble_hero_video.bat
   ```

3. **Add voiceover** (manual step):
   ```bash
   ffmpeg -i hero_launch_final.mp4 -i voiceover.mp3 \
     -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 \
     hero_launch_with_voice.mp4
   ```

4. **Add music** (optional):
   ```bash
   ffmpeg -i hero_launch_with_voice.mp4 -i background_music.mp3 \
     -filter_complex "[0:a]volume=1.0[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2" \
     -c:v copy hero_launch_complete.mp4
   ```

5. **Upload**:
   - YouTube: `hero_launch_complete.mp4` (16:9)
   - LinkedIn: `hero_launch_vertical.mp4` (9:16)

---

## ─── A/B TESTING VARIANTS ──────────────────────────────────────────────

### Variant A (Current): Story-driven
- Hook: "Same skills. Different outcome."
- Focus: Bangalore engineer narrative

### Variant B: Direct problem/solution
- Hook: "Your server is down. Now what?"
- Focus: Technical urgency

### Variant C: Challenge-based
- Hook: "Can you fix this in 15 seconds?"
- Focus: Gamification, skill test

### Variant D: Accessibility-first
- Hook: "Labs that work on 2G"
- Focus: India/Africa market

---

## ─── METRICS TO TRACK ──────────────────────────────────────────────────

- **Hook retention**: % who watch past 3 seconds
- **Problem engagement**: % who watch past 8 seconds
- **Solution completion**: % who watch past 20 seconds
- **CTA click-through**: % who visit winlab.cloud
- **Vertical vs Horizontal**: Which performs better on LinkedIn?

---

## ─── NEXT STEPS ────────────────────────────────────────────────────────

1. ✅ Run: `vhs/scripts/assemble_hero_video.bat`
2. 🎙️ Record voiceover (or use ElevenLabs)
3. 🎵 Add background music
4. 📤 Upload to YouTube + LinkedIn
5. 📊 Track metrics after 48 hours
6. 🔄 Iterate with Variant B/C/D

---

**Ready to launch?** Run the assembler and you'll have your hero video! 🚀
