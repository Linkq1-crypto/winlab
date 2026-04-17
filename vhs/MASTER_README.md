# 🎬 WinLab Content Engine — Complete System

**Auto-generation + rendering + thumbnails + scheduling + growth loop**

---

## 📁 Module Map

```
vhs/scripts/
├── vertical_engine.py      # Render native 1080×1920 videos (TikTok/IG/Shorts)
├── content_engine.py        # Auto-generate 50-100 video variants
├── series_generator.py      # Episodic narratives (Day 1, 3AM, Fake vs Real)
├── gamification.py          # Ranks, badges, leaderboard, replay
├── hero_youtube.py          # Hero YouTube video + thumbnails + titles + A/B
├── autopost.py              # Multi-platform scheduler + growth engine
├── comment_engine.py        # AI comment responses + viral thread finder
├── dashboard.py             # Streamlit live analytics dashboard
├── apple_engine.py          # Manim Apple-style videos (backup renderer)
└── hero_video_apple.py      # Apple-style hero variants (Manim)

data/
├── performance.json         # Video metrics (views, clicks, signups)
├── scheduled_jobs.json      # Post queue with timing
└── users.json               # Gamification user data
```

---

## 🚀 Quick Start

### 1. Generate Hero Video + Thumbnails + Titles
```bash
python vhs/scripts/hero_youtube.py --full --output vhs/output
```

Outputs:
- `hero_youtube_config.json` — video scene definition (75s)
- `thumb_v1_connection_lost.png` — thumbnail A (minimal)
- `thumb_v2_same_skills.png` — thumbnail B (bold)
- `thumb_v3_no_internet.png` — thumbnail C (glitch)
- `hero_youtube_metadata.json` — titles, tags, description, A/B variants

### 2. Generate 20+ Auto-Variants
```bash
python vhs/scripts/content_engine.py --generate 50 --output vhs/output
```

### 3. Render Videos (1080×1920)
```bash
python vhs/scripts/vertical_engine.py --template T1 --output vhs/output
python vhs/scripts/vertical_engine.py --batch --output vhs/output
```

### 4. Generate Emotion-Based Thumbnails
```bash
python vhs/scripts/autopost.py --thumbnails --hook "Connection lost"
```

Outputs:
- `thumb_frustrated_main.png` — face+text layout
- `thumb_determined_alt.png` — alternative emotion
- `thumb_frustrated_bold.png` — vertical version

### 5. Schedule Full Launch
```bash
python vhs/scripts/autopost.py --launch vhs/output/connection_lost.mp4 \
  --hook "Connection lost" \
  --title "Your Internet Shouldn't Decide Your Career"
```

Schedules posts across:
- YouTube (18:00)
- TikTok (12:30)
- Instagram (19:00)
- LinkedIn (08:00)

### 6. Run Growth Engine
```bash
python vhs/scripts/autopost.py --growth
```

Finds winners (CTR > 5%), reposts them, scales to all platforms.

### 7. Launch Dashboard
```bash
pip install streamlit pandas
streamlit run vhs/scripts/dashboard.py
```

---

## 🎬 Hero Video (YouTube)

### Recommended Combo
| Element | Value |
|---------|-------|
| **Title** | Your Internet Shouldn't Decide Your Career |
| **Thumbnail** | CONNECTION LOST (minimal, white on black) |
| **Duration** | 75 seconds (1m 15s) |
| **Style** | Apple keynote: slow, minimal, emotional |
| **CTA** | WinLab.cloud |

### Thumbnail Strategy
| Variant | Text | Emotion | Use |
|---------|------|---------|-----|
| V1 | CONNECTION LOST | Frustrated | **Primary** (highest CTR expected) |
| V2 | SAME SKILLS / DIFFERENT OUTCOME | Determined | A/B test |
| V3 | NO INTERNET / NO PROBLEM | Glitch | Bold/controversial |

### Title Variants (10 generated)
1. Your Internet Shouldn't Decide Your Career ← **recommended**
2. I Built a Sysadmin Lab That Works Offline
3. Why Most Engineers Can't Practice (And How I Fixed It)
4. This Is How Real Sysadmins Learn
5. The Infrastructure Inequality Nobody Talks About
6. Practice Sysadmin Without Internet
7. Why Tutorials Don't Work (And What Does)
8. Infrastructure Is Blocking Engineers. I Fixed It.
9. Learn Sysadmin Skills Without Internet
10. This Changes How Engineers Practice

