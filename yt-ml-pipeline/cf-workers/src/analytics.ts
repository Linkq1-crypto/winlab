/**
 * Analytics & Feedback Loop
 * Tracks views, CTR, engagement rate
 * Updates A/B variant weights automatically
 * Compatible with Ayrshare stats API or manual CSV import
 */

export interface AnalyticsEvent {
  jobId: string;
  market: string;
  variant: string;
  views: number;
  ctr: number; // percentage
  engagementRate: number; // percentage
  timestamp: number;
  source?: "ayrshare" | "manual" | "webhook";
}

export interface AnalyticsSummary {
  avgCTR: number;
  avgEngagement: number;
  totalViews: number;
  videosPublished: number;
  byMarket: Record<string, { avgCTR: number; avgEngagement: number; videos: number }>;
}

/**
 * Store analytics event in KV
 */
export async function storeAnalyticsEvent(
  event: AnalyticsEvent,
  kv: KVNamespace
): Promise<void> {
  const key = `analytics:${event.jobId}`;
  await kv.put(key, JSON.stringify(event), {
    expirationTtl: 7776000 // 90 days
  });

  // Also store in daily aggregation bucket
  const dayKey = `analytics:day:${event.market}:${new Date(event.timestamp).toISOString().substring(0, 10)}`;
  const existing = await kv.get(dayKey);
  const dayData = existing ? JSON.parse(existing) : { events: [] };
  dayData.events.push(event);
  await kv.put(dayKey, JSON.stringify(dayData), { expirationTtl: 2592000 });
}

/**
 * Bulk import analytics from CSV
 * Format: Job ID,Market,Variant,Views,CTR (%),Engagement Rate (%)
 */
export async function importAnalyticsCSV(
  csvContent: string,
  kv: KVNamespace
): Promise<{ imported: number; errors: string[] }> {
  const lines = csvContent.trim().split("\n");
  let imported = 0;
  const errors: string[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    try {
      const [jobId, market, variant, viewsStr, ctrStr, engagementStr] = lines[i].split(",");
      
      if (!jobId || !market) {
        errors.push(`Line ${i + 1}: Missing required fields`);
        continue;
      }

      const event: AnalyticsEvent = {
        jobId: jobId.trim(),
        market: market.trim(),
        variant: variant?.trim() || "default",
        views: parseInt(viewsStr) || 0,
        ctr: parseFloat(ctrStr) || 0,
        engagementRate: parseFloat(engagementStr) || 0,
        timestamp: Date.now(),
        source: "manual"
      };

      await storeAnalyticsEvent(event, kv);
      imported++;
    } catch (err) {
      errors.push(`Line ${i + 1}: ${(err as Error).message}`);
    }
  }

  return { imported, errors };
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(kv: KVNamespace): Promise<AnalyticsSummary> {
  const list = await kv.list({ prefix: "analytics:" });
  const events: AnalyticsEvent[] = [];

  for (const key of list.keys) {
    if (key.name.startsWith("analytics:day:")) continue; // Skip aggregation keys
    const value = await kv.get(key.name);
    if (value) {
      try {
        events.push(JSON.parse(value));
      } catch {}
    }
  }

  if (events.length === 0) {
    return {
      avgCTR: 0,
      avgEngagement: 0,
      totalViews: 0,
      videosPublished: 0,
      byMarket: {}
    };
  }

  const avgCTR = events.reduce((sum, e) => sum + e.ctr, 0) / events.length;
  const avgEngagement = events.reduce((sum, e) => sum + e.engagementRate, 0) / events.length;
  const totalViews = events.reduce((sum, e) => sum + e.views, 0);

  // By market
  const byMarket: Record<string, any> = {};
  const marketGroups: Record<string, AnalyticsEvent[]> = {};
  events.forEach(e => {
    if (!marketGroups[e.market]) marketGroups[e.market] = [];
    marketGroups[e.market].push(e);
  });

  Object.entries(marketGroups).forEach(([market, marketEvents]) => {
    byMarket[market] = {
      avgCTR: marketEvents.reduce((sum, e) => sum + e.ctr, 0) / marketEvents.length,
      avgEngagement: marketEvents.reduce((sum, e) => sum + e.engagementRate, 0) / marketEvents.length,
      videos: marketEvents.length
    };
  });

  return {
    avgCTR,
    avgEngagement,
    totalViews,
    videosPublished: events.length,
    byMarket
  };
}

/**
 * Update A/B variant weights based on performance
 * Automatically favors winning variants
 */
export async function updateVariantWeights(kv: KVNamespace): Promise<void> {
  const analytics = await getAnalyticsSummary(kv);
  
  const variantPerformance: Record<string, { score: number; count: number }> = {};

  // Get all variant events
  const list = await kv.list({ prefix: "analytics:" });
  for (const key of list.keys) {
    if (key.name.startsWith("analytics:day:")) continue;
    const value = await kv.get(key.name);
    if (value) {
      try {
        const event: AnalyticsEvent = JSON.parse(value);
        const key_ = `${event.market}:${event.variant}`;
        if (!variantPerformance[key_]) {
          variantPerformance[key_] = { score: 0, count: 0 };
        }
        // Score = CTR * 0.6 + Engagement * 0.4
        variantPerformance[key_].score += (event.ctr * 0.6 + event.engagementRate * 0.4);
        variantPerformance[key_].count++;
      } catch {}
    }
  }

  // Calculate new weights
  const weights: Record<string, number> = {};
  Object.entries(variantPerformance).forEach(([key, perf]) => {
    weights[key] = perf.score / perf.count;
  });

  // Normalize to probabilities
  const totalScore = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalScore > 0) {
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / totalScore;
    });
  }

  // Store weights
  await kv.put("config:variant_weights", JSON.stringify(weights), {
    expirationTtl: 2592000
  });

  console.log("✅ Variant weights updated:", weights);
}

