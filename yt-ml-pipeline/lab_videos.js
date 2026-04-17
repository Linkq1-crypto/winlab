/**
 * Generate 10 lab-style horizontal videos using ASS subtitles for overlay
 * ASS subtitles handle special chars perfectly
 */
const axios = require("axios");
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const PEXELS_API_KEY = "CRz8idxdBEns26tgsUsZxLjCdceRbXrH0TnS9sh4XR36BOkY3Zo5znA5";
const OUTPUT_DIR = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

const VIDEOS = [
  { title:"SSH_Security_Setup", hook:"Lab: SSH Security Setup", sub:"Configure secure SSH access", cmds:["$ ssh-keygen -t ed25519","Generating public/private ed25519 key pair","Enter file in which to save the key: /home/user/.ssh/id_ed25519","Your identification has been saved in /home/user/.ssh/id_ed25519","$ chmod 600 ~/.ssh/id_ed25519","$ ssh-copy-id user@192.168.1.100","Number of key(s) added: 1","$ ssh user@192.168.1.100","Welcome to Ubuntu 22.04 LTS"], accent:"00d4aa", pexelsQuery:"coding computer screen" },
  { title:"Linux_Disk_Cleanup", hook:"Lab: Linux Disk Cleanup", sub:"Free up disk space on Linux", cmds:["$ df -h","Filesystem  Size  Used  Avail  Use%","/dev/sda1   100G   95G    5G   95%  /","$ du -sh /var/log","4.2G  /var/log","$ sudo journalctl --vacuum-size=500M","Vacuuming done, freed 3.1GB","$ sudo rm -rf /tmp/* /var/cache/*","Disk usage now: 62%"], accent:"58a6ff", pexelsQuery:"terminal code screen" },
  { title:"Docker_Best_Practices", hook:"Lab: Docker Optimization", sub:"Reclaim disk space in Docker", cmds:["$ docker system df","TYPE     TOTAL  ACTIVE  SIZE","Images   42     8       12.5GB","$ docker system prune -af","Total reclaimed space: 8.5GB","$ docker volume prune -f","Removed volumes: 14","$ docker ps --format 'table {{.Names}}'","web-server  database  redis-cache"], accent:"ffd700", pexelsQuery:"server room technology" },
  { title:"Nginx_Quick_Setup", hook:"Lab: Nginx Web Server", sub:"Install Nginx in 60 seconds", cmds:["$ sudo apt install nginx -y","nginx is already the newest version","$ sudo systemctl start nginx","$ sudo systemctl enable nginx","Created symlink nginx.service","$ curl -sI localhost | head -3","HTTP/1.1 200 OK","Server: nginx/1.24.0","Content-Type: text/html"], accent:"ff6b6b", pexelsQuery:"network data cable" },
  { title:"Firewall_Essentials", hook:"Lab: UFW Firewall Setup", sub:"Secure server with UFW firewall", cmds:["$ sudo ufw status","Status: inactive","$ sudo ufw default deny incoming","Default incoming policy changed to deny","$ sudo ufw allow 22/tcp","$ sudo ufw allow 80,443/tcp","$ sudo ufw enable","Firewall is active and enabled on system startup"], accent:"c084fc", pexelsQuery:"security lock digital" },
  { title:"Git_Branching_Tips", hook:"Lab: Git Workflow", sub:"Professional Git branching", cmds:["$ git checkout -b feature/auth-login","Switched to a new branch feature/auth-login","$ git add . && git commit -m Add login","3 files changed, 42 insertions(+)","$ git push -u origin feature/auth-login","Branch feature/auth-login set up to track origin","$ git checkout main && git merge feature/auth-login","Updating abc1234..def5678"], accent:"f97316", pexelsQuery:"developer workspace laptop" },
  { title:"Cron_Job_Automation", hook:"Lab: Cron Automation", sub:"Schedule automated tasks", cmds:["$ crontab -e","no crontab for user - using an empty one","# Add these lines:","0 3 * * * /opt/scripts/backup.sh","*/5 * * * * /opt/scripts/health-check.sh","$ crontab -l","0 3 * * * /opt/scripts/backup.sh","*/5 * * * * /opt/scripts/health-check.sh"], accent:"10b981", pexelsQuery:"automation robot tech" },
  { title:"SSL_Certificate_Setup", hook:"Lab: HTTPS with Lets Encrypt", sub:"Free SSL certificate with Certbot", cmds:["$ sudo certbot --nginx -d winlab.cloud","Successfully received certificate","Certificate saved at /etc/letsencrypt/live/","$ sudo certbot renew --dry-run","Congratulations, all simulated renewals succeeded","$ systemctl status certbot.timer","certbot.timer - Run certbot twice daily","Active: active (waiting)"], accent:"3b82f6", pexelsQuery:"secure website padlock" },
  { title:"Process_Monitoring", hook:"Lab: Process Monitoring", sub:"Monitor resource-hungry processes", cmds:["$ top -o %MEM","PID  USER   %MEM  COMMAND","1247 mysql  34.2  mysqld","$ ps aux | grep node | head -3","john  3421  12.3  node server.js","$ sudo kill -15 1247","mysqld stopped gracefully","$ sudo systemctl restart mysql","mysql.service - MySQL Community Server","Active: active (running)"], accent:"ef4444", pexelsQuery:"monitor dashboard analytics" },
  { title:"Linux_File_Permissions", hook:"Lab: File Permissions", sub:"Master chmod and chown", cmds:["$ ls -la /var/www/html","drwxr-xr-x www-data www-data 4096","$ sudo chown -R www-data:www-data /var/www","$ sudo find /var/www -type f -exec chmod 644 {} \\;","$ sudo find /var/www -type d -exec chmod 755 {} \\;","$ ls -la /var/www/html","drwxr-xr-x www-data www-data 4096","-rw-r--r-- www-data www-data 1234 index.html"], accent:"a855f7", pexelsQuery:"coding programming terminal" }
];

