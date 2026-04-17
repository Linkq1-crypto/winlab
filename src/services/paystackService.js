/**
 * Paystack Integration for Africa Payments
 * Supports Nigeria, Ghana, Kenya, South Africa
 * Documentation: https://paystack.com/docs/api/
 */

import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initialize a payment (create transaction)
 * @param {Object} params
 * @param {string} params.email - Customer email
 * @param {number} params.amount - Amount in kobo/cents (multiply by 100)
 * @param {string} params.currency - Currency: NGN, GHS, KES, ZAR
 * @param {string} params.callbackUrl - Redirect URL after payment
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<{authorizationUrl: string, accessCode: string, reference: string}>}
 */
export async function initializePayment({
  email,
  amount,
  currency = 'NGN',
  callbackUrl,
  metadata = {},
}) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY not configured');
  }

  const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Convert to kobo/cents
      currency,
      callback_url: callbackUrl,
      metadata: JSON.stringify(metadata),
    }),
  });

  const data = await response.json();

  if (!data.status) {
    throw new Error(`Paystack initialization failed: ${data.message}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Verify a payment after callback
 * @param {string} reference - Transaction reference from callback
 * @returns {Promise<Object>} Payment verification result
 */
export async function verifyPayment(reference) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY not configured');
  }

  const response = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();

  if (!data.status) {
    throw new Error(`Paystack verification failed: ${data.message}`);
  }

  return data.data;
}

/**
 * Verify webhook signature
 * @param {string} signature - X-Paystack-Signature header
 * @param {string} payload - Raw request body
 * @returns {boolean} Whether signature is valid
 */
export function verifyWebhookSignature(signature, payload) {
  if (!PAYSTACK_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

// ── Africa pricing table (amounts in smallest currency unit) ─────────────────
// Pro ≈ $2/month equivalent, Business ≈ $10/month equivalent
export const AFRICA_PRICING = {
  NGN: { // Nigeria — ₦
    symbol: '₦', name: 'Nigeria', flag: '🇳🇬',
    pro:      { amount: 3000,  display: '₦3,000/mo'  }, // ~$2
    business: { amount: 15000, display: '₦15,000/mo' }, // ~$10
    lifetime: { amount: 45000, display: '₦45,000'    }, // ~$29 one-time
    earlyAccess: { amount: 800, display: '₦800'       }, // ~$0.50
  },
  GHS: { // Ghana — GH₵
    symbol: 'GH₵', name: 'Ghana', flag: '🇬🇭',
    pro:      { amount: 30,  display: 'GH₵30/mo'  }, // ~$2
    business: { amount: 150, display: 'GH₵150/mo' }, // ~$10
    lifetime: { amount: 450, display: 'GH₵450'    }, // ~$29
    earlyAccess: { amount: 8, display: 'GH₵8'     }, // ~$0.50
  },
  KES: { // Kenya — KSh
    symbol: 'KSh', name: 'Kenya', flag: '🇰🇪',
    pro:      { amount: 260,  display: 'KSh260/mo'  }, // ~$2
    business: { amount: 1300, display: 'KSh1,300/mo' }, // ~$10
    lifetime: { amount: 3900, display: 'KSh3,900'   }, // ~$29
    earlyAccess: { amount: 65, display: 'KSh65'     }, // ~$0.50
  },
  ZAR: { // South Africa — R
    symbol: 'R', name: 'South Africa', flag: '🇿🇦',
    pro:      { amount: 40,  display: 'R40/mo'  }, // ~$2.20
    business: { amount: 200, display: 'R200/mo' }, // ~$11
    lifetime: { amount: 550, display: 'R550'    }, // ~$30
    earlyAccess: { amount: 10, display: 'R10'   }, // ~$0.55
  },
};

/**
 * Get Africa pricing for a given currency and plan
 */
export function getAfricaPrice(currency, plan) {
  return AFRICA_PRICING[currency]?.[plan] || null;
}

/**
 * Get list of supported African countries and currencies
 */
export function getSupportedCountries() {
  return Object.entries(AFRICA_PRICING).map(([currency, data]) => ({
    currency,
    symbol: data.symbol,
    name: data.name,
    flag: data.flag,
  }));
}

/**
 * Detect African country from request and return appropriate currency
 * @param {Object} req - Express request object
 * @returns {string} Currency code or null if not African
 */
export function detectAfricanCurrency(req) {
  const country = req.headers['cf-ipcountry']?.toUpperCase();

  const countryMap = {
    'NG': 'NGN',
    'GH': 'GHS',
    'KE': 'KES',
    'ZA': 'ZAR',
  };

  return countryMap[country] || null;
}

export default {
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
  getSupportedCountries,
  detectAfricanCurrency,
};
