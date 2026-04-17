/**
 * Churn Prediction Engine — User risk scoring
 * Identifies users at risk of leaving based on support patterns
 */

const userProfiles = new Map();

/**
 * Update or create a user profile from support activity
 * @param {object} params
 * @param {string} params.email - User email
 * @param {string} [params.userId] - User ID
 * @param {string} [params.plan] - Plan (free/pro/business)
 * @param {object} [params.usage] - Usage stats { logins, labCompletions, lastActive }
 */
export function updateUserProfile(params) {
  const { email, userId, plan, usage } = params;
  const key = userId || email.toLowerCase();

  let profile = userProfiles.get(key);

  if (!profile) {
    profile = {
      email: email.toLowerCase(),
      userId: userId || null,
      plan: plan || 'free',
      tickets: 0,
      resolvedTickets: 0,
      openTickets: 0,
      lastTicketAt: 0,
      firstTicketAt: 0,
      sentimentSum: 0,
      sentimentCount: 0,
      usageDrop: false,
      repeatIssues: {},
      lastActive: Date.now(),
      churnScore: 0,
      churnLevel: 'low',
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    userProfiles.set(key, profile);
  }

  // Update fields
  if (plan) profile.plan = plan;
  if (usage) {
    if (usage.lastActive) profile.lastActive = usage.lastActive;
    if (usage.logins != null) profile.usageLogins = usage.logins;
    if (usage.labCompletions != null) profile.usageLabCompletions = usage.labCompletions;
  }

  profile.updatedAt = Date.now();
  return profile;
}

/**
 * Record a ticket event for a user
 * @param {string} email
 * @param {object} params
 * @param {string} params.intent
 * @param {number} [params.sentiment] - -1 to 1
 * @param {boolean} [params.resolved]
 * @param {string} [params.plan]
 */
export function recordTicketEvent(email, params) {
  const profile = updateUserProfile({ email, plan: params.plan });

  profile.tickets += 1;
  if (params.resolved) profile.resolvedTickets += 1;
  else profile.openTickets += 1;

  profile.lastTicketAt = Date.now();
  if (!profile.firstTicketAt) profile.firstTicketAt = Date.now();

  if (params.sentiment != null) {
    profile.sentimentSum += params.sentiment;
    profile.sentimentCount += 1;
  }

  // Track repeat issues
  const intent = params.intent || 'other';
  profile.repeatIssues[intent] = (profile.repeatIssues[intent] || 0) + 1;

  // Update churn score
  profile.churnScore = calculateChurnScore(profile);
  profile.churnLevel = getChurnLevel(profile.churnScore);

  return profile;
}

/**
 * Calculate churn risk score (0-100)
 * @param {object} profile
 * @returns {number}
 */
function calculateChurnScore(profile) {
  let score = 0;

  // Ticket volume (more tickets = higher risk)
  if (profile.tickets > 5) score += 15;
  else if (profile.tickets > 3) score += 10;
  else if (profile.tickets > 1) score += 5;

  // Open unresolved tickets
  if (profile.openTickets > 2) score += 20;
  else if (profile.openTickets > 0) score += 10;

  // Negative sentiment
  if (profile.sentimentCount > 0) {
    const avgSentiment = profile.sentimentSum / profile.sentimentCount;
    if (avgSentiment < -0.5) score += 25;
    else if (avgSentiment < -0.2) score += 15;
    else if (avgSentiment < 0) score += 8;
  }

  // Repeat issues (same problem multiple times)
  const repeatCount = Object.values(profile.repeatIssues).filter(c => c > 1).length;
  if (repeatCount > 2) score += 15;
  else if (repeatCount > 0) score += 8;

  // Usage drop
  if (profile.usageDrop) score += 25;

  // Inactivity
  if (profile.lastActive && Date.now() - profile.lastActive > 14 * 24 * 60 * 60 * 1000) {
    score += 15; // 14+ days inactive
  }

  // Free plan users are naturally higher churn
  if (profile.plan === 'free') score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Get churn level from score
 * @param {number} score
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function getChurnLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Get user profile
 * @param {string} email
 * @returns {object|null}
 */
export function getUserProfile(email) {
  // Try exact match first, then partial
  const key = email.toLowerCase();
  let profile = userProfiles.get(key);

  if (!profile) {
    // Try finding by partial match
    for (const [k, p] of userProfiles.entries()) {
      if (k.includes(key) || key.includes(k)) {
        profile = p;
        break;
      }
    }
  }

  return profile || null;
}

/**
 * Get users at risk
 * @param {string} [level] - 'high' | 'medium' | 'low' or all
 * @returns {Array}
 */
export function getAtRiskUsers(level) {
  const all = Array.from(userProfiles.values());
  let filtered = all;

  if (level) {
    filtered = all.filter(p => p.churnLevel === level);
  }

  filtered.sort((a, b) => b.churnScore - a.churnScore);
  return filtered.map(p => ({
    email: p.email,
    plan: p.plan,
    churnScore: p.churnScore,
    churnLevel: p.churnLevel,
    tickets: p.tickets,
    openTickets: p.openTickets,
    avgSentiment: p.sentimentCount > 0 ? Math.round(p.sentimentSum / p.sentimentCount * 100) / 100 : null,
    repeatIssues: Object.entries(p.repeatIssues)
      .filter(([, c]) => c > 1)
      .map(([intent, count]) => ({ intent, count })),
    lastActive: p.lastActive,
  }));
}

/**
 * Get churn stats
 * @returns {object}
 */
export function getChurnStats() {
  const all = Array.from(userProfiles.values());
  const high = all.filter(p => p.churnLevel === 'high').length;
  const medium = all.filter(p => p.churnLevel === 'medium').length;
  const low = all.filter(p => p.churnLevel === 'low').length;

  const avgScore = all.length > 0
    ? Math.round(all.reduce((s, p) => s + p.churnScore, 0) / all.length)
    : 0;

  // By plan
  const byPlan = {};
  for (const p of all) {
    if (!byPlan[p.plan]) byPlan[p.plan] = { count: 0, highRisk: 0, avgScore: 0 };
    byPlan[p.plan].count += 1;
    if (p.churnLevel === 'high') byPlan[p.plan].highRisk += 1;
    byPlan[p.plan].avgScore += p.churnScore;
  }
  for (const plan of Object.keys(byPlan)) {
    byPlan[plan].avgScore = Math.round(byPlan[plan].avgScore / byPlan[plan].count);
    byPlan[plan].highRiskPercent = Math.round(byPlan[plan].highRisk / byPlan[plan].count * 100);
  }

  return {
    totalUsers: all.length,
    high,
    medium,
    low,
    avgScore,
    byPlan,
    topAtRisk: getAtRiskUsers('high').slice(0, 10),
  };
}

/**
 * Update usage data for all users
 * @param {Array} users - [{ email, plan, usage: { logins, lastActive, ... } }]
 */
export function batchUpdateUsage(users) {
  for (const u of users) {
    updateUserProfile({
      email: u.email,
      plan: u.plan,
      usage: u.usage,
    });

    // Detect usage drop (compare to their own baseline)
    const profile = userProfiles.get(u.email.toLowerCase());
    if (profile && u.usage?.logins != null && profile.usageLogins != null) {
      const drop = profile.usageLogins > 0 && u.usage.logins < profile.usageLogins * 0.5;
      profile.usageDrop = drop;
      profile.churnScore = calculateChurnScore(profile);
      profile.churnLevel = getChurnLevel(profile.churnScore);
    }
  }
}

export default {
  updateUserProfile,
  recordTicketEvent,
  getUserProfile,
  getAtRiskUsers,
  getChurnStats,
  getChurnLevel,
  batchUpdateUsage,
};
