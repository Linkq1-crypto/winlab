# 🎬 WinLab Video Generator - WORKING ✅

## ✅ Generated Videos

| File | Format | Use |
|------|--------|-----|
| `vhs/output/hero_launch.mp4` | 1280x720 (16:9) | YouTube |
| `vhs/output/hero_launch_vertical.mp4` | 1080x1920 (9:16) | Instagram/LinkedIn |
| `vhs/output/hero_thumb.jpg` | 1280x720 | Thumbnail |

## 🚀 How It Was Generated (Windows PowerShell)

### Step 1: Generate Hero Video

```powershell
cd C:\Users\johns\Desktop\winw\lab
powershell -ExecutionPolicy Bypass -File vhs\scripts\generate_hero.ps1
```

### Step 2: Generate Vertical Version

```powershell
ffmpeg -i vhs\output\hero_launch.mp4 `
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" `
  -c:v libx264 -preset fast -crf 23 `
  vhs\output\hero_launch_vertical.mp4
```

### Step 3: Generate Thumbnail

```powershell
ffmpeg -i vhs\output\hero_launch.mp4 `
  -vf "thumbnail,scale=1280:720" `
  -frames:v 1 -q:v 2 `
  vhs\output\hero_thumb.jpg
```

## 📹 Video Structure (25 seconds)

| Time | Visual | Text Overlay |
|------|--------|--------------|
| **0-3s** | Terminal window appears | "Same skills. Different outcome." |
| **3-8s** | Error: Connection refused | "Connection dropped." |
| **8-12s** | systemctl status (inactive) | "Because of a SIM card." |
| **12-20s** | Commands fix the issue | "Works on GSM/Offline/Anywhere" |
| **20-25s** | Success + CTA | "Same lab. Same chance. WinLab.cloud" |

## 📝 Upload to YouTube

**Title:**
```
Fix a Broken Server in 15 Seconds | WinLab
```

**Description:**
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

## 📝 Upload to LinkedIn

**Caption:**
```
Same skills. Different outcome.

A junior engineer in Bangalore lost his internet connection 
because of a SIM card.

But he could still complete his Linux lab.

WinLab works on:
✓ 2G connections
✓ Offline mode
✓ Any device, any browser

Because talent is universal. Access shouldn't be the barrier.

Try it free → winlab.cloud

#TechEducation #Linux #DevOps #Cloud #InclusiveTech #WinLab
```

## 🔧 Edit the Video

To change text/timing, edit: `vhs/scripts/hero_filter.txt`

Then regenerate:
```powershell
powershell -ExecutionPolicy Bypass -File vhs\scripts\generate_hero.ps1
```

## 📊 Next Steps

1. ✅ Video generated
2. 🎙️ Add voiceover (optional):
   - Record with Audacity/ElevenLabs
   - Merge: `ffmpeg -i hero_launch.mp4 -i voice.mp3 -c copy final.mp4`
3. 🎵 Add music (optional):
   - Download ambient track
   - Merge with voice: `ffmpeg -i final.mp4 -i music.mp3 -filter_complex "[0:a]volume=1[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2" -c:v copy complete.mp4`
4. 📤 Upload to YouTube + LinkedIn
5. 📊 Track metrics after 48 hours

## 🐛 Troubleshooting

**Fontconfig error: Cannot load default config file**
- This is normal on Windows - fonts still render with fallback (Arial/Consolas)
- Video is generated correctly despite these warnings

**Video too dark?**
- Add brightness filter: `-vf "eq=brightness=0.05:contrast=1.1"`

**Text too small?**
- Increase `fontsize` values in `hero_filter.txt`

**Want different scenarios?**
- Copy `hero_filter.txt` → `scenario2.txt`
- Edit text/timing
- Run: `ffmpeg -y -f lavfi -i "color=c=0x0a0a0a:s=1280x720:d=25" -filter_complex (Get-Content scenario2.txt -Raw) -c:v libx264 -pix_fmt yuv420p -t 25 vhs\output\scenario2.mp4`
