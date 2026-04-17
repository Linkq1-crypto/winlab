# 🎬 WinLab Content Engine — Complete System

**Auto-generation + reinforcement + dynamic landing + series + gamification**

## 📁 Architecture

```
vhs/scripts/
├── content_engine.py          # Auto-generate 50-100 video variants
├── vertical_engine.py         # Render native 1080×1920 videos
├── series_generator.py        # Episodic narratives (Day 1, 3AM, etc.)
├── gamification.py            # Ranks, badges, leaderboard, replay
├── dashboard.py               # Streamlit live dashboard
├── apple_engine.py            # Manim Apple-style videos (backup)
└── hero_video_apple.py        # Hero launch videos (backup)
```

## 🚀 Quick Start

### 1. Generate 20 Video Variants
```bash
python vhs/scripts/content_engine.py --generate 20 --output vhs/output
```

This creates:
- 20 unique video JSON configs
- `vhs/output/manifest.json` (index)
- `vhs/output/auto_videos_config.py` (Python render calls)
- `vhs/output/landings.json` (video → landing mappings)

### 2. Render Videos (Vertical 1080×1920)
```bash
python vhs/scripts/vertical_engine.py --batch --output vhs/output
```

### 3. Generate Series
```bash
python vhs/scripts/series_generator.py --all --output vhs/output
```

### 4. Run Gamification Simulation
```bash
python vhs/scripts/gamification.py --simulate 50
python vhs/scripts/gamification.py --leaderboard
```

### 5. Launch Dashboard
```bash
pip install streamlit
streamlit run vhs/scripts/dashboard.py
```

---

## 🔧 Content Engine

### Auto-Generate Videos
```bash
# Fresh generation
python vhs/scripts/content_engine.py --generate 50

# Evolve from performance data
python vhs/scripts/content_engine.py --evolve --data data/performance.json

# AI hook generation (requires OpenAI API key)
python vhs/scripts/content_engine.py --ai-hooks --angle "fear and pressure"
```

### Video Structures (6 types)
| Structure | Pattern | Best For |
|-----------|---------|----------|
| `problem` | Hook → Tension → Terminal → CTA | Hero videos |
| `contrast` | Two ideas compared → Terminal → Resolution | Viral content |
| `solution` | Problem → Fix → Done | Quick tips |
| `fear` | Threat → Urgency → Terminal → Practice | Engagement |
| `identity` | Fake vs Real comparison → Terminal → Difference | Credibility |
| `speed` | Quick claim → Terminal → CTA | Friction killer |

### Content Clusters (7 types)
| Cluster | Trigger Hook Example | Landing |
|---------|---------------------|---------|
| `inequality` | "Connection lost." | "Your internet shouldn't decide your career." |
| `learning` | "Watching is easy. Doing is hard." | "You don't learn sysadmin by watching." |
| `challenge` | "Break it. Fix it." | "Learn by solving real failures." |
| `identity` | "Real engineers don't copy commands." | "The difference? Practice." |
| `speed` | "30 seconds to a real lab." | "No VM. No setup." |
| `technical` | "This is what interviews test." | "Real scenarios. Not theory." |
| `general` | Any other | "Practice real sysadmin skills." |

---

## 📺 Series Generator

### Available Series
| Series | Episodes | Arc |
|--------|----------|-----|
| `day1` | 7 | Confusion → Competence |
| `3am` | 7 | Stress → Control |
| `fake_vs_real` | 7 | Identity / Ego |

### Usage
```bash
# List all series
python vhs/scripts/series_generator.py --list

# Generate one series
python vhs/scripts/series_generator.py --series day1 --output vhs/output

# Generate all series
python vhs/scripts/series_generator.py --all --output vhs/output
```

### Episode Structure
Each episode: Hook → Tension → Terminal → Cliffhanger → CTA (last episode)

---

## 🏆 Gamification

### Ranks
| Rank | Score | Color |
|------|-------|-------|
| Junior | 0 | Gray |
| Intermediate | 100 | Blue |
| Senior | 300 | Green |
| Expert | 700 | Gold |
| Principal | 1500 | Purple |

### Badges (10 available)
🔧 First Fix · 😎 Stayed Calm · 📋 Log Master · ⚡ Under 5s · 🔥 3 Day Streak · 🔥 Week Warrior · 🏆 Base Cleared · 💀 Advanced First Blood · 🦉 Night Owl · ✨ Perfect Run

### Features
- **Leaderboard**: Top engineers by score
- **Personalized replay**: Re-generates failed scenarios as videos
- **Hardcore mode**: Timed challenge videos
- **Badge overlays**: Visual rank/badge data for video rendering

---

## 🌐 Dynamic Landing Pages

Every video → matched landing page via cluster:

```python
video = {"hook": "Connection lost.", "cluster": "inequality"}
landing = generate_landing_for_video(video)
# → "Your internet shouldn't decide your career."
# → URL: winlab.cloud/?src=inequality&vid=video_001
```

### Frontend Integration
```javascript
const params = new URLSearchParams(window.location.search);
const src = params.get("src");

const headlines = {
  "inequality": "Your internet shouldn't decide your career.",
  "learning": "You don't learn sysadmin by watching.",
  "challenge": "Break it. Fix it.",
  // ...
};

document.getElementById("headline").textContent = headlines[src] || defaultHeadline;
```

---

## 📊 Dashboard

Metrics tracked:
- **Total videos** generated
- **Views / Clicks / Signups**
- **CTR** (click-through rate)
- **CR** (conversion rate)
- **Top hooks** ranked by score
- **Best clusters** by performance
- **Structure distribution**

Score formula: `CTR * 0.4 + CR * 0.4 + engagement * 0.2`

---

## 🔄 Reinforcement Loop

1. **Publish** 20 videos
2. **Track** performance for 48h
3. **Analyze** top 3 performers
4. **Evolve**: generate 10 mutations per top performer
5. **Repeat**

```bash
# After 48h with performance data
python vhs/scripts/content_engine.py --evolve --data data/performance.json --generate 30
```

---

## 📤 Export Formats

| Output | Format | Location |
|--------|--------|----------|
| Video configs | JSON | `vhs/output/*.json` |
| Manifest | JSON | `vhs/output/manifest.json` |
| Python render calls | Python | `vhs/output/auto_videos_config.py` |
| Landing mappings | JSON | `vhs/output/landings.json` |
| Series manifests | JSON | `vhs/output/series_*_manifest.json` |
| User data | JSON | `data/users.json` |

---

## ⚡ Production Pipeline

```
content_engine.py → auto_videos_config.py → vertical_engine.py → MP4
       ↓                                          ↓
  landings.json                            TikTok / IG / LinkedIn
       ↓
  Dynamic landing pages (frontend)
       ↓
  Tracking → performance.json
       ↓
  Reinforcement loop → new variants
```
