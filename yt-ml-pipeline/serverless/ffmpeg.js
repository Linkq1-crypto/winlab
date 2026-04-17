/**
 * Serverless FFmpeg Handler
 * Uses @ffmpeg/ffmpeg (WASM) for Cloudflare Workers / AWS Lambda
 * Or static binary for Lambda Layer
 */

const { execFile } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

// Configuration
const FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static");
const IS_SERVERLESS = process.env.SERVERLESS === "true";

/**
 * Extract frames from video for scoring
 * Serverless-optimized: uses /tmp, cleans up after
 * @param {string} videoPath - Path to video
 * @param {string} outputDir - Output directory for frames
 * @param {number} numFrames - Number of frames to extract
 * @returns {Promise<string[]>} Paths to extracted frames
 */
async function extractFrames(videoPath, outputDir, numFrames = 3) {
  console.log(`📸 Extracting ${numFrames} frames...`);

  await fs.ensureDir(outputDir);

  // Calculate frame intervals
  const frameNumbers = [];
  for (let i = 0; i < numFrames; i++) {
    frameNumbers.push(Math.floor(i * 24 * 5)); // Every 5 seconds at 24fps
  }

  const selectFilter = frameNumbers
    .map((n, i) => `eq(n\\,${n})`)
    .join("+");

  return new Promise((resolve, reject) => {
    const args = [
      "-i", videoPath,
      "-vf", `select=${selectFilter}`,
      "-frames:v", String(numFrames),
      `${outputDir}/frame_%03d.jpg`
    ];

    execFile(FFMPEG_PATH, args, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ FFmpeg error:", stderr);
        return reject(err);
      }

      // Get frame paths
      const frames = [];
      for (let i = 0; i < numFrames; i++) {
        const framePath = path.join(outputDir, `frame_${String(i + 1).padStart(3, "0")}.jpg`);
        if (fs.existsSync(framePath)) {
          frames.push(framePath);
        }
      }

      console.log(`✅ Extracted ${frames.length} frames`);
      resolve(frames);
    });
  });
}

/**
 * Concatenate multiple video clips
 * Serverless-optimized for joining AI-generated clips
 */
async function concatenateVideos(inputPaths, outputPath) {
  console.log(`🎬 Concatenating ${inputPaths.length} clips...`);

  // Create concat file
  const concatFile = "/tmp/concat_list.txt";
  const content = inputPaths.map(p => `file '${p}'`).join("\n");
  await fs.writeFile(concatFile, content);

  return new Promise((resolve, reject) => {
    const args = [
      "-f", "concat",
      "-safe", "0",
      "-i", concatFile,
      "-c", "copy",
      "-movflags", "+faststart",
      outputPath
    ];

    execFile(FFMPEG_PATH, args, { timeout: 120000 }, async (err) => {
      // Cleanup
      await fs.remove(concatFile);

      if (err) {
        console.error("❌ Concat failed:", err.message);
        return reject(err);
      }

      console.log(`✅ Concatenated: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

/**
 * Add audio track to video
 */
async function addAudioToVideo(videoPath, audioPath, outputPath) {
  console.log("🎵 Adding audio to video...");

  return new Promise((resolve, reject) => {
    const args = [
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      "-movflags", "+faststart",
      outputPath
    ];

    execFile(FFMPEG_PATH, args, { timeout: 120000 }, (err) => {
      if (err) {
        console.error("❌ Audio add failed:", err.message);
        return reject(err);
      }

      console.log(`✅ Audio added: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

/**
 * Get video metadata
 */
async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration,bit_rate",
      "-of", "json",
      videoPath
    ];

    execFile(FFMPEG_PATH, ["-i", videoPath, ...args], { timeout: 30000 }, (err, stdout) => {
      if (err) {
        return reject(err);
      }

      try {
        const metadata = JSON.parse(stdout);
        resolve(metadata);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Clean up serverless temp files
 * Critical for avoiding storage limits
 */
async function cleanup(paths) {
  console.log("🧹 Cleaning up temp files...");
  
  for (const p of paths) {
    try {
      await fs.remove(p);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  
  console.log("✅ Cleanup complete");
}

module.exports = {
  extractFrames,
  concatenateVideos,
  addAudioToVideo,
  getVideoMetadata,
  cleanup
};
