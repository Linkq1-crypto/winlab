/**
 * Template Engine — Smart suggestion + auto-prompt optimization
 * Learns from user corrections, promotes frequent replies to templates
 */

// ──── Template Store ────
const templates = new Map();
let templateCounter = 0;

/**
 * Register a new template
 * @param {object} params
 * @param {string} params.intent - Intent this template addresses
 * @param {string} params.lang - Language code
 * @param {string} params.template - Template text (with {{name}}, etc.)
 * @param {string} params.team - Team name
 * @returns {string} Template ID
 */
export function addTemplate(params) {
  const id = `tpl_${++templateCounter}`;
  templates.set(id, {
    id,
    intent: params.intent,
    lang: params.lang || 'en',
    template: params.template,
    team: params.team || 'support',
    uses: 0,
    successRate: 0,
    successes: 0,
    failures: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isAuto: params.isAuto || false,
  });
  return id;
}

/**
 * Get suggested templates for an intent/language
 * @param {string} intent
 * @param {string} lang
 * @param {number} [limit=5]
 * @returns {Array} Sorted by usage
 */
export function getSuggestedTemplates(intent, lang, limit = 5) {
  const all = Array.from(templates.values());
  const matching = all.filter(t => {
    const intentMatch = t.intent === intent || t.intent === 'general';
    const langMatch = t.lang === lang || t.lang === 'en';
    return intentMatch && langMatch;
  });

  // Sort by uses (most used first)
  matching.sort((a, b) => b.uses - a.uses);
  return matching.slice(0, limit);
}

/**
 * Track template usage
 * @param {string} templateId
 * @param {boolean} success - Was the reply successful?
 */
export function trackTemplateUsage(templateId, success = true) {
  const tpl = templates.get(templateId);
  if (!tpl) return;

  tpl.uses += 1;
  if (success) {
    tpl.successes += 1;
  } else {
    tpl.failures += 1;
  }

  const total = tpl.successes + tpl.failures;
  tpl.successRate = total > 0 ? tpl.successes / total : 0;
  tpl.updatedAt = Date.now();
}

/**
 * Get top templates by usage
 * @param {number} [limit=10]
 * @returns {Array}
 */
export function getTopTemplates(limit = 10) {
  const all = Array.from(templates.values());
  all.sort((a, b) => b.uses - a.uses);
  return all.slice(0, limit).map(t => ({
    id: t.id,
    intent: t.intent,
    lang: t.lang,
    team: t.team,
    uses: t.uses,
    successRate: Math.round(t.successRate * 100),
    preview: t.template.slice(0, 80) + '...',
    isAuto: t.isAuto,
  }));
}

/**
 * Promote a frequently used response to template
 * @param {object} params
 * @param {string} params.response - The response text
 * @param {string} params.intent - Detected intent
 * @param {string} params.lang - Language
 * @param {string} params.team - Team
 * @param {number} params.uses - How many times this response was used
 * @returns {string|null} Template ID or null if not qualified
 */
export function promoteToTemplate(params) {
  const { response, intent, lang, team, uses = 1 } = params;

  // Threshold: at least 3 uses to become a template
  if (uses < 3) return null;

  const id = addTemplate({
    intent,
    lang,
    template: response,
    team,
    isAuto: true,
  });

  return id;
}

/**
 * Fill template variables
 * @param {string} template - Template text with {{name}}, {{team}}, etc.
 * @param {object} vars - Variable values
 * @returns {string} Filled template
 */
