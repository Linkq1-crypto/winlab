/**
 * Name Extractor — Pull sender name from email From header
 * "Mario Rossi <mario@email.com>" → "Mario"
 */

// Blacklist — don't use these as names
const NAME_BLACKLIST = [
  'info', 'support', 'admin', 'noreply', 'no-reply', 'donotreply',
  'postmaster', 'mailer-daemon', 'root', 'webmaster', 'help',
  'sales', 'billing', 'contact', 'service', 'team', 'hello',
];

/**
 * Extract first name from email From header
 * @param {string} from - e.g. "Mario Rossi <mario@email.com>"
 * @returns {string|null} First name or null
 */
export function extractName(from) {
  if (!from) return null;

  // Try: "Full Name <email>" or '"Full Name" <email>'
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    const fullName = nameMatch[1].trim();
    const firstName = fullName.split(/\s+/)[0];
    const cleaned = cleanName(firstName);
    if (cleaned && !NAME_BLACKLIST.includes(cleaned.toLowerCase())) {
      return cleaned;
    }
  }

  // Try: just email address
  const emailMatch = from.match(/([^@\s]+)@/);
  if (emailMatch) {
    const emailPart = emailMatch[1];
    if (!NAME_BLACKLIST.includes(emailPart.toLowerCase())) {
      // Convert email username to name (e.g., "john.doe" → "John")
      return emailPart
        .replace(/[._-]/g, ' ')
        .replace(/\d+/g, '')
        .trim()
        .split(/\s+/)[0]
        .replace(/^\w/, c => c.toUpperCase()) || null;
    }
  }

  return null;
}

/**
 * Clean a name — remove special chars, normalize
 * @param {string} name - Raw name
 * @returns {string|null} Cleaned name or null
 */
function cleanName(name) {
  if (!name) return null;

  // Remove special characters, keep letters and basic punctuation
  let cleaned = name
    .replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ\s'-]/g, '')
    .trim();

  // Skip if too short or empty
  if (cleaned.length < 2) return null;

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
}

/**
 * Build a personalized greeting
 * @param {string|null} name - Sender's first name
 * @param {string} language - 'en', 'it', 'es'
 * @returns {string} Greeting like "Ciao Mario," or "Hi," or "Hola John,"
 */
export function buildGreeting(name, language = 'en') {
  const greetings = {
    en: name ? `Hi ${name},` : 'Hi there,',
    it: name ? `Ciao ${name},` : 'Ciao,',
    es: name ? `Hola ${name},` : 'Hola,',
    fr: name ? `Bonjour ${name},` : 'Bonjour,',
    de: name ? `Hallo ${name},` : 'Hallo,',
  };

  return greetings[language] || greetings.en;
}

/**
 * Build a team signature HTML block
 * @param {string} team - 'support', 'billing', 'sales', 'legal', 'security'
 * @returns {object} Signature info
 */
export function getSignature(team) {
  const signatures = {
    support: { name: 'Winlab Support', team: 'Support Team', email: 'support@winlab.cloud' },
    billing: { name: 'Winlab Billing', team: 'Billing Team', email: 'billing@winlab.cloud' },
    sales: { name: 'Winlab Sales', team: 'Sales Team', email: 'sales@winlab.cloud' },
    legal: { name: 'Winlab Legal', team: 'Privacy & Compliance', email: 'privacy@winlab.cloud' },
    security: { name: 'Winlab Security', team: 'Security Team', email: 'security@winlab.cloud' },
  };

  return signatures[team] || signatures.support;
}

export default { extractName, buildGreeting, getSignature };
