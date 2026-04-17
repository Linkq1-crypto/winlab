/**
 * Create 3 professional-looking tech videos with FFmpeg motion graphics
 * No stock footage needed - pure motion design
 */
const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const OUTPUT = path.join(__dirname, "published");
const FFMPEG = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

const VIDEOS = [
  {
    file: "Linux_Disk_Cleanup.mp4",
    title: "Linux Disk Cleanup",
    hook: "💾 Disk Full?",
    subtitle: "Fix in 60 seconds",
    commands: [
      "$ df -h",
      "Filesystem  Size  Used  Avail",
      "/dev/sda1   100G   98G   2G ⚠️",
      "",
      "$ du -sh /var/log",
      "4.2G  /var/log",
      "",
      "$ sudo rm -rf /tmp/*",
      "✅ Freed 12GB!"
    ],
    bg: "0x0a0a1a",
    accent: "#00ff88",
    hookY: "0.12"
  },
  {
    file: "SSH_Security_Setup.mp4",
    title: "SSH Security",
    hook: "🔒 Secure Your Server",
    subtitle: "5-minute setup",
    commands: [
      "$ ssh-keygen -t ed25519",
      "✅ Key generated",
      "",
      "$ chmod 600 ~/.ssh/id_ed25519",
      "✅ Permissions set",
      "",
      "$ sudo ufw allow 22/tcp",
      "✅ Firewall configured"
    ],
    bg: "0x0d1117",
    accent: "#58a6ff",
    hookY: "0.10"
  },
  {
    file: "Docker_Best_Practices.mp4",
    title: "Docker Tips",
    hook: "🐳 Docker Mistakes",
    subtitle: "Avoid these pitfalls",
    commands: [
      "$ docker system prune -af",
      "✅ Reclaimed 8.5GB",
      "",
      "$ docker volume prune",
      "✅ Removed 12 unused volumes",
      "",
      "$ docker image ls",
      "✅ Clean & optimized"
    ],
    bg: "0x1a1a2e",
    accent: "#ffd700",
    hookY: "0.12"
  }
];

function createFFmpegCommand(video, outputPath) {
  const duration = 15;
  const cmdLines = video.commands.join("\\\\n");
  
  return [
    "-f", "lavfi",
    "-i", `color=c=${video.bg}:s=1080x1920:d=${duration}`,
    "-vf", [
      // Animated gradient overlay (subtle)
      `geq='r=128+64*sin(2*PI*X/W+T*0.5):g=64+32*sin(2*PI*Y/H+T*0.3):b=64+32*cos(2*PI*(X+Y)/W+T*0.4)'`,
      // Hook text with background box
      `drawtext=text='${video.hook}':fontsize=88:fontcolor=${video.accent}:x=(w-text_w)/2:y=h*${video.hookY}:box=1:boxcolor=black@0.5:boxborderw=30`,
      // Subtitle
      `drawtext=text='${video.subtitle}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h*0.28:box=1:boxcolor=black@0.4:boxborderw=15`,
      // Terminal-style commands
      `drawtext=text='${cmdLines}':fontsize=36:fontcolor=${video.accent}:x=100:y=h*0.38:box=1:boxcolor=black@0.6:boxborderw=20`,
      // Bottom bar
      `drawtext=text='WinLab.cloud | Linux Tutorials':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=h*0.92:box=1:boxcolor=black@0.5:boxborderw=10`
    ].join(","),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y",
    outputPath
  ];
}

function run() {
  fs.ensureDirSync(OUTPUT);
  console.log("🎬 Creating 3 motion graphics videos\n");

  for (const video of VIDEOS) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`📝 ${video.title}`);
    console.log(`${"─".repeat(50)}`);

    const outputPath = path.join(OUTPUT, video.file);
    const args = createFFmpegCommand(video, outputPath);

    const result = spawnSync(FFMPEG, args, { stdio: "inherit", timeout: 180000 });

    if (result.status === 0) {
      const size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`✅ READY: ${video.file} (${size} MB)`);
    } else {
      console.log("❌ Failed");
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("🎉 DONE!");
}

run();
