#!/usr/bin/env node
/**
 * Bulk Import Analytics CSV
 * Format: Job ID,Market,Variant,Views,CTR (%),Engagement Rate (%)
 * 
 * Usage: node import-analytics.js export.csv
 */

const fs = require("fs");
const path = require("path");

// Cloudflare API config
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_NAMESPACE_ID) {
  console.error("❌ Missing environment variables:");
  console.error("   CF_API_TOKEN - Cloudflare API token");
  console.error("   CF_ACCOUNT_ID - Cloudflare account ID");
  console.error("   KV_NAMESPACE_ID - KV namespace ID for analytics");
  process.exit(1);
}

const csvFile = process.argv[2];
if (!csvFile) {
  console.error("❌ Usage: node import-analytics.js <csv-file>");
  console.error("   CSV Format: Job ID,Market,Variant,Views,CTR (%),Engagement Rate (%)");
  process.exit(1);
}

// Read CSV
const csvContent = fs.readFileSync(csvFile, "utf-8");
const lines = csvContent.trim().split("\n");

console.log(`📊 Importing ${lines.length - 1} analytics records...`);

async function importRecord(line, index) {
  const [jobId, market, variant, viewsStr, ctrStr, engagementStr] = line.split(",");
  
  if (!jobId || !market) {
    console.error(`❌ Line ${index + 1}: Missing required fields`);
    return false;
  }

  const event = {
    jobId: jobId.trim(),
    market: market.trim(),
    variant: variant?.trim() || "default",
    views: parseInt(viewsStr) || 0,
    ctr: parseFloat(ctrStr) || 0,
    engagementRate: parseFloat(engagementStr) || 0,
    timestamp: Date.now(),
    source: "manual"
  };

  // Store in KV via Cloudflare API
  const key = `analytics:${event.jobId}`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Line ${index + 1}: API error ${error}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`❌ Line ${index + 1}: Network error ${err.message}`);
    return false;
  }
}

async function main() {
  let imported = 0;
  let errors = 0;

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const success = await importRecord(lines[i], i);
    if (success) {
      imported++;
    } else {
      errors++;
    }

    if (i % 10 === 0) {
      console.log(`⏳ Progress: ${i}/${lines.length - 1}`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Import Complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Imported: ${imported}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total lines: ${lines.length - 1}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(err => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