### Shorts Strategy (teasers → hero video)
| Short | Hook | CTA in comments |
|-------|------|-----------------|
| 1 | "Connection lost." | Full story → [link] |
| 2 | "Same skills. Different outcome." | Full story → [link] |
| 3 | "Works offline." | Full story → [link] |
| 4 | "3AM Incident" | Full story → [link] |

---

## 📺 Content Library (27 videos generated)

### Hero Videos
| File | Resolution | Style |
|------|-----------|-------|
| `apple_hero.mp4` | 1920×1080 | Apple-style (Manim) |
| `apple_hero_vertical.mp4` | 1080×1920 | Apple vertical |
| `hero_final.mp4` | 1920×1080 | Apple refined |
| `hero_final_vertical.mp4` | 1080×1920 | Apple vertical (taller terminal) |
| `hero_v2.mp4` | 1920×1080 | Emotional story |
| `hero_v2_vertical.mp4` | 1080×1920 | Emotional vertical |

### Template Videos (T1-T3 + Content Engine)
| File | Resolution | Template |
|------|-----------|----------|
| `connection_lost.mp4` | 1080×1920 | T1: Emotiva |
| `career.mp4` | 1080×1920 | T2: Career |
| `fiber_vs_sim.mp4` | 1080×1920 | T3: Fiber vs SIM |
| `fail_fix.mp4` | 1080×1920 | T4: Break→Fix |
| `interview.mp4` | 1080×1920 | T5: Interview |
| `watching_vs_doing.mp4` | 1080×1920 | T6: Watching vs Doing |
| `cta.mp4` | 1080×1920 | T10: Final CTA |

### A/B Engine Variants
| File | Resolution | Variant |
|------|-----------|---------|
| `engine_VariantA.mp4` | 1280×720 | Emotiva |
| `engine_VariantA_Vertical.mp4` | 1080×1920 | Emotiva vertical |
| `engine_VariantB.mp4` | 1280×720 | Apple Minimal |
| `engine_VariantB_Vertical.mp4` | 1080×1920 | Apple Minimal vertical |
| `engine_VariantC.mp4` | 1280×720 | Provocatoria |
| `engine_VariantC_Vertical.mp4` | 1080×1920 | Provocatoria vertical |

### Content Engine Auto-Generated
| File | Use |
|------|-----|
| `content_Video04.mp4` | Terraform demo |
| `content_Video06.mp4` | Fail→Fix |
| `content_Video12.mp4` | Final CTA |

---

## 🌐 Multi-Platform Scheduling

### Active Schedule: **24 jobs**
| Time | Platform | Hook | Status |
|------|----------|------|--------|
| Day 1 18:00 | YouTube | Connection lost | Scheduled |
| Day 1 12:30 | TikTok | Connection lost | Scheduled |
| Day 1 19:00 | Instagram | Connection lost | Scheduled |
| Day 1 08:00 | LinkedIn | Connection lost | Scheduled |
| Day 3 18:30 | TikTok | Connection lost (repost) | Growth loop |
| Day 3 18:00 | YouTube | Same skills (repost) | Growth loop |
| ... | ... | ... | +14 more scale jobs |

### Growth Engine Results
- **4 winners** found (CTR > 5%) out of 5 videos tested
- **4 reposts** scheduled (same platform, varied caption)
- **16 scale jobs** created (cross-platform expansion)

---

## 💬 Comment Engine (AI Responses + Viral Threads)

### Auto-Respond to Comments
```bash
# Generate smart replies for all pending comments
python vhs/scripts/comment_engine.py --smart-replies

# Auto-respond with AI (requires OpenAI API key)
python vhs/scripts/comment_engine.py --smart-replies --ai
```

**Comment Classification (6 types):**
| Type | Detection | Response Strategy |
|------|-----------|-------------------|
| Question | Contains "?" or "how/what/why" | Answer + soft CTA |
| Praise | "great/amazing/🔥" | Thank + reinforce value |
| Skeptic | "not real/fake/doesn't work" | Validate concern + low-risk invite |
| Technical | Mentions commands/tools | Technical depth + scenario invite |
| Personal story | "I had/my experience" | Empathize + connect to mission |
| Humor | "😂/haha/lol" | Match tone + light CTA |

### Find Viral Threads to Engage With
```bash
# Find viral threads on LinkedIn about sysadmin
python vhs/scripts/comment_engine.py --find-threads --platform linkedin --topic sysadmin

# Find career-related threads
python vhs/scripts/comment_engine.py --find-threads --platform linkedin --topic career
```

