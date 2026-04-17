/**
 * A/B Testing Auto-Regulation
 * Composite scoring + intelligent weight adjustment
 * Prevents overfitting with minimum sample sizes & weekly cooldown
 */

import { cachedKVGet } from "./kv-cache";

interface VariantPerformance {
  market: string;
  variant: string;
  videos: number;
  avgCTR: number;
  avgEngagement: number;
  avgViews: number;
  compositeScore: number;
}

interface RoutingWeights {
  [market: string]: {
    [variant: string]: number;
  };
}

/**
 * Assign variant to job based on current routing weights
 * Uses weighted random selection favoring winners
 * Falls back to balanced A/B if insufficient data
 */
export async function assignVariant(
  market: string,
  kv: KVNamespace
): Promise<string> {
  // Use cached read (weights change weekly, cache for 5 min)
  const weightsStr = await cachedKVGet(kv, "config:variant_weights", { ttl: 300 });
  if (!weightsStr) return "A"; // Default to balanced

  try {
    const weights: RoutingWeights = JSON.parse(weightsStr);
    const marketWeights = weights[market];
    
    if (!marketWeights) return "A";

    // Check if we have enough data to trust weights
    const totalVideos = Object.values(marketWeights).reduce((sum, _, variant) => {
      return sum + getVideoCountForVariant(market, variant, kv);
    }, 0);

    if (totalVideos < 5) {
      console.log(`📊 ${market}: Only ${totalVideos} videos, using balanced A/B`);
      return Math.random() > 0.5 ? "A" : "B";
    }

    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [variant, weight] of Object.entries(marketWeights)) {
      cumulative += weight;
      if (rand <= cumulative) {
        return variant;
      }
    }

    // Fallback to highest weighted
    return Object.entries(marketWeights).sort((a, b) => b[1] - a[1])[0][0];
  } catch (err) {
    console.error("❌ Error assigning variant:", err);
    return Math.random() > 0.5 ? "A" : "B";
  }
}

/**
 * Get video count for a variant (from KV)
 */
async function getVideoCountForVariant(
  market: string,
  variant: string,
  kv: KVNamespace
): Promise<number> {
  try {
    const countStr = await kv.get(`stats:videos:${market}:${variant}`);
    return parseInt(countStr || "0");
  } catch {
    return 0;
  }
}

/**
 * Update variant routing based on weekly analytics
 * Composite score: CTR 40% + Engagement 40% + Views 20%
 * Includes smoothing to prevent overfitting
 */
