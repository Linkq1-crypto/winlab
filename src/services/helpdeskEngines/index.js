/**
 * Helpdesk Engines — Central exports
 * Security, Cache, Templates, Knowledge Base, Clustering
 * Logging, Bug Detection, Churn Prediction
 */

// Security
export {
  checkRateLimit,
  detectAnomaly,
  updateReputation,
  getReputation,
  getReputationInfo,
  reputationLevel,
  checkBlacklist,
  blacklistEmail,
  unblacklistEmail,
  getBlacklistInfo,
  getBlacklistList,
  runSecurityPipeline,
  getSecurityStats,
  cleanupRateLimits,
} from './security.js';

// Semantic Cache
export {
  findCachedReply,
  saveToCache,
  recordFeedback,
  getCacheStats,
  clearCache,
  cosineSimilarity,
  applyDecay,
} from './cache.js';

// Templates
export {
  addTemplate,
  getSuggestedTemplates,
  trackTemplateUsage,
  getTopTemplates,
  promoteToTemplate,
  fillTemplate,
  analyzePromptFeedback,
  getAllTemplates,
  deleteTemplate,
} from './templates.js';

// Knowledge Base
export {
  shouldPromoteToKB,
  generateKBArticle,
  searchKB,
  trackArticleUsage,
  getKBStats,
  getAllArticles,
  getArticle,
} from './knowledgeBase.js';

// Clustering + FAQ
export {
  generateFAQs,
  promoteFAQToKB,
  getAllFAQs,
  clusterTickets,
  generateInsights,
} from './clustering.js';

// Logging (foundation)
export {
  saveLog,
  getLogs,
  getUserLogs,
  getTimeSeries,
  groupByField,
  calculateKPIs,
  getLogCount,
  pruneLogs,
} from './logging.js';

// Bug Detection + Deploy Correlation
export {
  recordDeploy,
  getRecentDeploys,
  findDeployAt,
  detectSpike,
  detectAllSpikes,
  isDeployRelated,
  getDeployImpact,
  getDeployHistory,
} from './bugDetection.js';

// Churn Prediction + User Segmentation
export {
  updateUserProfile,
  recordTicketEvent,
  getUserProfile,
  getAtRiskUsers,
  getChurnStats,
  getChurnLevel,
  batchUpdateUsage,
} from './churnPrediction.js';
