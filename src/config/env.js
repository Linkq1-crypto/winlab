/**
 * Environment Configuration — Centralized env access with defaults
 */

export const env = {
  appBaseUrl: process.env.APP_URL || 'http://localhost:5173',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@winlab.cloud',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
