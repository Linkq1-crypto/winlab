/**
 * Generate 3 tutorial videos using Pexels stock footage
 * Downloads HD vertical videos and adds text overlay with FFmpeg
 */
const axios = require("axios");
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const PEXELS_API_KEY = "CRz8idxdBEns26tgsUsZxLjCdceRbXrH0TnS9sh4XR36BOkY3Zo5znA5";
const OUTPUT_DIR = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

const VIDEO_CONCEPTS = [
  {
    title: "SSH_Security_Setup",
    hook: "Lab: SSH Security Setup",
    subtitle: "Configure secure SSH access to your server",
    commands: [
      "$ ssh-keygen -t ed25519 -C 'admin@winlab'",
      "Generating public/private ed25519 key pair...",
      "Enter file: /home/user/.ssh/id_ed25519",
      "",
      "$ chmod 600 ~/.ssh/id_ed25519",
      "$ sudo ufw allow 22/tcp",
      "Rule added successfully",
      "",
      "$ ssh -i ~/.ssh/id_ed25519 user@192.168.1.100",
      "Connection established ✓"
    ],
    pexelsQuery: "coding computer screen",
    labColor: "#00d4aa"
  },
  {
    title: "Linux_Disk_Cleanup",
    hook: "Lab: Linux Disk Cleanup",
    subtitle: "Free up disk space on your Linux server",
    commands: [
      "$ df -h",
      "Filesystem   Size  Used  Avail  Use%",
      "/dev/sda1    100G   95G    5G   95% ⚠️",
      "",
      "$ du -sh /var/log",
      "4.2G  /var/log",
      "",
      "$ sudo journalctl --vacuum-size=500M",
      "Freed 3.1GB ✓",
      "",
      "$ sudo rm -rf /tmp/* /var/tmp/*",
      "Cleaned! New usage: 62%"
    ],
    pexelsQuery: "terminal code screen",
    labColor: "#58a6ff"
  },
  {
    title: "Docker_Best_Practices",
    hook: "Lab: Docker Optimization",
    subtitle: "Clean up Docker and reclaim disk space",
    commands: [
      "$ docker system df",
      "TYPE    TOTAL  ACTIVE  SIZE",
      "Images  42     8       12.5GB",
      "",
      "$ docker system prune -af",
      "Deleted: 8.5GB ✓",
      "",
      "$ docker volume prune -f",
      "Removed 14 unused volumes ✓",
      "",
      "$ docker ps --format 'table {{.Names}}'",
      "Running 3 containers"
    ],
    pexelsQuery: "server room technology",
    labColor: "#ffd700"
  },
  {
    title: "Nginx_Quick_Setup",
    hook: "Lab: Nginx Web Server",
    subtitle: "Install and configure Nginx in 60 seconds",
    commands: [
      "$ sudo apt update && sudo apt install nginx",
      "nginx installed ✓",
      "",
      "$ sudo systemctl start nginx",
      "$ sudo systemctl enable nginx",
      "Service running ✓",
      "",
      "$ curl -I localhost",
      "HTTP/1.1 200 OK ✓",
      "Server: nginx/1.24.0"
    ],
    pexelsQuery: "network data cable",
    labColor: "#ff6b6b"
  },
  {
    title: "Firewall_Essentials",
    hook: "Lab: UFW Firewall Setup",
    subtitle: "Secure your server with UFW firewall",
    commands: [
      "$ sudo ufw status",
      "Status: inactive ⚠️",
      "",
      "$ sudo ufw allow 22/tcp",
      "$ sudo ufw allow 80,443/tcp",
      "",
      "$ sudo ufw enable",
      "Firewall active ✓",
      "",
      "$ sudo ufw status numbered",
      "22/tcp  ALLOW  80,443/tcp"
    ],
    pexelsQuery: "security lock digital",
    labColor: "#c084fc"
  },
  {
    title: "Git_Branching_Tips",
    hook: "Lab: Git Workflow",
    subtitle: "Professional Git branching strategy",
    commands: [
      "$ git checkout -b feature/auth-login",
      "Switched to branch 'feature/auth-login'",
      "",
      "$ git add . && git commit -m 'Add login page'",
      "3 files changed, 42 insertions ✓",
      "",
      "$ git push origin feature/auth-login",
      "Branch pushed to remote ✓",
      "$ git checkout main && git merge feature/auth-login"
    ],
    pexelsQuery: "developer workspace laptop",
    labColor: "#f97316"
  },
  {
    title: "Cron_Job_Automation",
    hook: "Lab: Cron Automation",
    subtitle: "Schedule automated tasks with cron",
    commands: [
      "$ crontab -e",
      "# Add backup job (daily at 3 AM)",
      "0 3 * * * /opt/scripts/backup.sh",
      "",
      "$ crontab -l",
      "0 3 * * * /opt/scripts/backup.sh ✓",
      "",
      "$ tail -f /var/log/syslog | grep CRON",
      "Backup completed at 03:00:01 ✓"
    ],
    pexelsQuery: "automation robot tech",
    labColor: "#10b981"
  },
  {
    title: "SSL_Certificate_Setup",
    hook: "Lab: HTTPS with Let's Encrypt",
    subtitle: "Install free SSL certificate with Certbot",
    commands: [
      "$ sudo certbot --nginx -d winlab.cloud",
      "Certificate issued ✓",
      "",
      "$ sudo certbot renew --dry-run",
      "Renewal simulation succeeded ✓",
      "",
      "$ curl -I https://winlab.cloud",
      "HTTP/2 200",
      "strict-transport-security: max-age=31536000 ✓"
    ],
    pexelsQuery: "secure website padlock",
    labColor: "#3b82f6"
  },
  {
    title: "Process_Monitoring",
    hook: "Lab: Process Monitoring",
    subtitle: "Monitor and kill resource-hungry processes",
    commands: [
      "$ top -o %MEM",
      "PID   USER  %MEM  COMMAND",
      "1247  mysql  34%  mysqld",
      "",
      "$ ps aux | grep node | head -3",
      "node process found ✓",
      "",
      "$ sudo kill -15 1247",
      "Process terminated gracefully ✓"
    ],
    pexelsQuery: "monitor dashboard analytics",
    labColor: "#ef4444"
  },
  {
    title: "Linux_File_Permissions",
    hook: "Lab: File Permissions",
    subtitle: "Master chmod, chown and file access",
    commands: [
      "$ ls -la /var/www/html",
      "drwxr-xr-x  www-data  www-data  4096",
      "",
      "$ sudo chown -R www-data:www-data /var/www",
      "Ownership updated ✓",
      "",
      "$ sudo chmod 755 -R /var/www",
      "$ sudo chmod 644 /var/www/*.php",
      "Permissions fixed ✓"
    ],
    pexelsQuery: "coding programming terminal",
    labColor: "#a855f7"
  }
];