/**
 * Get recommended variant for market
 */
export async function getRecommendedVariant(
  market: string,
  kv: KVNamespace
): Promise<string> {
  const weightsStr = await kv.get("config:variant_weights");
  if (!weightsStr) return "default";

  const weights = JSON.parse(weightsStr);
  const marketVariants = Object.entries(weights)
    .filter(([key]) => key.startsWith(`${market}:`))
    .sort(([, a], [, b]) => (b as number) - (a as number));

  if (marketVariants.length === 0) return "default";

  // Weighted random selection
  const rand = Math.random();
  let cumulative = 0;
  for (const [key, weight] of marketVariants) {
    cumulative += weight as number;
    if (rand <= cumulative) {
      return key.split(":")[1];
    }
  }

  return marketVariants[0][0].split(":")[1];
}

/**
 * Weekly aggregation cron job
 * Aggregates analytics data and updates variant weights
 */
export async function runWeeklyAggregation(kv: KVNamespace): Promise<void> {
  console.log("📊 Running weekly aggregation...");

  // Update variant weights
  await updateVariantWeights(kv);

  // Generate weekly summary
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const list = await kv.list({ prefix: "analytics:" });
  const weekEvents: AnalyticsEvent[] = [];

  for (const key of list.keys) {
    if (key.name.startsWith("analytics:day:")) continue;
    const value = await kv.get(key.name);
    if (value) {
      try {
        const event: AnalyticsEvent = JSON.parse(value);
        if (event.timestamp >= weekAgo.getTime()) {
          weekEvents.push(event);
        }
      } catch {}
    }
  }

  // Store weekly summary
  const summary = {
    period: `${weekAgo.toISOString().substring(0, 10)} to ${now.toISOString().substring(0, 10)}`,
    totalVideos: weekEvents.length,
    avgCTR: weekEvents.reduce((sum, e) => sum + e.ctr, 0) / (weekEvents.length || 1),
    avgEngagement: weekEvents.reduce((sum, e) => sum + e.engagementRate, 0) / (weekEvents.length || 1),
    totalViews: weekEvents.reduce((sum, e) => sum + e.views, 0),
    byMarket: {} as Record<string, number>
  };

  weekEvents.forEach(e => {
    summary.byMarket[e.market] = (summary.byMarket[e.market] || 0) + 1;
  });

  await kv.put(`analytics:weekly_agg:${now.toISOString().substring(0, 10)}`, JSON.stringify(summary), {
    expirationTtl: 7776000
  });

  console.log("✅ Weekly aggregation complete:", summary);
}