export function fillTemplate(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * Get prompt optimization suggestions based on feedback logs
 * @param {Array} logs - Recent feedback logs
 * @returns {string[]} Suggested prompt improvements
 */
export function analyzePromptFeedback(logs) {
  if (!logs || logs.length === 0) return [];

  const improvements = [];

  // Analyze common edits
  const edits = logs.filter(l => l.edited && l.originalReply && l.finalReply);

  if (edits.length > 5) {
    // Check if users consistently add something
    const additions = edits.filter(e =>
      e.finalReply.length > e.originalReply.length * 1.2
    );
    if (additions.length / edits.length > 0.6) {
      improvements.push('Users tend to add more detail — consider making AI responses more comprehensive');
    }

    // Check if users consistently remove something
    const deletions = edits.filter(e =>
      e.finalReply.length < e.originalReply.length * 0.8
    );
    if (deletions.length / edits.length > 0.6) {
      improvements.push('Users tend to shorten responses — consider making AI more concise');
    }
  }

  // Check tone complaints
  const toneIssues = logs.filter(l =>
    l.feedback?.toLowerCase().includes('too formal') ||
    l.feedback?.toLowerCase().includes('too casual') ||
    l.feedback?.toLowerCase().includes('tone')
  );
  if (toneIssues.length > logs.length * 0.2) {
    improvements.push('Tone adjustment needed — 20%+ of responses required tone correction');
  }

  return improvements;
}

/**
 * Get all templates for admin view
 * @returns {Array}
 */
export function getAllTemplates() {
  return Array.from(templates.values()).map(t => ({
    ...t,
    templatePreview: t.template.slice(0, 100) + (t.template.length > 100 ? '...' : ''),
  }));
}

/**
 * Delete a template
 * @param {string} id
 */
export function deleteTemplate(id) {
  return templates.delete(id);
}

// ──── Seed default templates ────
function seedDefaults() {
  addTemplate({
    intent: 'payment',
    lang: 'en',
    team: 'billing',
    template: 'Hi {{name}},\n\nWe\'ve reviewed your payment concern. Our team is investigating the issue and will update you within 24 hours.\n\nIf you need immediate assistance, please reply to this email.\n\n— Winlab Billing Team',
  });

  addTemplate({
    intent: 'payment',
    lang: 'it',
    team: 'billing',
    template: 'Ciao {{name}},\n\nAbbiamo verificato il tuo problema di pagamento. Il nostro team sta analizzando la situazione e ti aggiornerà entro 24 ore.\n\nPer assistenza immediata, rispondi a questa email.\n\n— Winlab Billing Team',
  });

  addTemplate({
    intent: 'bug',
    lang: 'en',
    team: 'support',
    template: 'Hi {{name}},\n\nThanks for reporting this issue. Our engineering team is investigating and we\'ll provide an update as soon as we have more information.\n\nCould you share any error messages or screenshots? This helps us diagnose faster.\n\n— Winlab Support Team',
  });

  addTemplate({
    intent: 'bug',
    lang: 'it',
    team: 'support',
    template: 'Ciao {{name}},\n\nGrazie per aver segnalato il problema. Il nostro team tecnico sta indagando e ti aggiornerà appena possibile.\n\nPotresti condividere eventuali messaggi di errore o screenshot? Ci aiuta a diagnosticare più velocemente.\n\n— Winlab Support Team',
  });

  addTemplate({
    intent: 'question',
    lang: 'en',
    team: 'support',
    template: 'Hi {{name}},\n\nThanks for reaching out! We\'re happy to help.\n\n{{answer}}\n\nIf you have any other questions, don\'t hesitate to ask.\n\n— Winlab Support Team',
  });

  addTemplate({
    intent: 'feature_request',
    lang: 'en',
    team: 'support',
    template: 'Hi {{name}},\n\nThanks for the suggestion! We love hearing ideas from our community.\n\nI\'ve passed this along to our product team for consideration. While I can\'t guarantee a timeline, we track all feature requests carefully.\n\n— Winlab Support Team',
  });

  addTemplate({
    intent: 'complaint',
    lang: 'en',
    team: 'support',
    template: 'Hi {{name}},\n\nI\'m sorry to hear about your experience. This isn\'t the standard we aim for.\n\nI\'m personally escalating this to ensure it gets resolved quickly. You can expect a follow-up within 24 hours.\n\n— Winlab Support Team',
  });
}

seedDefaults();

export default {
  addTemplate,
  getSuggestedTemplates,
  trackTemplateUsage,
  getTopTemplates,
  promoteToTemplate,
  fillTemplate,
  analyzePromptFeedback,
  getAllTemplates,
  deleteTemplate,
};
