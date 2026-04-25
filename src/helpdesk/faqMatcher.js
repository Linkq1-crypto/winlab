/**
 * faqMatcher
 *
 * Matches an incoming support message against known FAQ entries.
 * Returns a pre-written answer if confidence is above threshold,
 * avoiding unnecessary LLM calls for common questions.
 *
 * FAQ entries are defined inline and can be extended from the DB.
 */

/**
 * @typedef {Object} FAQEntry
 * @property {string}   id
 * @property {string[]} keywords
 * @property {string}   question
 * @property {string}   answer
 * @property {string}   category
 */

/**
 * @typedef {Object} FAQMatch
 * @property {FAQEntry} entry
 * @property {number}   score     - 0 to 1
 */

/** @type {FAQEntry[]} */
const FAQ_ENTRIES = [
  {
    id: 'login-password-reset',
    keywords: ['password', 'reset', 'forgot', 'login', 'can\'t login', 'locked out'],
    question: 'How do I reset my password?',
    answer: 'Go to the login page and click "Forgot password". You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.',
    category: 'account',
  },
  {
    id: 'lab-not-starting',
    keywords: ['lab not starting', 'lab won\'t start', 'lab stuck', 'container', 'loading forever', 'lab doesn\'t load'],
    question: 'My lab won\'t start — what do I do?',
    answer: 'Try refreshing the page. If the lab is still stuck, click "Reset Lab" in the top right. If the issue persists, please report it with the lab name and your browser console logs.',
    category: 'technical',
  },
  {
    id: 'cancel-subscription',
    keywords: ['cancel', 'unsubscribe', 'stop billing', 'cancel plan', 'delete account'],
    question: 'How do I cancel my subscription?',
    answer: 'Go to Settings → Billing and click "Cancel Plan". Your access remains active until the end of the billing period. No refunds are issued for partial periods.',
    category: 'billing',
  },
  {
    id: 'double-charge',
    keywords: ['charged twice', 'double charge', 'duplicate payment', 'double payment'],
    question: 'I was charged twice.',
    answer: 'Please forward the transaction receipts to billing@winlab.cloud. We\'ll verify and issue a refund within 2 business days if a duplicate charge is confirmed.',
    category: 'billing',
  },
  {
    id: 'certificate-download',
    keywords: ['certificate', 'download cert', 'completion certificate', 'pdf certificate'],
    question: 'How do I download my completion certificate?',
    answer: 'Certificates are available on your Profile page after completing a lab path. Click "View Certificate" and then "Download PDF".',
    category: 'account',
  },
  {
    id: 'upgrade-plan',
    keywords: ['upgrade', 'pro plan', 'business plan', 'more labs', 'unlimited hints'],
    question: 'How do I upgrade my plan?',
    answer: 'Go to Settings → Billing and select the plan you want. Upgrades take effect immediately.',
    category: 'billing',
  },
  {
    id: 'data-deletion',
    keywords: ['delete my data', 'gdpr', 'right to be forgotten', 'data deletion', 'remove account'],
    question: 'How do I request data deletion?',
    answer: 'You can delete your account from Settings → Account → Delete Account. This permanently removes all your data within 30 days per our GDPR policy.',
    category: 'legal',
  },
];

/**
 * Simple keyword overlap scoring.
 * Returns a score between 0 and 1.
 */
function scoreEntry(text, entry) {
  const lower = text.toLowerCase();
  const matched = entry.keywords.filter(k => lower.includes(k));
  return matched.length / entry.keywords.length;
}

/**
 * @param {string} message      - User support message (subject + body)
 * @param {number} [threshold]  - Minimum score to return a match (default 0.3)
 * @param {FAQEntry[]} [extraEntries] - Additional entries from DB
 * @returns {FAQMatch|null}
 */
export function matchFAQ(message, threshold = 0.3, extraEntries = []) {
  const entries = [...FAQ_ENTRIES, ...extraEntries];

  let best = null;
  let bestScore = 0;

  for (const entry of entries) {
    const score = scoreEntry(message, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (bestScore >= threshold) {
    return { entry: best, score: bestScore };
  }

  return null;
}

/** @returns {FAQEntry[]} */
export function getAllFAQs() {
  return FAQ_ENTRIES;
}
