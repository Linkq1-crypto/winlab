// anonymizer.js – Production data anonymizer for AI training
// Strips all PII before storing questions/answers for ML training
// Open source: https://github.com/YOUR_ORG/winlab-anonymizer

const PII_PATTERNS = {
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  sshKey: /ssh-(?:rsa|ed25519|dss)\s+[A-Za-z0-9+/=]+/g,
  awsKey: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  apiKey: /(?:sk-|pk-|key-|token-)[A-Za-z0-9]{20,}/g,
  phoneNumber: /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  filepath: /(?:\/home\/|\/Users\/|C:\\Users\\|\/var\/log\/)[^\s"'<>]+/gi,
  hostname: /\b[A-Za-z0-9-]+\.(?:local|corp|internal|lan|home)\b/gi,
  jwtToken: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
};

const REPLACEMENTS = {
  ipv4: "[IP]",
  ipv6: "[IPv6]",
  email: "[EMAIL]",
  sshKey: "[SSH_KEY]",
  awsKey: "[AWS_KEY]",
  apiKey: "[API_KEY]",
  phoneNumber: "[PHONE]",
  filepath: "[FILEPATH]",
  hostname: "[HOSTNAME]",
  jwtToken: "[JWT_TOKEN]",
};

/**
 * Anonymize text by replacing all PII patterns with placeholders.
 * @param {string} text - Raw user input
 * @returns {string} Anonymized text safe for ML training
 */
export function anonymize(text) {
  if (!text || typeof text !== "string") return "";

  let result = text;

  // Order matters: replace longer patterns first to avoid partial matches
  const order = ["jwtToken", "awsKey", "apiKey", "sshKey", "email", "ipv6", "ipv4", "phoneNumber", "filepath", "hostname"];

  for (const key of order) {
    result = result.replace(PII_PATTERNS[key], REPLACEMENTS[key]);
  }

  return result;
}

/**
 * Check if text contains any PII.
 * @param {string} text
 * @returns {boolean}
 */
export function containsPII(text) {
  if (!text || typeof text !== "string") return false;
  return Object.values(PII_PATTERNS).some((pattern) => pattern.test(text));
}

/**
 * Get a report of what PII types were found.
 * @param {string} text
 * @returns {{ type: string, count: number }[]}
 */
export function getPIIReport(text) {
  if (!text || typeof text !== "string") return [];
  const report = [];
  for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      report.push({ type: key, count: matches.length });
    }
  }
  return report;
}
