/**
 * YouTube Analytics Sync Endpoint
 * Accepts batch data from Google Apps Script
 * Validates, stores, and triggers analytics updates
 */

interface YouTubeSyncRecord {
  jobId: string;
  market: string;
  variant: string;
  platform: "youtube";
  videoUrl: string;
  views: number;
  ctr: number;
  engagement: number;
  timestamp: number;
}

interface SyncResult {
  synced: number;
  errors: string[];
  updatedAt: number;
}

/**
 * Validate sync record
 */
function validateRecord(record: any): string | null {
  if (!record.jobId) return "Missing jobId";
  if (!record.market) return "Missing market";
  if (!record.views && record.views !== 0) return "Missing views";
  return null;
}

/**
 * Process YouTube sync batch
 */
export async function processYouTubeSync(
  records: YouTubeSyncRecord[],
  kv: KVNamespace
): Promise<SyncResult> {
  let synced = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const validationError = validateRecord(record);
    
    if (validationError) {
      errors.push(`Record ${i + 1}: ${validationError}`);
      continue;
    }

    try {
      // Store in analytics
      const event = {
        jobId: record.jobId,
        market: record.market,
        variant: record.variant || "default",
        views: record.views,
        ctr: record.ctr || 0,
        engagementRate: record.engagement || 0,
        timestamp: record.timestamp || Date.now(),
        source: "youtube-sync"
      };

      await kv.put(`analytics:${record.jobId}`, JSON.stringify(event), {
        expirationTtl: 7776000
      });

      // Update video status
      await kv.put(`video:${record.jobId}:status`, JSON.stringify({
        synced: true,
        views: record.views,
        ctr: record.ctr,
        platform: "youtube",
        url: record.videoUrl
      }), { expirationTtl: 2592000 });

      synced++;
    } catch (err) {
      errors.push(`Record ${i + 1}: ${(err as Error).message}`);
    }
  }

  return {
    synced,
    errors,
    updatedAt: Date.now()
  };
}
