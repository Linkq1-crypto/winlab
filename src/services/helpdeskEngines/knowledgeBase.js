/**
 * Knowledge Base Engine — Auto-generates KB articles from resolved tickets
 * Turns real support responses into structured documentation
 */

const kbArticles = new Map();
let kbCounter = 0;

/**
 * Check if a response pattern qualifies for KB promotion
 * @param {object} ticketData - { intent, reply, uses, successRate }
 * @returns {boolean}
 */
export function shouldPromoteToKB(ticketData) {
  return ticketData.uses >= 5 && ticketData.successRate >= 0.7;
}

/**
 * Generate a KB article from a resolved ticket
 * @param {object} params
 * @param {string} params.subject - Original ticket subject
 * @param {string} params.body - Original ticket body
 * @param {string} params.reply - Resolution reply
 * @param {string} params.intent - Detected intent
 * @param {string} params.lang - Language
 * @param {string} params.team - Team
 * @returns {Promise<object>} Generated article
 */
export async function generateKBArticle(params) {
  const { subject, body, reply, intent, lang, team } = params;
  const id = `kb_${++kbCounter}`;

  // Extract problem and solution
  const article = {
    id,
    title: generateTitle(subject, intent),
    problem: extractProblem(body),
    solution: extractSolution(reply),
    steps: generateSteps(reply),
    intent,
    lang,
    team,
    uses: 0,
    successRate: 0,
    successes: 0,
    failures: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'auto-generated',
    relatedTickets: [],
  };

  kbArticles.set(id, article);
  return article;
}

/**
 * Generate a KB article title from subject + intent
 */
function generateTitle(subject, intent) {
  const intentTitles = {
    bug: 'How to fix',
    payment: 'Payment issue',
    question: 'FAQ',
    feature_request: 'Feature',
    complaint: 'Issue resolution',
    other: 'Support guide',
  };

  const prefix = intentTitles[intent] || 'Support guide';
  const cleanSubject = subject
    .replace(/^(re|fwd|fw):\s*/i, '')
    .replace(/[!?]+/g, '')
    .trim();

  return `${prefix}: ${cleanSubject}`;
}

/**
 * Extract problem description from ticket body
 */
function extractProblem(body) {
  if (!body) return 'User reported an issue';

  // Take first 2 sentences as problem summary
  const sentences = body.split(/[.!?]+/).filter(s => s.trim());
  return sentences.slice(0, 2).join('. ').trim().slice(0, 300);
}

/**
 * Extract solution from reply
 */
function extractSolution(reply) {
  if (!reply) return 'Issue was investigated and resolved';

  // Remove greeting and signature
  let clean = reply
    .replace(/^(Hi|Hello|Ciao|Hola)\s+\w+,?/i, '')
    .replace(/—\s*Winlab\s+\w+\s*Team\s*$/i, '')
    .replace(/Best regards,?\s*Winlab.*/i, '')
    .trim();

  return clean.slice(0, 500);
}

/**
 * Generate troubleshooting steps from reply
 */
function generateSteps(reply) {
  if (!reply) return [];

  const lines = reply.split('\n').filter(l => l.trim());
  const steps = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && !trimmed.startsWith('Hi') && !trimmed.startsWith('—') && !trimmed.startsWith('Best')) {
      steps.push(trimmed);
    }
  }

  return steps.slice(0, 8);
}

/**
 * Search KB articles
 * @param {object} params
 * @param {string} params.query - Search query
 * @param {string} [params.intent] - Intent filter
 * @param {string} [params.lang] - Language filter
 * @param {string} [params.team] - Team filter
 * @returns {Array} Matching articles
 */
export function searchKB(params) {
  const { query, intent, lang, team } = params;
  const all = Array.from(kbArticles.values());

  let results = all;

  if (intent) results = results.filter(a => a.intent === intent);
  if (lang) results = results.filter(a => a.lang === lang);
  if (team) results = results.filter(a => a.team === team);

  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(a =>
      a.title.toLowerCase().includes(lowerQuery) ||
      a.problem.toLowerCase().includes(lowerQuery) ||
      a.solution.toLowerCase().includes(lowerQuery) ||
      a.steps.some(s => s.toLowerCase().includes(lowerQuery))
    );
  }

  // Sort by uses (most helpful first)
  results.sort((a, b) => b.uses - a.uses);
  return results;
}

/**
 * Track article usage
 * @param {string} articleId
 * @param {boolean} helpful
 */
export function trackArticleUsage(articleId, helpful = true) {
  const article = kbArticles.get(articleId);
  if (!article) return;

  article.uses += 1;
  if (helpful) {
    article.successes += 1;
  } else {
    article.failures += 1;
  }

  const total = article.successes + article.failures;
  article.successRate = total > 0 ? article.successes / total : 0;
  article.updatedAt = Date.now();
}

/**
 * Get KB stats
 * @returns {object}
 */
export function getKBStats() {
  const all = Array.from(kbArticles.values());

  const byIntent = {};
  const byLang = {};
  const byTeam = {};
  let totalUses = 0;

  for (const a of all) {
    byIntent[a.intent] = (byIntent[a.intent] || 0) + 1;
    byLang[a.lang] = (byLang[a.lang] || 0) + 1;
    byTeam[a.team] = (byTeam[a.team] || 0) + 1;
    totalUses += a.uses;
  }

  return {
    totalArticles: all.length,
    totalUses,
    avgSuccessRate: all.length
      ? Math.round(all.reduce((s, a) => s + a.successRate, 0) / all.length * 100) / 100
      : 0,
    byIntent,
    byLang,
    byTeam,
    topArticles: all
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5)
      .map(a => ({ id: a.id, title: a.title, uses: a.uses })),
  };
}

/**
 * Get all articles
 * @returns {Array}
 */
export function getAllArticles() {
  return Array.from(kbArticles.values());
}

/**
 * Get article by ID
 * @param {string} id
 * @returns {object|null}
 */
export function getArticle(id) {
  return kbArticles.get(id) || null;
}

export default {
  shouldPromoteToKB,
  generateKBArticle,
  searchKB,
  trackArticleUsage,
  getKBStats,
  getAllArticles,
  getArticle,
};