export async function updateVariantRouting(kv: KVNamespace): Promise<{
  success: boolean;
  message: string;
  newWeights?: RoutingWeights;
}> {
  console.log("🔄 Updating A/B variant routing...");

  // Get all analytics events
  const list = await kv.list({ prefix: "analytics:" });
  const events: any[] = [];

  for (const key of list.keys) {
    if (key.name.startsWith("analytics:day:")) continue;
    if (key.name.startsWith("analytics:weekly_agg:")) continue;
    const value = await kv.get(key.name);
    if (value) {
      try {
        events.push(JSON.parse(value));
      } catch {}
    }
  }

  if (events.length === 0) {
    return { success: false, message: "No analytics data found" };
  }

  // Calculate per-market/variant performance
  const performance: Record<string, VariantPerformance> = {};

  events.forEach(event => {
    const key = `${event.market}:${event.variant}`;
    if (!performance[key]) {
      performance[key] = {
        market: event.market,
        variant: event.variant,
        videos: 0,
        avgCTR: 0,
        avgEngagement: 0,
        avgViews: 0,
        compositeScore: 0
      };
    }

    const perf = performance[key];
    perf.videos++;
    perf.avgCTR += event.ctr;
    perf.avgEngagement += event.engagementRate;
    perf.avgViews += event.views;
  });

  // Calculate averages and composite scores
  Object.values(performance).forEach(perf => {
    if (perf.videos === 0) return;
    
    perf.avgCTR /= perf.videos;
    perf.avgEngagement /= perf.videos;
    perf.avgViews /= perf.videos;

    // Composite score: CTR 40% + Engagement 40% + Normalized Views 20%
    const maxViews = Math.max(...Object.values(performance).map(p => p.avgViews));
    const normalizedViews = maxViews > 0 ? perf.avgViews / maxViews : 0;
    
    perf.compositeScore = 
      (perf.avgCTR * 0.4) +
      (perf.avgEngagement * 0.4) +
      (normalizedViews * 20 * 0.2); // Scale views to similar range
  });

  // Group by market and calculate weights
  const newWeights: RoutingWeights = {};
  
  const markets = [...new Set(Object.values(performance).map(p => p.market))];
  
  markets.forEach(market => {
    const marketVariants = Object.values(performance).filter(p => p.market === market);
    
    if (marketVariants.length < 2) {
      // Only one variant, keep balanced
      newWeights[market] = { A: 0.5, B: 0.5 };
      return;
    }

    // Check minimum sample size (5 videos per variant)
    const hasMinData = marketVariants.every(v => v.videos >= 5);
    if (!hasMinData) {
      console.log(`⚠️ ${market}: Insufficient data, keeping balanced`);
      newWeights[market] = { A: 0.5, B: 0.5 };
      return;
    }

    // Calculate raw weights from composite scores
    const totalScore = marketVariants.reduce((sum, v) => sum + v.compositeScore, 0);
    
    if (totalScore === 0) {
      newWeights[market] = { A: 0.5, B: 0.5 };
      return;
    }

    // Apply softmax with temperature (lower = more aggressive)
    const temperature = 0.5;
    const expScores = marketVariants.map(v => ({
      variant: v.variant,
      exp: Math.exp(v.compositeScore / temperature)
    }));

    const totalExp = expScores.reduce((sum, s) => sum + s.exp, 0);
    
    newWeights[market] = {};
    expScores.forEach(s => {
      newWeights[market][s.variant] = s.exp / totalExp;
    });

    console.log(`✅ ${market} weights:`, JSON.stringify(newWeights[market]));
  });

  // Store new weights
  await kv.put("config:variant_weights", JSON.stringify(newWeights), {
    expirationTtl: 2592000 // 30 days
  });

  // Store last update timestamp (prevent over-updating)
  await kv.put("config:last_routing_update", String(Date.now()), {
    expirationTtl: 2592000
  });

  return {
    success: true,
    message: `Updated weights for ${markets.length} markets`,
    newWeights
  };
}

/**
 * Get current A/B testing statistics
 */
export async function getABTestingStats(kv: KVNamespace): Promise<{
  markets: Array<{
    market: string;
    variants: Array<{
      variant: string;
      videos: number;
      avgCTR: number;
      avgEngagement: number;
      compositeScore: number;
      weight: number;
    }>;
  }>;
  lastUpdate: number | null;
}> {
  const weightsStr = await kv.get("config:variant_weights");
  const lastUpdateStr = await kv.get("config:last_routing_update");
  const weights = weightsStr ? JSON.parse(weightsStr) : {};

  // Get analytics
  const list = await kv.list({ prefix: "analytics:" });
  const events: any[] = [];
  
  for (const key of list.keys) {
    if (key.name.startsWith("analytics:day:")) continue;
    if (key.name.startsWith("analytics:weekly_agg:")) continue;
    const value = await kv.get(key.name);
    if (value) {
      try {
        events.push(JSON.parse(value));
      } catch {}
    }
  }

  // Aggregate by market/variant
  const marketStats: Record<string, Record<string, any>> = {};
  
  events.forEach(event => {
    if (!marketStats[event.market]) marketStats[event.market] = {};
    if (!marketStats[event.market][event.variant]) {
      marketStats[event.market][event.variant] = {
        videos: 0,
        totalCTR: 0,
        totalEngagement: 0,
        totalViews: 0
      };
    }

    const stat = marketStats[event.market][event.variant];
    stat.videos++;
    stat.totalCTR += event.ctr;
    stat.totalEngagement += event.engagementRate;
    stat.totalViews += event.views;
  });

  // Build response
  const markets = Object.entries(marketStats).map(([market, variants]) => ({
    market,
    variants: Object.entries(variants).map(([variant, stat]: [string, any]) => ({
      variant,
      videos: stat.videos,
      avgCTR: stat.totalCTR / stat.videos,
      avgEngagement: stat.totalEngagement / stat.videos,
      compositeScore: (stat.totalCTR / stat.videos) * 0.4 + 
                     (stat.totalEngagement / stat.videos) * 0.4 +
                     (stat.totalViews / stat.videos / 100) * 0.2,
      weight: weights[market]?.[variant] || 0.5
    }))
  }));

  return {
    markets,
    lastUpdate: lastUpdateStr ? parseInt(lastUpdateStr) : null
  };
}