async function searchPexels(query) {
  console.log(`🔍 Searching Pexels: "${query}"`);
  const res = await axios.get("https://api.pexels.com/videos/search", {
    params: { query, per_page: 5, orientation: "landscape" },
    headers: { Authorization: PEXELS_API_KEY }
  });
  return res.data.videos;
}

async function downloadVideo(videoUrl, outputPath) {
  console.log(`📥 Downloading...`);
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

async function addTextOverlay(inputPath, outputPath, concept) {
  console.log(`🎬 Adding overlay...`);

  const hook = concept.hook;
  const subtitle = concept.subtitle || "";
  const accent = concept.labColor || "#00d4aa";

  // Simplified text overlay - avoid complex escaping
  const vf = [
    // Top bar - dark translucent background
    `drawbox=x=0:y=0:w=iw:h=120:color=black@0.7:t=fill`,
    // Lab title (escape colons and quotes)
    `drawtext=text='${hook.replace(/:/g, "").replace(/'/g, "")}':fontsize=42:fontcolor=${accent}:x=40:y=20`,
    // Subtitle
    `drawtext=text='${subtitle.replace(/:/g, "").replace(/'/g, "")}':fontsize=24:fontcolor=#cccccc:x=40:y=72`,
    // Bottom bar - dark translucent background
    `drawbox=x=0:y=h-40:w=iw:h=40:color=black@0.6:t=fill`,
    // WinLab.cloud branding
    `drawtext=text='WinLab.cloud - Free Linux Labs':fontsize=22:fontcolor=#999999:x=(w-text_w)/2:y=h-35`
  ].join(",");
  
  const cmd = [
    "-i", inputPath,
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "copy",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ];
  const result = spawnSync(FFMPEG, cmd, { stdio: "inherit", timeout: 120000 });
  return result.status === 0;
}

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`🎬 Creating ${VIDEO_CONCEPTS.length} lab videos from Pexels\n`);

  for (const concept of VIDEO_CONCEPTS) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`📝 ${concept.title}`);
    console.log(`${"=".repeat(50)}`);

    try {
      const videos = await searchPexels(concept.pexelsQuery);
      if (!videos.length) { console.log("❌ No videos found"); continue; }

      const best = videos[0];
      const videoFile = best.video_files.find(f => f.quality === "hd") || best.video_files[0];
      const rawPath = path.join(OUTPUT_DIR, `raw_${Date.now()}.mp4`);
      const finalPath = path.join(OUTPUT_DIR, `${concept.title}.mp4`);

      await downloadVideo(videoFile.link, rawPath);
      console.log(`✅ Downloaded: ${(fs.statSync(rawPath).size / 1024 / 1024).toFixed(1)} MB`);

      await addTextOverlay(rawPath, finalPath, concept);
      console.log(`✅ Video ready: ${finalPath}`);

      await fs.remove(rawPath);
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }

  console.log("\n🎉 Done! Check the published/ folder");
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { VIDEO_CONCEPTS };
