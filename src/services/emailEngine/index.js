/**
 * @winlab/email-engine — Main entry point
 * Enterprise email system: templates, tracking, trust scoring, AI classification
 */

// Template builder
export { buildEmail } from './template.js';

// Sender with tracking
export { sendHelpdeskReply, getTeamEmail } from './sender.js';

// Trust score / anti-phishing
export {
  generateVerificationCode,
  generateVerifyToken,
  verifyEmailToken,
  calculateTrust,
  recommendAction,
} from './trustScore.js';

// AI classifier
export { classifyEmail } from './classifier.js';

// Name extraction + greeting
export { extractName, buildGreeting, getSignature } from './nameExtractor.js';

// Config
export { projects, defaultProject, getProjectConfig, teamSignatures, getTeamSignature, getTeamTone } from './config.js';

// Convenience export — full pipeline helper
export { default as EmailEngine } from './pipeline.js';
