/**
 * AI Classifier — Email classification with confidence scoring
 * Determines team, intent, language, and whether to auto-reply
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Classify an email using AI
 * @param {object} params
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body
 * @param {string} [params.fromName] - Extracted sender name
 * @returns {Promise<object>} Classification result
 */
export async function classifyEmail({ subject, body, fromName }) {
  if (!anthropic) {
    // Fallback: rule-based classification
    return ruleBasedClassify(subject, body);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      system: `Classify the incoming support email. Return ONLY valid JSON.

Output format:
{
  "team": "support" | "billing" | "sales" | "legal" | "security",
  "intent": "bug" | "payment" | "question" | "feature_request" | "complaint" | "partnership" | "abuse" | "other",
  "confidence": 0.0-1.0,
  "shouldReply": true | false,
  "language": "en" | "it" | "es" | "fr" | "de" | "other",
  "urgency": "low" | "normal" | "high" | "critical",
  "summary": "one-line summary"
}

Rules:
- confidence should be high (0.8+) only when clearly classifiable
- shouldReply = false for: spam, empty messages, nonsense, pure gibberish
- urgency = "critical" only for security breaches or system outages
- detect language from the actual text`,
      messages: [
        {
          role: 'user',
          content: `Subject: ${subject}\n\nFrom: ${fromName || 'Unknown'}\n\nBody:\n${body}`,
        },
      ],
    });

    const raw = response.content?.[0]?.text || '{}';
    const parsed = JSON.parse(raw);

    return {
      team: parsed.team || 'support',
      intent: parsed.intent || 'other',
      confidence: clamp(parsed.confidence, 0, 1),
      shouldReply: parsed.shouldReply !== false,
      language: parsed.language || 'en',
      urgency: parsed.urgency || 'normal',
      summary: parsed.summary || subject,
      source: 'ai',
    };
  } catch (error) {
    console.error('AI classification failed, using fallback:', error.message);
    return ruleBasedClassify(subject, body);
  }
}

/**
 * Rule-based fallback classification (no AI needed)
 */
function ruleBasedClassify(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();

  // Team detection
  let team = 'support';
  if (text.includes('bill') || text.includes('payment') || text.includes('charge') || text.includes('refund') || text.includes('invoice')) {
    team = 'billing';
  } else if (text.includes('buy') || text.includes('pricing') || text.includes('plan') || text.includes('upgrade') || text.includes('subscribe')) {
    team = 'sales';
  } else if (text.includes('privacy') || text.includes('gdpr') || text.includes('data deletion') || text.includes('legal')) {
    team = 'legal';
  } else if (text.includes('security') || text.includes('hack') || text.includes('breach') || text.includes('vulnerability') || text.includes('exploit')) {
    team = 'security';
  }

  // Intent detection
  let intent = 'question';
  if (text.includes('bug') || text.includes('error') || text.includes('broken') || text.includes('fail') || text.includes('not working')) {
    intent = 'bug';
  } else if (text.includes('payment') || text.includes('charge') || text.includes('bill')) {
    intent = 'payment';
  } else if (text.includes('feature') || text.includes('request') || text.includes('add') || text.includes('support for')) {
    intent = 'feature_request';
  } else if (text.includes('complaint') || text.includes('angry') || text.includes('unhappy') || text.includes('cancel')) {
    intent = 'complaint';
  } else if (text.includes('partner') || text.includes('collaborate') || text.includes('sponsor')) {
    intent = 'partnership';
  }

  // Confidence based on keyword match strength
  let confidence = 0.5;
  const strongIndicators = {
    billing: ['payment failed', 'double charge', 'refund', 'billing issue'],
    security: ['security breach', 'vulnerability', 'hacked', 'exploit'],
    support: ['not working', 'error', 'broken', 'can\'t access', 'help'],
  };
  const indicators = strongIndicators[team] || [];
  if (indicators.some(ind => text.includes(ind))) confidence = 0.75;
  if (indicators.some(ind => text.includes(ind)) && text.length > 50) confidence = 0.85;

  // Language detection (simple)
  const language = detectLanguageSimple(body);

  // Urgency
  let urgency = 'normal';
  if (text.includes('urgent') || text.includes('asap') || text.includes('critical') || text.includes('down') || text.includes('outage')) {
    urgency = 'high';
  }
  if (text.includes('security') && (text.includes('breach') || text.includes('exploit'))) {
    urgency = 'critical';
  }

  // Spam detection
  const shouldReply = !isSpam(text);

  return {
    team,
    intent,
    confidence,
    shouldReply,
    language,
    urgency,
    summary: subject || 'No subject',
    source: 'rule-based',
  };
}

/**
 * Simple language detection
 */
function detectLanguageSimple(text) {
  if (!text) return 'en';

  const lower = text.toLowerCase();

  // Italian indicators
  const italianWords = ['ciao', 'buongiorno', 'grazie', 'problema', 'aiuto', 'vorrei', 'non riesco', 'come fare', 'per favore'];
  if (italianWords.some(w => lower.includes(w))) return 'it';

  // Spanish indicators
  const spanishWords = ['hola', 'gracias', 'problema', 'ayuda', 'por favor', 'necesito'];
  if (spanishWords.some(w => lower.includes(w))) return 'es';

  // Default English
  return 'en';
}

/**
 * Simple spam detection
 */
function isSpam(text) {
  if (!text || text.trim().length < 3) return true;

  const spamPatterns = [
    'buy now', 'click here', 'free money', 'crypto',
    'bitcoin', 'investment opportunity', 'act now',
    'limited time offer', 'winner', 'congratulations you\'ve been selected',
  ];

  return spamPatterns.some(p => text.toLowerCase().includes(p));
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export default classifyEmail;
