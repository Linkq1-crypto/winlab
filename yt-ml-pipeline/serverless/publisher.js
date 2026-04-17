/**
 * Ayrshare Social Media Publishing Module
 * Serverless publishing to TikTok, Instagram, YouTube, X (Twitter), LinkedIn
 * https://www.ayrshare.com
 */

const axios = require("axios");
const fs = require("fs-extra");

const CONFIG = {
  apiKey: process.env.AYRSHARE_API_KEY,
  baseUrl: "https://app.ayrshare.com/api"
};

/**
 * Publish video to multiple social platforms
 * @param {string} videoUrl - URL to video file (R2 or public)
 * @param {Object} metadata - Video metadata
 * @param {string[]} platforms - Target platforms
 * @returns {Promise<Object>} Publishing results
 */
async function publishVideo(videoUrl, metadata, platforms = ["tiktok", "instagram", "youtube"]) {
  console.log(`🚀 Publishing to: ${platforms.join(", ")}`);
  console.log(`📹 Video: ${videoUrl}`);

  const results = {};

  for (const platform of platforms) {
    try {
      let result;
      
      switch (platform) {
        case "tiktok":
          result = await publishToTikTok(videoUrl, metadata);
          break;
        case "instagram":
          result = await publishToInstagram(videoUrl, metadata);
          break;
        case "youtube":
          result = await publishToYouTube(videoUrl, metadata);
          break;
        case "twitter":
        case "x":
          result = await publishToX(videoUrl, metadata);
          break;
        case "linkedin":
          result = await publishToLinkedIn(videoUrl, metadata);
          break;
        default:
          console.warn(`⚠️  Unsupported platform: ${platform}`);
          continue;
      }

      results[platform] = {
        status: "success",
        ...result
      };

      console.log(`✅ Published to ${platform}: ${result.id || "ok"}`);
    } catch (err) {
      results[platform] = {
        status: "error",
        error: err.message
      };
      console.error(`❌ Failed to publish to ${platform}:`, err.message);
    }
  }

  return results;
}

/**
 * Publish to TikTok
 */
async function publishToTikTok(videoUrl, metadata) {
  const response = await axios.post(
    `${CONFIG.baseUrl}/post`,
    {
      mediaUrls: [videoUrl],
      platforms: ["tiktok"],
      title: metadata.hook || "Linux Tip",
      description: generateDescription(metadata),
      scheduleDate: metadata.scheduleDate || null
    },
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id: response.data.id,
    status: response.data.status,
    postUrl: response.data.postUrls?.[0]
  };
}

/**
 * Publish to Instagram (Reels)
 */
async function publishToInstagram(videoUrl, metadata) {
  const response = await axios.post(
    `${CONFIG.baseUrl}/post`,
    {
      mediaUrls: [videoUrl],
      platforms: ["instagram"],
      title: metadata.hook || "Linux Tip",
      description: generateDescription(metadata),
      scheduleDate: metadata.scheduleDate || null
    },
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id: response.data.id,
    status: response.data.status,
    postUrl: response.data.postUrls?.[0]
  };
}

/**
 * Publish to YouTube (Shorts)
 */
async function publishToYouTube(videoUrl, metadata) {
  const response = await axios.post(
    `${CONFIG.baseUrl}/post`,
    {
      mediaUrls: [videoUrl],
      platforms: ["youtube"],
      title: metadata.hook || "Linux Tip",
      description: generateDescription(metadata),
      tags: ["linux", "terminal", "devops", "tutorial", "tech"],
      isShort: true, // YouTube Shorts
      scheduleDate: metadata.scheduleDate || null
    },
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id: response.data.id,
    status: response.data.status,
    postUrl: response.data.postUrls?.[0]
  };
}

/**
 * Publish to X (Twitter)
 */
async function publishToX(videoUrl, metadata) {
  const response = await axios.post(
    `${CONFIG.baseUrl}/post`,
    {
      mediaUrls: [videoUrl],
      platforms: ["twitter"],
      title: metadata.hook || "Linux Tip",
      description: generateDescription(metadata).substring(0, 280),
      scheduleDate: metadata.scheduleDate || null
    },
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id: response.data.id,
    status: response.data.status,
    postUrl: response.data.postUrls?.[0]
  };
}

/**
 * Publish to LinkedIn
 */
async function publishToLinkedIn(videoUrl, metadata) {
  const response = await axios.post(
    `${CONFIG.baseUrl}/post`,
    {
      mediaUrls: [videoUrl],
      platforms: ["linkedin"],
      title: metadata.hook || "Linux Tip",
      description: generateDescription(metadata),
      scheduleDate: metadata.scheduleDate || null
    },
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return {
    id: response.data.id,
    status: response.data.status,
    postUrl: response.data.postUrls?.[0]
  };
}

/**
 * Generate description from metadata
 */
function generateDescription(metadata) {
  const commands = metadata.commands ? metadata.commands.join(" | ") : "";
  
  return `${metadata.hook || "Linux Tip"}\n\n` +
         `Commands: ${commands}\n\n` +
         `#linux #devops #terminal #tech #tutorial #coding`;
}

/**
 * Get post analytics
 */
async function getAnalytics(postId) {
  const response = await axios.get(
    `${CONFIG.baseUrl}/analytics/${postId}`,
    {
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`
      }
    }
  );

  return response.data;
}

/**
 * Delete post
 */
async function deletePost(postId) {
  const response = await axios.delete(
    `${CONFIG.baseUrl}/delete`,
    {
      data: { id: postId },
      headers: {
        "Authorization": `Bearer ${CONFIG.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

module.exports = {
  publishVideo,
  publishToTikTok,
  publishToInstagram,
  publishToYouTube,
  publishToX,
  publishToLinkedIn,
  getAnalytics,
  deletePost
};
