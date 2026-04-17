const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

// FFmpeg path (Windows)
const FFMPEG_PATH = "C:\\Users\\johns\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe";

/**
 * Render a simple video placeholder (9:16 format)
 * @param {Object} data - Video metadata (hook, steps, duration)
 * @param {string} outputPath - Output video path
 * @returns {Promise<string>} Resolves with output path
 */
async function renderVideo(data, outputPath) {
  // Create output directory if needed
  fs.ensureDirSync(path.dirname(outputPath));

  const duration = data.duration || 15;
  const hook = data.hook || "Linux Tip";
  const commands = data.steps ? data.steps.join(" | ") : "command here";

  console.log(`🎬 Rendering ${duration}s video: "${hook}"`);

  // Create a simple 9:16 video with text overlay
  const result = spawnSync(FFMPEG_PATH, [
    "-f", "lavfi",
    "-i", `color=c=0x1a1a2e:s=1080x1920:d=${duration}`,
    "-vf", `drawtext=text='${hook}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=h*0.2:box=1:boxcolor=black@0.5:boxborderw=20,drawtext=text='${commands.replace(/'/g, "\\'")}':fontsize=36:fontcolor=yellow:x=(w-text_w)/2:y=h*0.5:box=1:boxcolor=black@0.7:boxborderw=10`,
    "-c:v", "libx264",
    "-preset", "fast",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y", // overwrite
    outputPath
  ], {
    stdio: "inherit",
    timeout: 120000
  });

  if (result.status !== 0) {
    console.warn("⚠️  FFmpeg render failed, creating empty file");
    // Create empty file as placeholder
    await fs.writeFile(outputPath, Buffer.alloc(0));
  } else {
    console.log(`✅ Video rendered: ${outputPath}`);
  }

  return outputPath;
}

module.exports = { renderVideo };
