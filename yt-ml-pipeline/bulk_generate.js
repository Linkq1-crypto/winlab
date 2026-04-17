/**
 * Bulk generate 20+ videos quickly - simple approach
 * Uses Pexels footage with minimal text overlay
 */
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const PEXELS_API_KEY = "CRz8idxdBEns26tgsUsZxLjCdceRbXrH0TnS9sh4XR36BOkY3Zo5znA5";
const OUTPUT_DIR = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

const VIDEO_TOPICS = [
  { title: "Apache_Web_Server", query: "apache server code", hook: "Apache Setup", color: "#ff6b6b" },
  { title: "MySQL_Database", query: "database server tech", hook: "MySQL Database", color: "#00d4ff" },
  { title: "Python_Scripting", query: "python programming code", hook: "Python Automation", color: "#ffd43b" },
  { title: "Git_Version_Control", query: "git version control", hook: "Git Basics", color: "#f97316" },
  { title: "DNS_Configuration", query: "network dns server", hook: "DNS Setup", color: "#a855f7" },
  { title: "Load_Balancing", query: "load balancer network", hook: "Load Balancer", color: "#10b981" },
  { title: "Backup_Strategies", query: "backup storage data", hook: "Backup Plans", color: "#3b82f6" },
  { title: "Systemd_Services", query: "linux systemd service", hook: "Systemd", color: "#ef4444" },
  { title: "Log_Monitoring", query: "logs monitoring analytics", hook: "Log Analysis", color: "#8b5cf6" },
  { title: "User_Permissions", query: "user access security", hook: "User Management", color: "#06b6d4" },
  { title: "Package_Management", query: "software install package", hook: "Package Manager", color: "#f59e0b" },
  { title: "Network_Troubleshooting", query: "network ping diagnostic", hook: "Network Tools", color: "#ec4899" },
  { title: "Environment_Variables", query: "environment config setup", hook: "Env Variables", color: "#14b8a6" },
  { title: "Cron_Scheduling", query: "cron schedule automation", hook: "Cron Jobs", color: "#6366f1" },
  { title: "Disk_Partitioning", query: "disk partition storage", hook: "Disk Management", color: "#84cc16" },
  { title: "SSH_Keys", query: "ssh key encryption", hook: "SSH Keys", color: "#22c55e" },
  { title: "Firewall_Rules", query: "firewall security network", hook: "Firewall Config", color: "#f43f5e" },
  { title: "Docker_Containers", query: "docker container cloud", hook: "Docker Basics", color: "#0ea5e9" },
  { title: "Nginx_Proxy", query: "nginx proxy server", hook: "Nginx Proxy", color: "#d946ef" },
  { title: "SSL_TLS", query: "ssl certificate https", hook: "SSL Certs", color: "#06b6d4" }
];

async function searchPexels(query) {
  try {
    const res = await axios.get("https://api.pexels.com/videos/search", {
      params: { query, per_page: 3, orientation: "landscape" },
      headers: { Authorization: PEXELS_API_KEY }
    });
    return res.data.videos;
  } catch (err) {
    console.error(`❌ Pexels API error: ${err.message}`);
    return [];
  }
}

async function downloadVideo(videoUrl, outputPath) {
  const res = await axios({
    url: videoUrl,
    method: "GET",
    responseType: "stream",
    timeout: 60000
  });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

function addSimpleOverlay(inputPath, outputPath, hook, color) {
  // Very simple overlay - just title and branding
  const vf = [
    `drawbox=x=0:y=0:w=iw:h=80:color=black@0.7:t=fill`,
    `drawtext=text='${hook}':fontsize=48:fontcolor=${color}:x=30:y=15`,
    `drawbox=x=0:y=h-40:w=iw:h=40:color=black@0.6:t=fill`,
    `drawtext=text='WinLab.cloud':fontsize=24:fontcolor=#999999:x=(w-text_w)/2:y=h-35`
  ].join(",");

  const args = [
    "-i", inputPath,
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "copy",
    "-t", "15",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ];

  const result = spawnSync(FFMPEG, args, { stdio: "pipe", timeout: 120000 });
  return result.status === 0;
}

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`🎬 Bulk generating ${VIDEO_TOPICS.length} videos\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < VIDEO_TOPICS.length; i++) {
    const topic = VIDEO_TOPICS[i];
    console.log(`\n[${i + 1}/${VIDEO_TOPICS.length}] ${topic.title}`);

    try {
      // Search Pexels
      const videos = await searchPexels(topic.query);
      if (!videos.length) {
        console.log(`  ⚠️ No footage found, skipping`);
        failed++;
        continue;
      }

      // Download best video
      const best = videos[0];
      const videoFile = best.video_files.find(f => f.quality === "hd") || best.video_files[0];
      const rawPath = path.join(OUTPUT_DIR, `_raw_${Date.now()}.mp4`);
      const finalPath = path.join(OUTPUT_DIR, `${topic.title}.mp4`);

      await downloadVideo(videoFile.link, rawPath);
      const size = (fs.statSync(rawPath).size / 1024 / 1024).toFixed(1);
      console.log(`  ✅ Downloaded: ${size} MB`);

      // Add simple overlay
      const ok = addSimpleOverlay(rawPath, finalPath, topic.hook, topic.color);
      await fs.remove(rawPath);

      if (ok && fs.existsSync(finalPath)) {
        const finalSize = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ READY: ${topic.title} (${finalSize} MB)`);
        success++;
      } else {
        console.log(`  ⚠️ Overlay failed`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`🎉 DONE! ${success} successful, ${failed} failed`);
  console.log(`📁 Check: ${OUTPUT_DIR}`);
}

run().catch(console.error);
