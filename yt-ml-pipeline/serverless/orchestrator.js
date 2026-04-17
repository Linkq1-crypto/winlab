/**
 * Serverless Orchestrator - Main Entry Point
 * Complete pipeline: Generate → Score → Publish
 * Optimized for AWS Lambda / Cloudflare Workers
 * 
 * Architecture:
 * 1. Generate video concept
 * 2. Call Replicate/DashScope (async + webhook)
 * 3. Download video, extract frames
 * 4. Score quality via HuggingFace API
 * 5. If score > threshold: Upload to R2 + Publish via Ayrshare
 * 6. Cleanup /tmp
 */

const { generateVideo } = require("./generator");
const { scoreVideoQuality } = require("./scorer");
const { uploadVideo, cleanupTmp } = require("./storage");
const { publishVideo } = require("./publisher");
const { extractFrames, cleanup: ffmpegCleanup } = require("./ffmpeg");

// Configuration
const CONFIG = {
  threshold: parseFloat(process.env.SCORE_THRESHOLD) || 0.75,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 2,
  platforms: (process.env.PUBLISH_PLATFORMS || "youtube,instagram,tiktok").split(","),
  webhookUrl: process.env.WEBHOOK_URL
};

/**
 * Main handler - AWS Lambda / Cloudflare Workers entry point
 * @param {Object} event - Lambda/Worker event
 * @returns {Object} Execution result
 */
async function handler(event) {
  console.log("🤖 Starting Serverless Pipeline...");
  
  const startTime = Date.now();
  
  try {
    // Step 1: Generate video concept
    console.log("\n[1/6] Generating video concept...");
    const concept = generateConcept();
    console.log(`💡 Concept: "${concept.hook}"`);

    // Step 2: Generate video via AI (Replicate/DashScope)
    console.log("\n[2/6] Generating video via AI service...");
    const generationResult = await generateVideo(
      concept.prompt,
      { duration: concept.duration }
    );
    console.log(`✅ Generation: ${generationResult.status}`);

    // Step 3: Download and extract frames
    console.log("\n[3/6] Extracting frames for scoring...");
    const frames = await extractFrames(
      generationResult.localPath || "/tmp/video.mp4",
      "/tmp/frames",
      3
    );

    // Step 4: Score quality
    console.log("\n[4/6] Scoring video quality...");
    const score = await scoreVideoQuality(null, {
      ...concept,
      frameUrls: frames
    });
    console.log(`📊 Score: ${score.toFixed(2)} (threshold: ${CONFIG.threshold})`);

    // Step 5: Decision - publish or skip
    if (score < CONFIG.threshold) {
      console.log("\n❌ Score below threshold - skipping");
      await cleanup([generationResult.localPath, "/tmp/frames"]);
      return {
        status: "skipped",
        score,
        concept
      };
    }

    console.log("\n[5/6] Publishing to social platforms...");
    
    // Upload to R2
    const videoUrl = await uploadVideo(
      generationResult.localPath || "/tmp/video.mp4",
      `video_${Date.now()}`
    );

    // Publish to platforms
    const publishResults = await publishVideo(
      videoUrl,
      concept,
      CONFIG.platforms
    );

    // Step 6: Cleanup
    console.log("\n[6/6] Cleaning up...");
    await cleanup([generationResult.localPath, "/tmp/frames"]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Pipeline complete in ${elapsed}s`);

    return {
      status: "published",
      score,
      concept,
      videoUrl,
      platforms: publishResults,
      elapsed: `${elapsed}s`
    };

  } catch (err) {
    console.error("\n💥 Pipeline failed:", err.message);
    
    // Cleanup on error
    await cleanupTmp();
    
    return {
      status: "error",
      error: err.message,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    };
  }
}

/**
 * Generate video concept from templates
 */
function generateConcept() {
  const hooks = [
    "Fix this fast",
    "Disk full?",
    "Server broken?",
    "Stop doing this",
    "Linux mistake",
    "Terminal trick",
    "Command you need",
    "SSH hack",
    "Permission fix",
    "Process killer"
  ];
  
  const commands = [
    ["df -h", "du -sh *", "find / -size +100M"],
    ["systemctl restart nginx", "journalctl -u nginx"],
    ["journalctl --vacuum-size=500M", "rm -rf /var/log/*.gz"],
    ["chmod -R 755 /var/www", "chown -R www-data:www-data /var/www"],
    ["kill -9 $(lsof -t -i:8080)", "systemctl status apache2"],
    ["cat /etc/passwd", "grep bash /etc/passwd"],
    ["ps aux | grep node", "htop -p $(pgrep node)"],
    ["ssh-keygen -t rsa", "ssh-copy-id user@server"],
    ["iptables -L", "ufw allow 22/tcp"],
    ["docker ps", "docker system prune -af"]
  ];
  
  const hook = hooks[Math.floor(Math.random() * hooks.length)];
  const cmds = commands[Math.floor(Math.random() * commands.length)];
  
  return {
    hook,
    commands: cmds,
    prompt: `Linux terminal tutorial showing ${hook.toLowerCase()} with commands: ${cmds.join(", ")}`,
    duration: 15 + Math.floor(Math.random() * 30),
    pacing: Math.random() > 0.5 ? "fast" : "medium"
  };
}

/**
 * Cleanup helper
 */
async function cleanup(paths) {
  try {
    await cleanupTmp();
    await ffmpegCleanup(paths);
  } catch (err) {
    // Ignore cleanup errors in error path
  }
}

/**
 * Webhook handler for async generation callbacks
 */
async function webhookHandler(event) {
  console.log("📡 Received webhook callback");
  
  const payload = event.body || event;
  
  try {
    const { status, output } = payload;
    
    if (status === "succeeded") {
      console.log("✅ Video generation complete");
      // Continue pipeline from scoring step
      return await continuePipeline(output);
    }
    
    if (status === "failed") {
      console.error("❌ Video generation failed");
      return { status: "error" };
    }
    
    return { status: "processing" };
  } catch (err) {
    console.error("💥 Webhook handler failed:", err.message);
    return { status: "error", error: err.message };
  }
}

/**
 * Continue pipeline after async generation
 */
async function continuePipeline(videoUrl) {
  console.log("🔄 Continuing pipeline with generated video...");
  
  // Download video to /tmp
  // Extract frames
  // Score
  // Publish if above threshold
  
  return handler({});
}

// Export for Lambda/Workers
module.exports = {
  handler,
  webhookHandler,
  generateConcept
};

// Run if executed directly
if (require.main === module) {
  handler({})
    .then(result => {
      console.log("\n📊 Final Result:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("\n💥 Fatal:", err.message);
      process.exit(1);
    });
}
