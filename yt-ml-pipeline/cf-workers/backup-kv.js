#!/usr/bin/env node
/**
 * KV Backup Script - Disaster Recovery
 * Exports all KV namespace data to JSON files
 * 
 * Usage: node backup-kv.js [output-dir]
 * 
 * Environment Variables:
 * - CF_API_TOKEN - Cloudflare API token (KV Storage: Read)
 * - CF_ACCOUNT_ID - Cloudflare account ID
 * - KV_NAMESPACE_ID - KV namespace ID to backup
 */

const fs = require("fs");
const path = require("path");

const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !KV_NAMESPACE_ID) {
  console.error("❌ Missing environment variables:");
  console.error("   CF_API_TOKEN - Cloudflare API token (KV Storage: Read scope)");
  console.error("   CF_ACCOUNT_ID - Cloudflare account ID");
  console.error("   KV_NAMESPACE_ID - KV namespace ID to backup");
  console.error("\n💡 Create API token at: https://dash.cloudflare.com/profile/api-tokens");
  console.error("   Required scopes: Account Settings: Read, KV Storage: Read");
  process.exit(1);
}

const outputDir = process.argv[2] || `./kv-backup-${new Date().toISOString().split("T")[0]}`;

console.log("🗄️  KV Backup Script");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📦 Account: ${CF_ACCOUNT_ID}`);
console.log(`📦 Namespace: ${KV_NAMESPACE_ID}`);
console.log(`📁 Output: ${outputDir}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

async function listKeys(prefix = "", cursor = null) {
  const params = new URLSearchParams({ limit: "1000" });
  if (prefix) params.set("prefix", prefix);
  if (cursor) params.set("cursor", cursor);

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?${params}`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function getValue(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${CF_API_TOKEN}` }
  });

  if (!response.ok) return null;

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function backup() {
  console.log("📋 Listing keys...");
  
  const allKeys = [];
  let cursor = null;
  
  do {
    const result = await listKeys("", cursor);
    allKeys.push(...result.result);
    cursor = result.result_info.cursor;
    
    if (allKeys.length % 1000 === 0) {
      console.log(`   Found ${allKeys.length} keys...`);
    }
  } while (cursor);

  console.log(`✅ Total keys: ${allKeys.length}\n`);

  if (allKeys.length === 0) {
    console.log("⚠️  No keys found. Check your namespace ID.");
    return;
  }

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Group keys by prefix
  const grouped = {};
  allKeys.forEach(key => {
    const parts = key.name.split(":");
    const prefix = parts.length > 1 ? parts[0] : "root";
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(key.name);
  });

  console.log(`📊 Groups: ${Object.keys(grouped).join(", ")}\n`);

  // Backup each key
  let backedUp = 0;
  let errors = 0;
  const totalSize = { raw: 0, compressed: 0 };

  for (const [prefix, keys] of Object.entries(grouped)) {
    console.log(`📦 Backing up ${prefix} (${keys.length} keys)...`);
    
    const groupData = {};
    
    for (const key of keys) {
      try {
        const value = await getValue(key);
        groupData[key] = value;
        backedUp++;
        
        const size = JSON.stringify(value).length;
        totalSize.raw += size;
      } catch (err) {
        console.error(`   ❌ Error fetching ${key}: ${err.message}`);
        errors++;
      }

      if (backedUp % 100 === 0) {
        console.log(`   Progress: ${backedUp}/${allKeys.length}`);
      }
    }

    // Write group file
    const filePath = path.join(outputDir, `${prefix}.json`);
    const content = JSON.stringify(groupData, null, 2);
    fs.writeFileSync(filePath, content);
    
    const compressed = content.length;
    totalSize.compressed += compressed;
    
    console.log(`   ✅ ${prefix}.json (${(compressed / 1024).toFixed(1)} KB)\n`);
  }

  // Write manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    accountId: CF_ACCOUNT_ID,
    namespaceId: KV_NAMESPACE_ID,
    totalKeys: allKeys.length,
    backedUp,
    errors,
    groups: Object.keys(grouped),
    sizeBytes: totalSize,
    keys: allKeys.map(k => ({ name: k.name, expiration: k.expiration }))
  };

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Backup Complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📁 Directory: ${outputDir}`);
  console.log(`📦 Total keys: ${allKeys.length}`);
  console.log(`✅ Backed up: ${backedUp}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Raw size: ${(totalSize.raw / 1024).toFixed(1)} KB`);
  console.log(`📊 Compressed: ${(totalSize.compressed / 1024).toFixed(1)} KB`);
  console.log(`📄 Files: ${Object.keys(grouped).length} + manifest.json`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (errors > 0) {
    console.warn("⚠️  Some keys failed to backup. Check errors above.");
    process.exit(1);
  }
}

// Run
backup().catch(err => {
  console.error("💥 Backup failed:", err.message);
  process.exit(1);
});