**Thread Scoring Algorithm:**
- Likes × 0.5 + Comments × 2 + Shares × 3 + Views × 0.01
- Recency multiplier (2× if < 2h old)
- Relevance bonus per topic match

**Example Output:**
```
🔥 6315 pts — Tutorial hell is real. I watched 100 hours of Docker...
   💬 Suggested: Tutorials create false confidence. Real learning starts when things break.
```

### Full Engagement Loop
```bash
python vhs/scripts/comment_engine.py --engagement-loop
```

This:
1. Processes all pending comments → generates smart replies
2. Finds viral threads → suggests engagement replies
3. Saves everything to `data/generated_replies.json`

---

## 🎨 Thumbnail Gallery

### Emotion-Based Thumbnails (6 generated)
| File | Emotion | Style | Size |
|------|---------|-------|------|
| `thumb_frustrated_main.png` | Frustrated | Face+text | 1280×720 |
| `thumb_determined_alt.png` | Determined | Face+text | 1280×720 |
| `thumb_frustrated_bold.png` | Frustrated | Vertical bold | 1080×1920 |
| `thumb_v1_connection_lost.png` | Minimal | Text only | 1280×720 |
| `thumb_v2_same_skills.png` | Bold | Text only | 1280×720 |
| `thumb_v3_no_internet.png` | Glitch | RGB split | 1280×720 |

---

## 🏆 Gamification

### Simulated Users: 20
- **Top Engineer**: User_001 — 640 pts (Senior) — 6 badges
- **Ranks**: Junior → Intermediate → Senior → Expert → Principal
- **Badges**: First Fix, Stayed Calm, Log Master, Under 5s, 3 Day Streak, etc.

---

## 📊 Dashboard

Launch with:
```bash
streamlit run vhs/scripts/dashboard.py
```

Shows:
- Top performing hooks ranked by score
- Cluster performance comparison
- Video structure distribution
- Landing page mappings
- Growth engine status

---

## 🔁 Full Pipeline

```
content_engine.py → generate 50 variants
       ↓
vertical_engine.py → render 1080×1920 MP4s
       ↓
hero_youtube.py → generate thumbnails + titles
       ↓
autopost.py → schedule across 5 platforms
       ↓
48h → collect metrics
       ↓
autopost.py --growth → repost winners + scale
       ↓
Repeat
```

---

## ⚡ Commands Cheat Sheet

| Task | Command |
|------|---------|
| Generate hero package | `python vhs/scripts/hero_youtube.py --full` |
| Generate N variants | `python vhs/scripts/content_engine.py --generate 50` |
| Render one video | `python vhs/scripts/vertical_engine.py -t T1` |
| Render all templates | `python vhs/scripts/vertical_engine.py --batch` |
| Generate thumbnails | `python vhs/scripts/autopost.py --thumbnails --hook "..."` |
| Schedule launch | `python vhs/scripts/autopost.py --launch file.mp4` |
| Run growth loop | `python vhs/scripts/autopost.py --growth` |
| Run scheduler | `python vhs/scripts/autopost.py --schedule` |
| Generate series | `python vhs/scripts/series_generator.py --all` |
| Simulate users | `python vhs/scripts/gamification.py --simulate 50` |
| Show leaderboard | `python vhs/scripts/gamification.py --leaderboard` |
| **Smart replies** | `python vhs/scripts/comment_engine.py --smart-replies` |
| **Find viral threads** | `python vhs/scripts/comment_engine.py --find-threads --topic sysadmin` |
| **Engagement loop** | `python vhs/scripts/comment_engine.py --engagement-loop` |
| Launch dashboard | `streamlit run vhs/scripts/dashboard.py` |

---

## 📈 Growth Strategy

### Week 1: Launch
1. Publish hero video (YouTube)
2. Post 4 shorts (TikTok, IG, LinkedIn, FB)
3. Track metrics for 48h

### Week 2: Optimize
1. Run growth engine → find winners
2. Repost top 2 with varied captions
3. Scale to remaining platforms

### Week 3: Scale
1. Generate 50 new variants (from winning clusters)
2. Render top 10
3. Schedule staggered launches

### Week 4: Automate
1. Enable scheduler daemon
2. Set up performance tracking
3. Let system evolve autonomously

---

**Full system documentation:**
- Content Engine: `vhs/scripts/CONTENT_ENGINE_README.md`
- Vertical Engine: `vhs/scripts/VERTICAL_ENGINE_README.md`
- Hero YouTube: inline in `hero_youtube.py`
