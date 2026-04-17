/**
 * Create 3 clean tech videos - simple backgrounds + text (fast rendering)
 */
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const OUTPUT = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

const VIDEOS = [
  {
    file: "Linux_Disk_Cleanup.mp4",
    hook: "Disk Full? Fix in 60s",
    lines: ["$ df -h", "/dev/sda1  100G  98G  2G", "", "$ du -sh /var/log", "4.2G  /var/log", "", "$ rm -rf /tmp/*", "Freed 12GB!"],
    bg: "0x0a1628",
    accent: "#00d4aa"
  },
  {
    file: "SSH_Security.mp4",
    hook: "Secure Your Server",
    lines: ["$ ssh-keygen -t ed25519", "Key generated.", "", "$ chmod 600 ~/.ssh/*", "Permissions set.", "", "$ ufw allow 22", "Firewall ready."],
    bg: "0x0d1117",
    accent: "#58a6ff"
  },
  {
    file: "Docker_Tips.mp4",
    hook: "Docker Mistakes",
    lines: ["$ docker system prune -af", "Reclaimed 8.5GB", "", "$ docker volume prune", "Removed 12 volumes", "", "$ docker ps", "Clean & fast."],
    bg: "0x16161e",
    accent: "#ffaa00"
  }
];

function render(video) {
  const output = path.join(OUTPUT, video.file);
  const duration = 15;
  
  // Build multi-line text with drawtext using newlines
  const bodyText = video.lines.join("\\n");
  
  const vf = [
    `drawtext=text='${video.hook}':fontsize=76:fontcolor=${video.accent}:x=(w-text_w)/2:y=h*0.12:box=1:boxcolor=black@0.5:boxborderw=25`,
    `drawtext=text='${bodyText}':fontsize=40:fontcolor=white:x=80:y=h*0.32:box=1:boxcolor=black@0.4:boxborderw=15:line_spacing=12`,
    `drawtext=text='WinLab.cloud':fontsize=36:fontcolor=#888888:x=(w-text_w)/2:y=h*0.92:box=1:boxcolor=black@0.3:boxborderw=10`
  ].join(",");

  const args = [
    "-f", "lavfi",
    "-i", `color=c=${video.bg}:s=1080x1920:d=${duration}`,
    "-vf", vf,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-t", duration.toString(),
    "-movflags", "+faststart",
    "-y",
    output
  ];

  console.log(`\n${"─".repeat(50)}`);
  console.log(`📝 ${video.file}`);
  console.log(`${"─".repeat(50)}`);

  const result = spawnSync(FFMPEG, args, { stdio: "inherit", timeout: 120000 });

  if (result.status === 0 && fs.existsSync(output)) {
    const size = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
    console.log(`✅ ${video.file} (${size} MB)`);
    return true;
  }
  console.log("❌ Failed");
  return false;
}

fs.ensureDirSync(OUTPUT);
console.log("🎬 3 clean tech videos\n");

let count = 0;
for (const v of VIDEOS) {
  if (render(v)) count++;
}

console.log(`\n✅ ${count}/3 done in ${OUTPUT}`);
