/**
 * FAQ Generator + Clustering Engine
 * Extracts FAQs from conversation logs, clusters similar tickets
 */

// ──── FAQ Generator ────

const faqs = new Map();
let faqCounter = 0;

/**
 * Generate FAQ suggestions from recent ticket logs
 * @param {Array} tickets - Array of { subject, body, reply, intent }
 * @returns {Array} Suggested FAQs [{ question, answer, intent, frequency }]
 */
export function generateFAQs(tickets) {
  if (!tickets || tickets.length < 2) return [];

  // Group by intent
  const byIntent = {};
  for (const t of tickets) {
    const intent = t.intent || 'other';
    if (!byIntent[intent]) byIntent[intent] = [];
    byIntent[intent].push(t);
  }

  const suggestions = [];

  for (const [intent, group] of Object.entries(byIntent)) {
    if (group.length < 2) continue;

    // Find common subjects
    const subjectMap = {};
    for (const t of group) {
      const normalized = normalizeSubject(t.subject);
      if (!subjectMap[normalized]) subjectMap[normalized] = [];
      subjectMap[normalized].push(t);
    }

    for (const [key, items] of Object.entries(subjectMap)) {
      if (items.length < 2) continue;

      // Use most recent reply as answer
      const sorted = items.sort((a, b) => b.createdAt - a.createdAt);
      const bestReply = sorted[0];

      const faqId = `faq_${++faqCounter}`;
      const faq = {
        id: faqId,
        question: key,
        answer: extractAnswer(bestReply.reply),
        intent,
        frequency: items.length,
        lang: detectLang(items[0].body),
        sourceTickets: items.map(t => t.id),
        createdAt: Date.now(),
        promoted: false,
      };

      faqs.set(faqId, faq);
      suggestions.push(faq);
    }
  }

  // Sort by frequency
  suggestions.sort((a, b) => b.frequency - a.frequency);
  return suggestions;
}

/**
 * Promote FAQ to KB article
 * @param {string} faqId
 * @returns {object|null} Promoted article or null
 */
export function promoteFAQToKB(faqId) {
  const faq = faqs.get(faqId);
  if (!faq) return null;

  faq.promoted = true;
  return {
    title: faq.question,
    problem: faq.question,
    solution: faq.answer,
    intent: faq.intent,
    lang: faq.lang,
    source: 'faq',
  };
}

/**
 * Get all FAQs
 * @returns {Array}
 */
export function getAllFAQs() {
  return Array.from(faqs.values()).sort((a, b) => b.frequency - a.frequency);
}

// ──── Clustering Engine ────

/**
 * Cluster tickets by topic similarity
 * @param {Array} tickets - Array of { subject, body, intent }
 * @param {number} [maxClusters=8]
 * @returns {Array} Clusters with topic, count, tickets
 */
export function clusterTickets(tickets, maxClusters = 8) {
  if (!tickets || tickets.length < 2) return [];

  // Simple keyword-based clustering
  const clusters = [];

  for (const ticket of tickets) {
    const keywords = extractKeywords(ticket.subject + ' ' + (ticket.body || ''));

    // Find best matching cluster
    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const overlap = keywords.filter(k => cluster.keywords.includes(k)).length;
      const score = overlap / Math.max(keywords.length, cluster.keywords.length);
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.tickets.push(ticket.id);
      // Update cluster keywords
      for (const kw of keywords) {
        if (!bestCluster.keywords.includes(kw)) {
          bestCluster.keywords.push(kw);
        }
      }
    } else {
      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        keywords,
        tickets: [ticket.id],
        intent: ticket.intent,
      });
    }
  }

  // Limit clusters
  clusters.sort((a, b) => b.tickets.length - a.tickets.length);
  const topClusters = clusters.slice(0, maxClusters);

  // Generate topic labels
  for (const cluster of topClusters) {
    cluster.topic = generateTopicLabel(cluster);
    cluster.count = cluster.tickets.length;
  }

  return topClusters;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'about', 'i', 'me', 'my',
    'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him', 'his', 'she',
    'her', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
    'whom', 'this', 'that', 'these', 'those', 'am',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-zàèéìòù\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Return unique words
  return [...new Set(words)].slice(0, 20);
}

/**
 * Generate a topic label from cluster keywords
 */
function generateTopicLabel(cluster) {
  const { intent, keywords } = cluster;

  // Intent-based labels
  const intentLabels = {
    bug: 'Bug Reports',
    payment: 'Payment Issues',
    question: 'General Questions',
    feature_request: 'Feature Requests',
    complaint: 'Complaints',
    other: 'Other',
  };

  if (intent && intentLabels[intent]) {
    return `${intentLabels[intent]} (${cluster.tickets.length})`;
  }

  // Fallback: use top keywords
  return `Cluster: ${keywords.slice(0, 3).join(', ')} (${cluster.tickets.length})`;
}

/**
 * Normalize subject for grouping
 */
function normalizeSubject(subject) {
  return subject
    .replace(/^(re|fwd|fw):\s*/i, '')
    .toLowerCase()
    .trim()
    .slice(0, 50);
}

/**
 * Extract answer from reply text
 */
function extractAnswer(reply) {
  if (!reply) return '';

  let clean = reply
    .replace(/^(Hi|Hello|Ciao|Hola)\s+\w+,?/i, '')
    .replace(/—\s*Winlab\s+\w+\s*Team\s*$/i, '')
    .replace(/Best regards,?\s*Winlab.*/i, '')
    .trim();

  return clean.slice(0, 500);
}

/**
 * Detect language
 */
function detectLang(text) {
  if (!text) return 'en';
  const lower = text.toLowerCase();
  if (['ciao', 'buongiorno', 'grazie', 'problema'].some(w => lower.includes(w))) return 'it';
  if (['hola', 'gracias', 'problema', 'ayuda'].some(w => lower.includes(w))) return 'es';
  return 'en';
}

// ──── Insight Generation ────

/**
 * Generate business insights from ticket data
 * @param {Array} tickets
 * @returns {object} Insights
 */
export function generateInsights(tickets) {
  if (!tickets || tickets.length === 0) return { insights: [] };

  const insights = [];

  // Top issues
  const clusters = clusterTickets(tickets);
  if (clusters.length > 0) {
    const top = clusters[0];
    insights.push({
      type: 'top_issue',
      message: `Top issue: ${top.topic}`,
      severity: top.count > 10 ? 'high' : top.count > 5 ? 'medium' : 'low',
    });
  }

  // Response time trend
  const withReplies = tickets.filter(t => t.replies?.length > 0);
  if (withReplies.length > 0) {
    const avgTime = withReplies.reduce((sum, t) => {
      return sum + (t.replies[0]?.sentAt - t.createdAt);
    }, 0) / withReplies.length;

    const avgMin = Math.round(avgTime / 60000);
    insights.push({
      type: 'response_time',
      message: `Average response time: ${avgMin} minutes`,
      severity: avgMin > 120 ? 'high' : avgMin > 60 ? 'medium' : 'low',
    });
  }

  // Trust distribution
  const lowTrust = tickets.filter(t => t.trust?.level === 'low').length;
  if (lowTrust > tickets.length * 0.2) {
    insights.push({
      type: 'security',
      message: `${Math.round(lowTrust / tickets.length * 100)}% of tickets have low trust — consider tightening filters`,
      severity: 'medium',
    });
  }

  return { insights, clusters };
}

export default {
  generateFAQs,
  promoteFAQToKB,
  getAllFAQs,
  clusterTickets,
  generateInsights,
};
