/**
 * Google Apps Script - YouTube Analytics Sync
 * 
 * Setup:
 * 1. Extensions → Apps Script → Paste this code
 * 2. Enable YouTube Data API v3 + YouTube Analytics API
 * 3. Set WORKER_URL and DASHBOARD_API_KEY
 * 4. Create trigger: Daily 06:00-07:00
 */

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  WORKER_URL: "https://ai-shorts-worker.your-subdomain.workers.dev",
  DASHBOARD_API_KEY: "your-dashboard-api-key",
  
  // YouTube Analytics API parameters
  DAYS_BACK: 7, // Sync last 7 days
  MAX_RESULTS: 50
};

// ==========================================
// MAIN SYNC FUNCTION
// ==========================================

function syncYouTubeAnalytics() {
  console.log("🔄 Starting YouTube Analytics sync...");
  
  try {
    // Get sheet data
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find column indices
    const jobIdCol = headers.indexOf("Job ID");
    const marketCol = headers.indexOf("Market");
    const variantCol = headers.indexOf("Variant");
    const platformCol = headers.indexOf("Platform");
    const urlCol = headers.indexOf("Video URL");
    const statusCol = headers.indexOf("Sync Status");
    
    if (jobIdCol === -1 || urlCol === -1) {
      console.error("❌ Missing required columns: Job ID, Video URL");
      return;
    }
    
    const recordsToSync = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - CONFIG.DAYS_BACK);
    
    // Process rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const jobId = row[jobIdCol];
      const platform = row[platformCol] || "youtube";
      const status = row[statusCol];
      
      // Skip if not YouTube or already synced
      if (platform !== "youtube" || status === "Synced") continue;
      if (!jobId || !row[urlCol]) continue;
      
      // Extract video ID from URL
      const videoId = extractVideoId(row[urlCol]);
      if (!videoId) {
        console.warn(`⚠️ Invalid URL: ${row[urlCol]}`);
        continue;
      }
      
      try {
        // Fetch YouTube Analytics
        const analytics = fetchYouTubeAnalytics(videoId, startDate, endDate);
        
        if (analytics) {
          recordsToSync.push({
            jobId: jobId,
            market: row[marketCol] || "us",
            variant: row[variantCol] || "A",
            platform: "youtube",
            videoUrl: row[urlCol],
            views: analytics.views || 0,
            ctr: analytics.ctr || 0,
            engagement: analytics.engagement || 0,
            timestamp: Date.now()
          });
          
          // Update sheet
          sheet.getRange(i + 1, statusCol + 1).setValue("Synced");
          sheet.getRange(i + 1, headers.indexOf("Views") + 1).setValue(analytics.views || 0);
          sheet.getRange(i + 1, headers.indexOf("CTR %") + 1).setValue(analytics.ctr || 0);
        }
      } catch (err) {
        console.error(`❌ Error fetching analytics for ${videoId}: ${err.message}`);
        sheet.getRange(i + 1, statusCol + 1).setValue(`Error: ${err.message}`);
      }
    }
    
    // Send to CF Worker
    if (recordsToSync.length > 0) {
      sendToWorker(recordsToSync);
      console.log(`✅ Synced ${recordsToSync.length} records`);
    } else {
      console.log("⏭️ No new records to sync");
    }
    
  } catch (err) {
    console.error(`💥 Sync failed: ${err.message}`);
    sendErrorNotification(err.message);
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([^&\s]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch YouTube Analytics for a video
 * Requires YouTube Analytics API enabled
 */
function fetchYouTubeAnalytics(videoId, startDate, endDate) {
  try {
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    
    // Fetch metrics
    const response = YouTubeAnalytics.reports().query(
      "channel==MINE",
      startDateStr,
      endDateStr,
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage",
      {
        filters: `video==${videoId}`,
        dimensions: "video",
        sort: "-views",
        maxResults: 1
      }
    );
    
    if (response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      const views = row[0] || 0;
      
      // Fetch CTR from YouTube Data API
      const videoDetails = YouTube.Videos.list("statistics", { id: videoId });
      const stats = videoDetails.items[0].statistics;
      
      // Calculate engagement
      const likes = parseInt(stats.likeCount || "0");
      const comments = parseInt(stats.commentCount || "0");
      const engagement = views > 0 ? (likes + comments) / views * 100 : 0;
      
      // Get impressions CTR (requires additional API call)
      const ctr = getImpressionsCTR(videoId, startDateStr, endDateStr);
      
      return {
        views,
        ctr: ctr || 0,
        engagement
      };
    }
  } catch (err) {
    console.warn(`⚠️ Analytics fetch failed: ${err.message}`);
  }
  
  return null;
}

/**
 * Get impressions CTR (if available)
 */
function getImpressionsCTR(videoId, startDate, endDate) {
  try {
    const response = YouTubeAnalytics.reports().query(
      "channel==MINE",
      startDate,
      endDate,
      "impressions,impressionsClickThroughRate",
      {
        filters: `video==${videoId}`,
        dimensions: "video"
      }
    );
    
    if (response.rows && response.rows.length > 0) {
      return response.rows[0][1] * 100; // Convert to percentage
    }
  } catch (err) {
    // Impressions CTR may not be available
  }
  return null;
}

/**
 * Send data to CF Worker
 */
function sendToWorker(records) {
  const payload = {
    records: records
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + CONFIG.DASHBOARD_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(
      CONFIG.WORKER_URL + "/api/youtube-sync",
      options
    );
    
    const result = JSON.parse(response.getContentText());
    console.log(`✅ Worker response: ${result.synced} synced, ${result.errors.length} errors`);
    
    if (result.errors.length > 0) {
      console.error("❌ Errors:", result.errors.join("\n"));
    }
  } catch (err) {
    console.error(`❌ Failed to send to worker: ${err.message}`);
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Send error notification (optional: Telegram/email)
 */
function sendErrorNotification(error) {
  // Optional: Send email on failure
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: "❌ YouTube Analytics Sync Failed",
    body: `Error: ${error}\n\nTime: ${new Date().toISOString()}`
  });
}

/**
 * Export compatible CSV (fallback if OAuth fails)
 */
function exportCompatibleCSV() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  let csv = "Job ID,Market,Variant,Platform,Video URL,Views,CTR (%),Engagement Rate (%)\n";
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    csv += `${row[0]},${row[1]},${row[2]},${row[3]},${row[4]},${row[6] || 0},${row[7] || 0},${row[8] || 0}\n`;
  }
  
  // Save to Drive
  const fileName = `analytics_export_${formatDate(new Date())}.csv`;
  const blob = Utilities.newBlob(csv, "text/csv", fileName);
  const file = DriveApp.createFile(blob);
  
  console.log(`📁 CSV exported: ${fileName}`);
  console.log(`🔗 Download: ${file.getUrl()}`);
  
  return file;
}