function makeASS(video, duration) {
  const sec = Math.floor(duration);
  const lines = video.cmds.map((c, i) => {
    const start = 1 + i * 1.2;
    return `Dialogue: 0,0:00:${start.toString().padStart(2,'0')}.00,0:00:${sec}.00,Default,,0,0,0,,{\\c&H${video.accent.slice(1).split('').reverse().join('')}&}${c}`;
  }).join('\n');
  
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Consolas,22,&H0000FF00,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,1,2,30,30,150,1
Style: Title,Arial,32,&H00${video.accent.slice(1)}&,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,7,20,20,20,1
Style: Subtitle,Arial,18,&H00AAAAAA,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,0,7,20,20,55,1
Style: Brand,Arial,16,&H00888888,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,680,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:${sec}.00,Title,,0,0,0,,${video.hook}
Dialogue: 0,0:00:00.00,0:00:${sec}.00,Subtitle,,0,0,0,,${video.sub}
Dialogue: 0,0:00:00.00,0:00:${sec}.00,Brand,,0,0,0,,WinLab.cloud - Free Linux Labs
${lines}`;
}

async function searchPexels(query) {
  console.log(`  Search: "${query}"`);
  const res = await axios.get("https://api.pexels.com/videos/search", {
    params: { query, per_page: 5, orientation: "landscape" },
    headers: { Authorization: PEXELS_API_KEY }
  });
  return res.data.videos;
}

async function downloadVideo(videoUrl, outputPath) {
  console.log(`  Downloading...`);
  const res = await axios({ url: videoUrl, method: "GET", responseType: "stream", timeout: 60000 });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function run() {
  await fs.ensureDir(OUTPUT_DIR);
  console.log(`\nCreating ${VIDEOS.length} lab-style videos\n`);

  let done = 0;
  for (const v of VIDEOS) {
    console.log(`\n[${done + 1}/${VIDEOS.length}] ${v.title}`);

    try {
      const vids = await searchPexels(v.pexelsQuery);
      if (!vids.length) { console.log("  No videos found"); continue; }

      const best = vids[0];
      const videoFile = best.video_files.find(f => f.quality === "hd") || best.video_files[0];
      const rawPath = path.join(OUTPUT_DIR, `_raw.mp4`);
      const assPath = path.join(OUTPUT_DIR, `_sub.ass`);
      const finalPath = path.join(OUTPUT_DIR, `${v.title}.mp4`);

      await downloadVideo(videoFile.link, rawPath);
      const info = await getVideoInfo(rawPath);
      console.log(`  Got: ${info.width}x${info.height}, ${info.duration}s`);

      // Create ASS subtitle
      fs.writeFileSync(assPath, makeASS(v, Math.min(info.duration, 15)));

      // Render with subtitles
      console.log(`  Rendering...`);
      const args = [
        "-i", rawPath,
        "-vf", `ass=${assPath.replace(/\\/g, '/')}`,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "copy",
        "-t", "15",
        "-movflags", "+faststart",
        "-y",
        finalPath
      ];
      const r = spawnSync(FFMPEG, args, { stdio: "inherit", timeout: 120000 });

      if (r.status === 0 && fs.existsSync(finalPath)) {
        const sz = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
        console.log(`  OK: ${sz} MB`);
        done++;
      } else {
        console.log("  Render failed");
      }

      await fs.remove(rawPath);
      await fs.remove(assPath);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log(`\nDone: ${done}/${VIDEOS.length} videos\n`);
}

async function getVideoInfo(filePath) {
  const { spawnSync } = require("child_process");
  const ffprobe = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe");
  const r = spawnSync(ffprobe, [
    "-v", "quiet", "-print_format", "json",
    "-show_format", "-show_streams", filePath
  ], { encoding: "utf-8" });
  const info = JSON.parse(r.stdout);
  return {
    width: info.streams[0].width,
    height: info.streams[0].height,
    duration: parseFloat(info.format.duration)
  };
}

run().catch(console.error);
