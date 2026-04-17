#!/usr/bin/env node
/**
 * CSV Conversion Script
 * Converts raw YouTube/IG exports to analytics-ready format
 * 
 * Usage: node convert-export.js <youtube-export.csv> <output.csv>
 */

const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2];
const outputFile = process.argv[3] || "analytics-ready.csv";

if (!inputFile) {
  console.error("❌ Usage: node convert-export.js <input.csv> [output.csv]");
  console.error("   Input format: YouTube Studio or IG export");
  process.exit(1);
}

// Read input
const inputContent = fs.readFileSync(inputFile, "utf-8");
const lines = inputContent.trim().split("\n");
const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

console.log(`📊 Converting ${lines.length - 1} records...`);
console.log(`📋 Headers: ${headers.join(", ")}`);

// Helper: Find column by partial match
function findColumn(partialName) {
  return headers.findIndex(h => h.includes(partialName.toLowerCase()));
}

// Helper: Parse percentage
function parsePercentage(value) {
  if (!value) return 0;
  const num = parseFloat(value.replace("%", ""));
  return isNaN(num) ? 0 : num;
}

// Helper: Parse number
function parseNumber(value) {
  if (!value) return 0;
  const num = parseFloat(value.replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

// Convert
const outputLines = ["Job ID,Market,Variant,Platform,Video URL,Views,CTR (%),Engagement Rate (%)"];
const platform = determinePlatform(headers);

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  
  if (platform === "youtube") {
    const record = convertYouTube(cols, headers);
    outputLines.push(toCSVLine(record));
  } else if (platform === "instagram") {
    const record = convertInstagram(cols, headers);
    outputLines.push(toCSVLine(record));
  } else {
    console.error(`❌ Unknown platform. Headers: ${headers.join(", ")}`);
    process.exit(1);
  }
}

// Write output
fs.writeFileSync(outputFile, outputLines.join("\n"));
console.log(`✅ Converted ${lines.length - 1} records`);
console.log(`📁 Saved to: ${outputFile}`);

function determinePlatform(headers) {
  if (headers.some(h => h.includes("impression"))) return "youtube";
  if (headers.some(h => h.includes("reach") || h.includes("engagement"))) return "instagram";
  return "unknown";
}

function convertYouTube(cols, headers) {
  // YouTube columns: Video title, Video ID, Views, Impressions, Impressions CTR, Likes, Comments, Shares
  const viewsIdx = findColumn("views");
  const impressionsIdx = findColumn("impression");
  const ctrIdx = findColumn("ctr");
  
  const views = parseNumber(cols[viewsIdx] || "0");
  const impressions = parseNumber(cols[impressionsIdx] || "0");
  const ctr = parsePercentage(cols[ctrIdx] || "0");
  
  // Engagement = (Likes + Comments + Shares) / Views * 100
  const likesIdx = findColumn("like");
  const commentsIdx = findColumn("comment");
  const sharesIdx = findColumn("share");
  
  const likes = parseNumber(cols[likesIdx] || "0");
  const comments = parseNumber(cols[commentsIdx] || "0");
  const shares = parseNumber(cols[sharesIdx] || "0");
  const engagement = views > 0 ? ((likes + comments + shares) / views * 100) : 0;

  return {
    jobId: cols[1] || `yt-${Date.now()}-${i}`,
    market: "us", // Default or extract from title
    variant: "A", // Default
    platform: "youtube",
    videoUrl: `https://youtu.be/${cols[1] || ""}`,
    views,
    ctr: ctr || (impressions > 0 ? views / impressions * 100 : 0),
    engagementRate: engagement
  };
}

function convertInstagram(cols, headers) {
  // IG columns: Content, Reach, Likes, Comments, Shares, Saves, Engagement Rate
  const reachIdx = findColumn("reach");
  const likesIdx = findColumn("like");
  const commentsIdx = findColumn("comment");
  const sharesIdx = findColumn("share");
  const savesIdx = findColumn("save");
  const engagementIdx = findColumn("engagement");
  
  const reach = parseNumber(cols[reachIdx] || "0");
  const likes = parseNumber(cols[likesIdx] || "0");
  const comments = parseNumber(cols[commentsIdx] || "0");
  const shares = parseNumber(cols[sharesIdx] || "0");
  const saves = parseNumber(cols[savesIdx] || "0");
  const engagement = parsePercentage(cols[engagementIdx] || "0");

  return {
    jobId: `ig-${Date.now()}-${i}`,
    market: "us",
    variant: "A",
    platform: "instagram",
    videoUrl: cols[0] || "",
    views: reach,
    ctr: 0, // IG doesn't have CTR
    engagementRate: engagement || (reach > 0 ? (likes + comments + shares + saves) / reach * 100 : 0)
  };
}

function toCSVLine(record) {
  return [
    record.jobId,
    record.market,
    record.variant,
    record.platform,
    record.videoUrl,
    record.views,
    record.ctr.toFixed(1),
    record.engagementRate.toFixed(1)
  ].join(",");
}
