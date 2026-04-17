const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

/**
 * Publish video to social media platforms
 * Currently supports webhook/API integration
 * @param {string} videoPath - Path to video file
 * @param {Object} metadata - Video metadata
 * @returns {Promise<Object>} Publishing result
 */
async function publishToSocial(videoPath, metadata) {
  console.log(`🚀 Publishing: ${metadata.hook}`);
  
  // Verify video exists
  if (!await fs.pathExists(videoPath)) {
    console.error("❌ Video file not found:", videoPath);
    return { status: "error", message: "File not found" };
  }
  
  const stats = await fs.stat(videoPath);
  console.log(`📁 Video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  // Example: Send to external API/webhook
  // Uncomment and configure for real publishing
  
  /*
  try {
    const formData = new FormData();
    formData.append("video", fs.createReadStream(videoPath));
    formData.append("title", metadata.hook);
    formData.append("description", `Linux tips: ${metadata.steps.join(", ")}`);
    formData.append("tags", ["linux", "terminal", "devops", "tutorial"]);
    
    // Example: TikTok API
    // await axios.post("https://api.tiktok.com/upload", formData, {
    //   headers: { ...formData.getHeaders(), Authorization: "Bearer TOKEN" }
    // });
    
    // Example: LinkedIn API
    // await axios.post("https://api.linkedin.com/v2/videos", formData, {
    //   headers: { Authorization: "Bearer TOKEN" }
    // });
    
    // Example: X (Twitter) API
    // await axios.post("https://upload.twitter.com/1.1/media/upload.json", formData, {
    //   headers: { Authorization: "Bearer TOKEN" }
    // });
    
  } catch (err) {
    console.error("❌ Publishing failed:", err.message);
    return { status: "error", message: err.message };
  }
  */
  
  // For now, just save to published folder
  const publishedDir = path.join(__dirname, "../published");
  await fs.ensureDir(publishedDir);
  
  const publishedPath = path.join(publishedDir, path.basename(videoPath));
  await fs.copy(videoPath, publishedPath);
  
  console.log("✅ Video saved to published folder");
  
  return { 
    status: "success", 
    path: publishedPath,
    metadata: metadata,
    url: `http://localhost/published/${path.basename(videoPath)}`
  };
}

/**
 * Batch publish multiple videos
 */
async function batchPublish(videos) {
  const results = [];
  
  for (const { videoPath, metadata } of videos) {
    try {
      const result = await publishToSocial(videoPath, metadata);
      results.push({ ...result, videoPath });
    } catch (err) {
      results.push({ status: "error", message: err.message, videoPath });
    }
  }
  
  return results;
}

module.exports = { publishToSocial, batchPublish };
