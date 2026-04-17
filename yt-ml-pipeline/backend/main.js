const { generateVideo, buildFeatures, predict } = require("./engine");
const { renderVideo } = require("./renderer");
const { publishToSocial } = require("./publisher");
const fs = require("fs-extra");
const path = require("path");

// Configuration
const CONFIG = {
  threshold: 0.75,        // Minimum score to publish
  maxAttempts: 20,        // Max videos to generate per run
  outputDir: "./output",  // Temporary output directory
  publish: true           // Auto-publish approved videos
};

/**
 * Main autopilot loop:
 * 1. Generate video concept
 * 2. Extract features
 * 3. Predict quality score
 * 4. If score > threshold: render and publish
 */
async function startAutoPilot() {
  console.log("🤖 Starting AI Video Autopilot...");
  console.log(`📊 Threshold: ${CONFIG.threshold}`);
  console.log(`🎬 Max attempts: ${CONFIG.maxAttempts}`);
  console.log("");
  
  // Ensure output directory exists
  await fs.ensureDir(CONFIG.outputDir);
  
  let published = 0;
  let skipped = 0;
  
  for (let i = 0; i < CONFIG.maxAttempts; i++) {
    console.log(`\n[Attempt ${i + 1}/${CONFIG.maxAttempts}]`);
    console.log("─".repeat(50));
    
    // Step 1: Generate video concept
    const videoData = generateVideo();
    console.log(`💡 Concept: "${videoData.hook}"`);
    console.log(`📝 Steps: ${videoData.steps.length} commands`);
    console.log(`⏱️  Duration: ${videoData.duration}s`);
    
    // Step 2: Build features
    const features = buildFeatures(videoData);
    
    // Step 3: Predict quality score
    console.log("🧠 Predicting quality...");
    const score = predict(features);
    console.log(`📊 AI Score: ${score.toFixed(2)} (${(score * 100).toFixed(0)}%)`);
    
    // Step 4: Decision
    if (score > CONFIG.threshold) {
      console.log(`🔥 APPROVED (>${CONFIG.threshold})`);
      
      // Render video
      const timestamp = Date.now();
      const videoPath = path.join(CONFIG.outputDir, `video_${timestamp}.mp4`);
      
      try {
        console.log("🎬 Rendering video...");
        await renderVideo(videoData, videoPath);
        
        // Publish if enabled
        if (CONFIG.publish) {
          console.log("📤 Publishing...");
          const result = await publishToSocial(videoPath, videoData);
          
          if (result.status === "success") {
            console.log("✅ Published successfully!");
            published++;
          } else {
            console.log("⚠️  Publishing failed:", result.message);
          }
        } else {
          console.log("ℹ️  Video saved (publish disabled)");
          published++;
        }
      } catch (err) {
        console.error("❌ Rendering failed:", err.message);
        skipped++;
      }
    } else {
      console.log(`❌ SKIPPED (<${CONFIG.threshold})`);
      skipped++;
    }
  }
  
  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("📈 RUN SUMMARY");
  console.log("═".repeat(50));
  console.log(`✅ Published: ${published}`);
  console.log(`❌ Skipped:  ${skipped}`);
  console.log(`📊 Success rate: ${((published / CONFIG.maxAttempts) * 100).toFixed(0)}%`);
  console.log("═".repeat(50));
  
  return { published, skipped };
}

// Run if executed directly
if (require.main === module) {
  startAutoPilot()
    .then(() => {
      console.log("\n👋 Autopilot complete");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n💥 Fatal error:", err);
      process.exit(1);
    });
}

module.exports = { startAutoPilot, CONFIG };
