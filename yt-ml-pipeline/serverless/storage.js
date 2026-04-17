/**
 * Cloudflare R2 Storage Integration
 * Serverless object storage with S3-compatible API
 * Used for temporary file storage between processing steps
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// Configuration
const CONFIG = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucket: process.env.CLOUDFLARE_R2_BUCKET || "yt-ml-pipeline",
  region: "auto"
};

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: CONFIG.region,
  endpoint: `https://${CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CONFIG.accessKeyId,
    secretAccessKey: CONFIG.secretAccessKey
  }
});

/**
 * Upload file to R2
 * @param {string} filePath - Local file path
 * @param {string} key - R2 object key
 * @returns {Promise<string>} Public URL
 */
async function uploadFile(filePath, key) {
  console.log(`📤 Uploading to R2: ${key}`);

  try {
    const fileContent = await fs.readFile(filePath);
    
    const command = new PutObjectCommand({
      Bucket: CONFIG.bucket,
      Key: key,
      Body: fileContent,
      ContentType: getContentType(filePath)
    });

    await s3Client.send(command);

    const url = getPublicUrl(key);
    console.log(`✅ Uploaded: ${url}`);
    return url;
  } catch (err) {
    console.error("❌ R2 upload failed:", err.message);
    throw err;
  }
}

/**
 * Upload buffer to R2
 */
async function uploadBuffer(buffer, key, contentType = "application/octet-stream") {
  console.log(`📤 Uploading buffer to R2: ${key}`);

  const command = new PutObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3Client.send(command);

  const url = getPublicUrl(key);
  console.log(`✅ Uploaded: ${url}`);
  return url;
}

/**
 * Download file from R2 to local /tmp
 */
async function downloadFile(key, outputPath) {
  console.log(`📥 Downloading from R2: ${key}`);

  const command = new GetObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key
  });

  const response = await s3Client.send(command);
  const buffer = await streamToBuffer(response.Body);

  await fs.writeFile(outputPath, buffer);
  console.log(`✅ Downloaded to: ${outputPath}`);
  return outputPath;
}

/**
 * Generate pre-signed URL for temporary access
 */
async function generatePresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
}

/**
 * Delete file from R2
 */
async function deleteFile(key) {
  console.log(`🗑️  Deleting from R2: ${key}`);

  const command = new DeleteObjectCommand({
    Bucket: CONFIG.bucket,
    Key: key
  });

  await s3Client.send(command);
  console.log(`✅ Deleted: ${key}`);
}

/**
 * Upload video and return URL
 */
async function uploadVideo(filePath, videoId) {
  const key = `videos/${videoId}.mp4`;
  return await uploadFile(filePath, key);
}

/**
 * Clean up /tmp directory (serverless constraint)
 */
async function cleanupTmp() {
  console.log("🧹 Cleaning /tmp...");
  try {
    const tmpDir = "/tmp";
    const files = await fs.readdir(tmpDir);
    
    for (const file of files) {
      if (file.startsWith("yt-ml-") || file.endsWith(".ass")) {
        await fs.remove(path.join(tmpDir, file));
      }
    }
    
    console.log("✅ /tmp cleaned");
  } catch (err) {
    console.error("⚠️  Cleanup failed:", err.message);
  }
}

/**
 * Get public URL for R2 object
 */
function getPublicUrl(key) {
  return `https://pub-${CONFIG.accountId}.r2.dev/${key}`;
}

/**
 * Get content type from file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".json": "application/json",
    ".txt": "text/plain",
    ".ass": "text/x-ssa"
  };
  return types[ext] || "application/octet-stream";
}

/**
 * Convert stream to buffer (helper)
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = {
  uploadFile,
  uploadBuffer,
  downloadFile,
  generatePresignedUrl,
  deleteFile,
  uploadVideo,
  cleanupTmp,
  getPublicUrl,
  s3Client
};
