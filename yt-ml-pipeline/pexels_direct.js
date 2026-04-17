/**
 * Download 3 vertical tech videos from Pexels (no API key needed)
 * Then add text overlay with FFmpeg
 */
const { spawnSync } = require("child_process");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";
const CURL = "curl";

const VIDEOS = [
  {
    title: "Linux_Disk_Cleanup",
    hook: "Disk full? Fix in 60s",
    commands: "df -h && du -sh * && rm -rf /tmp/*",
    // Pexels video ID: 3191556 (coding/typing)
    url: "https://videos.pexels.com/video-files/3191556/3191556-hd_1080_1920_25fps.mp4"
  },
  {
    title: "SSH_Security_Setup",
    hook: "Secure your server NOW",
    commands: "ssh-keygen && chmod 600 ~/.ssh/* && ufw allow 22",
    // Pexels video ID: 8317666 (server room)
    url: "https://videos.pexels.com/video-files/8317666/8317666-hd_1080_1920_30fps.mp4"
  },
  {
    title: "Docker_Best_Practices",
    hook: "Docker mistakes to avoid",
    commands: "docker system prune -af && docker volume prune",
    // Pexels video ID: 5476969 (tech abstract)
    url: "https://videos.pexels.com/video-files/5476969/5476969-hd_1080_1920_25fps.mp4"
  }
];

async function downloadWithCurl(url, outputPath) {
  console.log(`📥 Downloading...`);
  execSync(`"${CURL}" -L --output "${outputPath}" "${url}"`, { stdio: "inherit" });
  return fs.existsSync(outputPath);
}

async function addOverlay(inputPath, outputPath, hook, commands) {
  console.log(`🎬 Rendering...`);
  const hookEscaped = hook.replace(/'/g, "\\'").replace(/:/g, "");
  const cmdsEscaped = commands.replace(/'/g, "\\'").replace(/&/g, "").replace(/:/g, "");

  const args = [
    "-i", inputPath,
    "-vf", `drawtext=text='${hookEscaped}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=h*0.12:box=1:boxcolor=black@0.7:boxborderw=25,drawtext=text='${cmdsEscaped}':fontsize=44:fontcolor=#00ff88:x=(w-text_w)/2:y=h*0.75:box=1:boxcolor=black@0.8:boxborderw=15`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "22",
    "-c:a", "copy",
    "-t", "15",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ];

  const result = spawnSync(FFMPEG, args, { stdio: "inherit", timeout: 120000 });
  return result.status === 0;
}

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log("🎬 Creating 3 Pexels videos\n");

  for (const v of VIDEOS) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`📝 ${v.title}`);
    console.log(`${"─".repeat(50)}`);

    const rawPath = path.join(OUTPUT_DIR, `_raw_${v.title}.mp4`);
    const finalPath = path.join(OUTPUT_DIR, `${v.title}.mp4`);

    try {
      const ok = await downloadWithCurl(v.url, rawPath);
      if (!ok) { console.log("❌ Download failed"); continue; }

      const size = (fs.statSync(rawPath).size / 1024 / 1024).toFixed(1);
      console.log(`✅ Downloaded: ${size} MB`);

      const rendered = await addOverlay(rawPath, finalPath, v.hook, v.commands);
      if (rendered) {
        const finalSize = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
        console.log(`✅ READY: ${finalPath} (${finalSize} MB)`);
      } else {
        console.log("⚠️ Render failed, keeping raw video");
      }

      await fs.remove(rawPath);
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("🎉 DONE! Check published/ folder");
}

run().catch(console.error);
