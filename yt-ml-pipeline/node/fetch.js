const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

const OUT = path.join(__dirname, "../dataset");

// YouTube PLAYLISTS and VIDEO URLs for direct download
const PLAYLIST_URLS = [
  // New additions
  "https://www.youtube.com/watch?v=wdJHmsX2YLk&list=PLcRhfKiWZmM88WLTuIosdZegKpyc3zpvm",
  "https://www.youtube.com/watch?v=nXTD-obgCFc",
  "https://www.youtube.com/watch?v=tK9Oc6AEnR4",
  "https://www.youtube.com/watch?v=fEStWuSJ504",
  "https://www.youtube.com/watch?v=wvvWnQSSo3w",
  // From scratch to hero Linux Redhat USA
  "https://www.youtube.com/watch?v=5UF37H3fwEY",
  // Linux playlist
  "https://www.youtube.com/watch?v=tkL9rnleSNs&list=PLeqch-0_f39GwqkTVoCqIqPAH1paMHUj5",
  // Single video
  "https://www.youtube.com/watch?v=tEI52ho411A",
  // Additional search queries for more content
  ...[
    "linux tutorial hindi",
    "ubuntu server setup hindi",
    "docker tutorial hindi",
    "kubernetes explained hindi",
    "aws cloud tutorial hindi",
    "devops tools hindi",
    "vmware vsphere tutorial hindi",
    "linux networking hindi",
    "linux security tutorial hindi",
    "bash scripting hindi",
    "python for devops hindi",
    "jenkins ci cd hindi",
    "ansible automation hindi",
    "terraform hindi tutorial",
    "nginx configuration hindi",
    "apache web server hindi",
    "mysql database linux hindi",
    "postgresql setup hindi",
    "mongodb installation hindi",
    "docker compose microservices hindi",
    "kubernetes production deployment hindi",
    "prometheus monitoring hindi",
    "grafana dashboard tutorial hindi",
    "git github tutorial hindi",
    "linux commands for beginners hindi",
    "centos server setup hindi",
    "linux troubleshooting hindi",
    "linux system administration hindi",
    "cloud computing basics hindi",
    "it infrastructure management india"
  ].map(q => `ytsearch5:${q}`)
];

const MAX_VIDEOS_PER_QUERY = 5;
const MAX_TOTAL_VIDEOS = 300;

// yt-dlp path (Windows)
const YTDLP = "C:\\Users\\johns\\AppData\\Roaming\\Python\\Python311\\Scripts\\yt-dlp.exe";

async function downloadVideo(url, label) {
  console.log(`\n📥 Downloading: ${label || url}`);

  // Check if URL is a playlist
  const isPlaylist = url.includes("list=");
  const isSearch = url.startsWith("ytsearch");
  const isSingleVideo = url.includes("watch?v=");

  // Build yt-dlp command
  const args = [
    url,
    "--format", "best[filesize<100M]/18/best", // Max 100MB per video
    "--output", path.join(OUT, "%(id)s.%(ext)s"),
    "--no-overwrites",
    "--restrict-filenames",
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "--socket-timeout", "30",
    "--retries", "3",
    "--no-check-certificates",
    "--abort-on-unavailable-fragment",
  ];

  // For playlists, limit to 20 videos per playlist
  if (isPlaylist) {
    args.push("--playlist-items", "1:20"); // First 20 videos
    console.log(`  📋 Playlist detected - downloading up to 20 videos`);
  }

  const result = spawnSync(YTDLP, args, {
    stdio: "inherit",
    timeout: 600000 // 10 min timeout per playlist
  });

  return result.status === 0;
}

async function run() {
  await fs.ensureDir(OUT);

  console.log("🎬 YouTube Video Downloader (Playlists + Search)");
  console.log(`📁 Output: ${OUT}`);
  console.log(`🎯 Target: ${MAX_TOTAL_VIDEOS} videos`);

  let downloaded = 0;
  const startCount = (await fs.readdir(OUT)).filter(f => f.endsWith(".mp4")).length;

  for (const url of PLAYLIST_URLS) {
    const currentCount = (await fs.readdir(OUT)).filter(f => f.endsWith(".mp4")).length;
    if (currentCount - startCount >= MAX_TOTAL_VIDEOS) {
      console.log(`\n🎯 Target reached! (${currentCount - startCount} new videos)`);
      break;
    }

    const label = url.startsWith("ytsearch") ? url.replace("ytsearch5:", "🔍 ") : `📺 ${url.split("v=")[1]?.split("&")[0] || "video"}`;
    await downloadVideo(url, label);

    // Small delay between downloads
    await new Promise(r => setTimeout(r, 2000));
  }

  // Count actual files
  const files = await fs.readdir(OUT);
  const mp4s = files.filter(f => f.endsWith(".mp4"));
  const newVideos = mp4s.length - startCount;
  
  console.log(`\n🔥 Done! ${mp4s.length} total videos (${newVideos} new)`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
