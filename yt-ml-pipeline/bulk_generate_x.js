/**
 * Bulk generate 50 videos for X (Twitter)
 * Optimized for X engagement - tech tips, quick wins, common issues
 */
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const PEXELS_API_KEY = "CRz8idxdBEns26tgsUsZxLjCdceRbXrH0TnS9sh4XR36BOkY3Zo5znA5";
const OUTPUT_DIR = path.join(__dirname, "published", "x-videos");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

// 50 topics for X - tech tips, common issues, quick wins
const VIDEO_TOPICS = [
  { title: "Linux_Top_10_Commands", query: "terminal code programming", hook: "Top 10 Linux Commands", color: "#00d4ff" },
  { title: "Windows_Shortcuts_Pro", query: "keyboard typing computer", hook: "Pro Windows Shortcuts", color: "#0078d4" },
  { title: "Docker_Quick_Start", query: "cloud server technology", hook: "Docker in 60 Seconds", color: "#2496ed" },
  { title: "Git_Reset_Hard", query: "developer workspace laptop", hook: "Git Reset Like a Pro", color: "#f05032" },
  { title: "SSH_Tunnel_Explained", query: "network security encryption", hook: "SSH Tunneling Magic", color: "#00d4aa" },
  { title: "Nginx_vs_Apache", query: "server hosting technology", hook: "Nginx vs Apache", color: "#009639" },
  { title: "Linux_File_System", query: "file folder directory", hook: "Linux File System 101", color: "#ff6b6b" },
  { title: "Cron_Jobs_Made_Easy", query: "automation schedule clock", hook: "Master Cron Jobs", color: "#10b981" },
  { title: "Docker_Compose_Basics", query: "docker container deployment", hook: "Docker Compose Basics", color: "#2496ed" },
  { title: "Linux_Perf_Tuning", query: "performance monitor speed", hook: "Linux Performance Tuning", color: "#f97316" },
  { title: "Network_Troubleshoot_101", query: "network diagnostic cable", hook: "Network Troubleshooting", color: "#ef4444" },
  { title: "Firewall_Rules_Basic", query: "firewall security protection", hook: "Firewall Rules 101", color: "#c084fc" },
  { title: "Linux_Sed_Awk_Tips", query: "text processing script", hook: "sed & awk Quick Tips", color: "#a855f7" },
  { title: "SSL_Cert_Quick_Fix", query: "ssl certificate https", hook: "SSL Cert Quick Fix", color: "#3b82f6" },
  { title: "Git_Rebase_vs_Merge", query: "git branch version control", hook: "Rebase vs Merge", color: "#f05032" },
  { title: "Linux_Grep_Mastery", query: "grep search terminal", hook: "Grep Mastery", color: "#58a6ff" },
  { title: "Systemd_Service_Create", query: "linux service daemon", hook: "Create Systemd Service", color: "#ef4444" },
  { title: "Docker_Volume_Backup", query: "docker volume storage", hook: "Docker Volume Backup", color: "#2496ed" },
  { title: "Linux_Package_Manager", query: "install software package", hook: "Package Managers 101", color: "#f59e0b" },
  { title: "Vim_Survival_Guide", query: "vim editor programming", hook: "Vim Survival Guide", color: "#019733" },
  { title: "Linux_Swap_Memory", query: "memory ram swap", hook: "Linux Swap & Memory", color: "#ec4899" },
  { title: "Apache_Virtual_Hosts", query: "apache server hosting", hook: "Apache Virtual Hosts", color: "#ff6b6b" },
  { title: "Linux_Log_Files", query: "log monitoring analytics", hook: "Essential Log Files", color: "#8b5cf6" },
  { title: "Docker_Networking_101", query: "docker network bridge", hook: "Docker Networking 101", color: "#2496ed" },
  { title: "Linux_Bash_Scripting", query: "bash script automation", hook: "Bash Scripting Basics", color: "#4eaa25" },
  { title: "Git_Hooks_Automation", query: "git hook automation", hook: "Git Hooks Automation", color: "#f05032" },
  { title: "Linux_DNS_Quick_Fix", query: "dns server network", hook: "DNS Quick Fix", color: "#a855f7" },
  { title: "Nginx_Rate_Limiting", query: "nginx rate limit server", hook: "Nginx Rate Limiting", color: "#009639" },
  { title: "Linux_User_Mgmt", query: "user account permission", hook: "Linux User Management", color: "#06b6d4" },
  { title: "Docker_Layer_Optimize", query: "docker layer build", hook: "Optimize Docker Layers", color: "#2496ed" },
  { title: "Linux_File_Perms", query: "file permission chmod", hook: "File Permissions Explained", color: "#a855f7" },
  { title: "Git_Stash_Tips", query: "git stash save", hook: "Git Stash Pro Tips", color: "#f05032" },
  { title: "Linux_Boot_Speed", query: "boot speed optimization", hook: "Speed Up Linux Boot", color: "#ef4444" },
  { title: "MySQL_Query_Optimize", query: "mysql query database", hook: "MySQL Query Optimization", color: "#00758f" },
  { title: "Linux_iptables_Basics", query: "iptables firewall linux", hook: "iptables Basics", color: "#c084fc" },
  { title: "Docker_Slim_Images", query: "docker slim minimal", hook: "Slim Docker Images", color: "#2496ed" },
  { title: "Nginx_Gzip_Compress", query: "nginx gzip compression", hook: "Nginx Gzip Compression", color: "#009639" },
  { title: "Linux_Screen_Tmux", query: "screen tmux terminal", hook: "screen & tmux Tips", color: "#58a6ff" },
  { title: "Git_Clean_History", query: "git clean history fix", hook: "Clean Git History", color: "#f05032" },
  { title: "Linux_Swap_Tuning", query: "swap memory tuning", hook: "Linux Swap Tuning", color: "#ec4899" },
  { title: "PostgreSQL_Quick_Start", query: "postgresql database server", hook: "PostgreSQL Quick Start", color: "#336791" },
  { title: "Linux_SSH_Hardening", query: "ssh security hardening", hook: "SSH Hardening Guide", color: "#00d4aa" },
  { title: "Docker_Multi_Stage", query: "docker multi stage build", hook: "Docker Multi-Stage Builds", color: "#2496ed" },
  { title: "Linux_Find_Command", query: "find search linux", hook: "Master the find Command", color: "#ff6b6b" },
  { title: "Nginx_Reverse_Proxy", query: "nginx reverse proxy", hook: "Nginx Reverse Proxy", color: "#009639" },
  { title: "Git_Worktree_Tips", query: "git worktree branch", hook: "Git Worktree Pro Tips", color: "#f05032" },
  { title: "Linux_Sysctl_Tuning", query: "sysctl kernel tuning", hook: "Linux sysctl Tuning", color: "#ef4444" },
  { title: "Redis_Caching_Basics", query: "redis cache database", hook: "Redis Caching 101", color: "#dc382d" },
  { title: "Linux_Process_Kill", query: "process kill terminate", hook: "Kill Processes Right", color: "#f97316" },
  { title: "Docker_Health_Check", query: "docker health check", hook: "Docker Health Checks", color: "#2496ed" }
];

function addOverlay(inputPath, outputPath, hook, color) {
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

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`🎬 Bulk generating ${VIDEO_TOPICS.length} videos for X\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < VIDEO_TOPICS.length; i++) {
    const topic = VIDEO_TOPICS[i];
    console.log(`\n[${i + 1}/${VIDEO_TOPICS.length}] ${topic.title}`);

    try {
      const videos = await searchPexels(topic.query);
      if (!videos.length) {
        console.log(`  ⚠️ No footage found, skipping`);
        failed++;
        continue;
      }

      const best = videos[0];
      const videoFile = best.video_files.find(f => f.quality === "hd") || best.video_files[0];
      const rawPath = path.join(OUTPUT_DIR, `_raw_${Date.now()}.mp4`);
      const finalPath = path.join(OUTPUT_DIR, `${topic.title}.mp4`);

      await downloadVideo(videoFile.link, rawPath);
      const size = (fs.statSync(rawPath).size / 1024 / 1024).toFixed(1);
      console.log(`  ✅ Downloaded: ${size} MB`);

      const ok = addOverlay(rawPath, finalPath, topic.hook, topic.color);
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
