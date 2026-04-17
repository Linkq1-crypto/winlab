/**
 * Serverless Video Generation Module
 * Uses Replicate or DashScope for AI video generation
 * 100% serverless - no GPU required
 */

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// Configuration
const CONFIG = {
  provider: process.env.VIDEO_PROVIDER || "replicate", // "replicate" or "dashscope"
  replicate: {
    token: process.env.REPLICATE_API_TOKEN,
    model: process.env.REPLICATE_MODEL || "stability-ai/stable-video-diffusion:3f0457e4619da7b0d6e1c2b7c4e8f3b3"
  },
  dashscope: {
    key: process.env.DASHSCOPE_API_KEY
  },
  webhook: process.env.WEBHOOK_URL
};

/**
 * Generate video using Replicate (CogVideoX, LTX-Video, Mochi)
 * Async with webhook callback
 * @param {string} prompt - Video generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Prediction details
 */
async function generateWithReplicate(prompt, options = {}) {
  const {
    duration = 5,
    fps = 24,
    width = 1024,
    height = 576
  } = options;

  console.log("🎬 Generating video via Replicate...");
  console.log(`📝 Prompt: ${prompt}`);

  try {
    // Start prediction
    const response = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: CONFIG.replicate.model.split(":")[1],
        input: {
          prompt,
          duration,
          fps,
          width,
          height,
          webhook_url: CONFIG.webhook || null
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.replicate.token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const predictionId = response.data.id;
    console.log(`✅ Prediction started: ${predictionId}`);

    // If no webhook, poll for completion
    if (!CONFIG.webhook) {
      return await pollPrediction(predictionId);
    }

    return {
      status: "processing",
      id: predictionId,
      webhook: CONFIG.webhook
    };
  } catch (err) {
    console.error("❌ Replicate error:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * Poll prediction until complete (synchronous mode)
 */
async function pollPrediction(predictionId) {
  const maxAttempts = 60;
  const interval = 10000; // 10 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);

    const response = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.replicate.token}`
        }
      }
    );

    const { status, output, error } = response.data;

    if (status === "succeeded") {
      console.log(`✅ Video generated: ${output}`);
      return { status: "success", url: output[0] };
    }

    if (status === "failed") {
      throw new Error(`Prediction failed: ${error}`);
    }

    console.log(`⏳ Status: ${status} (${i + 1}/${maxAttempts})`);
  }

  throw new Error("Prediction timeout");
}

/**
 * Generate video using DashScope (Wan 2.1)
 * @param {string} prompt - Video generation prompt
 * @returns {Promise<Object>} Generation result
 */
async function generateWithDashScope(prompt) {
  console.log("🎬 Generating video via DashScope...");
  console.log(`📝 Prompt: ${prompt}`);

  try {
    const response = await axios.post(
      "https://dashscope.aliyuncs.com/api/v1/services/video/generation",
      {
        model: "wan2.1",
        input: {
          prompt
        },
        parameters: {
          duration: 5,
          resolution: "720p"
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.dashscope.key}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable"
        }
      }
    );

    const taskId = response.data.output.task_id;
    console.log(`✅ Task created: ${taskId}`);

    // Poll for completion
    return await pollDashScopeTask(taskId);
  } catch (err) {
    console.error("❌ DashScope error:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * Poll DashScope task until complete
 */
async function pollDashScopeTask(taskId) {
  const maxAttempts = 60;
  const interval = 10000;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);

    const response = await axios.get(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: {
          "Authorization": `Bearer ${CONFIG.dashscope.key}`
        }
      }
    );

    const { task_status, output, message } = response.data.output;

    if (task_status === "SUCCEEDED") {
      console.log(`✅ Video generated: ${output.video_url}`);
      return { status: "success", url: output.video_url };
    }

    if (task_status === "FAILED") {
      throw new Error(`Task failed: ${message}`);
    }

    console.log(`⏳ Status: ${task_status} (${i + 1}/${maxAttempts})`);
  }

  throw new Error("Task timeout");
}

/**
 * Main generation function - auto-selects provider
 * @param {string} prompt - Video generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated video URL
 */
async function generateVideo(prompt, options = {}) {
  try {
    if (CONFIG.provider === "dashscope") {
      return await generateWithDashScope(prompt);
    } else {
      return await generateWithReplicate(prompt, options);
    }
  } catch (err) {
    console.error("❌ Video generation failed");
    
    // Fallback to Pexels stock video
    console.log("🔄 Falling back to Pexels...");
    return await getFallbackVideo(prompt);
  }
}

/**
 * Get fallback video from Pexels
 */
async function getFallbackVideo(prompt) {
  if (!process.env.PEXELS_API_KEY) {
    throw new Error("No fallback available (PEXELS_API_KEY not set)");
  }

  try {
    const response = await axios.get("https://api.pexels.com/videos/search", {
      params: {
        query: prompt.split(" ")[0],
        per_page: 1,
        orientation: "portrait"
      },
      headers: {
        "Authorization": process.env.PEXELS_API_KEY
      }
    });

    const video = response.data.videos[0];
    const videoFile = video.video_files.find(f => f.quality === "hd");

    console.log(`✅ Fallback video found: ${videoFile.link}`);
    return { status: "success", url: videoFile.link, fallback: true };
  } catch (err) {
    console.error("❌ Fallback failed:", err.message);
    throw err;
  }
}

/**
 * Handle webhook callback from Replicate/DashScope
 */
async function handleWebhook(payload) {
  const { status, output, error } = payload;

  if (status === "succeeded") {
    console.log("✅ Webhook: Video generation complete");
    return { status: "success", url: output[0] };
  }

  if (status === "failed") {
    console.error("❌ Webhook: Video generation failed");
    return { status: "error", message: error };
  }

  return { status: "processing" };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateVideo,
  handleWebhook,
  generateWithReplicate,
  generateWithDashScope
};
