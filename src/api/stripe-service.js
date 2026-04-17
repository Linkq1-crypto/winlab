/**
 * Stripe Service Module
 * Handles all Stripe operations: customers, subscriptions, payments, webhooks
 */

import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Price configuration for different regions
const PRICES = {
  // Subscription plans (monthly)
  subscriptions: {
    pro: {
      usd: process.env.STRIPE_PRICE_PRO          || 'price_pro_usd',
      eur: process.env.STRIPE_PRICE_PRO_EUR       || null, // €19/mo — auto-created on first checkout
      inr: process.env.STRIPE_PRICE_PRO_INR       || 'price_pro_inr',
    },
    business: {
      usd: process.env.STRIPE_PRICE_BUSINESS      || 'price_business_usd',
      eur: process.env.STRIPE_PRICE_BUSINESS_EUR  || null, // €99/mo — auto-created on first checkout
      inr: process.env.STRIPE_PRICE_BUSINESS_INR  || 'price_business_inr',
    },
  },
  // One-time payments — amounts per currency
  oneTime: {
    earlyAccess: {
      usd: { amount: 500,   currency: 'usd' }, // $5
      eur: { amount: 500,   currency: 'eur' }, // €5
    },
    lifetime: {
      usd: { amount: 14900, currency: 'usd' }, // $149
      eur: { amount: 14900, currency: 'eur' }, // €149
    },
  },
  // Pay-per-incident (one-time payments)
  payPerIncident: {
    usd: { amount: 1900, currency: 'usd' }, // $19
    eur: { amount: 1900, currency: 'eur' }, // €19
    inr: { amount: 2000, currency: 'inr' }, // ₹20
  },
};

// EU countries for auto-currency detection (Cloudflare cf-ipcountry header)
const EU_COUNTRIES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
  'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
  'NL','PL','PT','RO','SE','SI','SK',
]);

/**
 * Detect currency from Cloudflare IP country header
 * @param {Object} req - Express request
 * @returns {'eur'|'inr'|'usd'}
 */
export function detectCurrency(req) {
  const country = req.headers['cf-ipcountry']?.toUpperCase();
  if (!country) return 'usd';
  if (EU_COUNTRIES.has(country)) return 'eur';
  if (country === 'IN') return 'inr';
  return 'usd';
}

/**
 * Create or retrieve Stripe customer
 * @param {Object} user - User object from database
 * @returns {Promise<string>} Stripe customer ID
 */
export async function createOrRetrieveCustomer(user) {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: {
      userId: user.id,
      nickname: user.nickname || '',
    },
  });

  return customer.id;
}

/**
 * Create Stripe Checkout session for subscription
 * @param {Object} user - User object
 * @param {string} plan - Plan type: 'pro' or 'business'
 * @param {string} currency - Currency: 'usd' or 'inr'
 * @param {string} successUrl - Redirect URL after successful payment
 * @param {string} cancelUrl - Redirect URL after cancellation
 * @returns {Promise<{url: string}>} Checkout session URL
 */
export async function createSubscriptionCheckout(user, plan, currency, successUrl, cancelUrl) {
  const customerId = await createOrRetrieveCustomer(user);
  const planPrices = PRICES.subscriptions[plan] || PRICES.subscriptions.pro;

  // Use pre-created price ID if available, else fall back to price_data (auto-creates in Stripe)
  const priceId = planPrices[currency] || planPrices.usd;

  const SUBSCRIPTION_AMOUNTS = {
    pro:      { usd: 1900, eur: 1900, inr: 19900 },
    business: { usd: 9900, eur: 9900, inr: 99900 },
  };
  const amount = SUBSCRIPTION_AMOUNTS[plan]?.[currency] || SUBSCRIPTION_AMOUNTS.pro.usd;

  // Use price_data for EUR if no pre-created price ID exists yet
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency,
          recurring: { interval: 'month' },
          product_data: {
            name: `WinLab ${plan === 'pro' ? 'Individual' : 'Business'} Plan`,
            description: plan === 'pro' ? 'All labs + AI Mentor' : 'Everything + Team Dashboard',
          },
          unit_amount: amount,
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [lineItem],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: user.id, plan, currency },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { userId: user.id, plan },
    },
  });

  return { url: session.url };
}

/**
 * Create Stripe Checkout session for pay-per-incident
 * @param {Object} user - User object
 * @param {string} currency - Currency: 'usd' or 'inr'
 * @param {string} labId - Lab/scenario ID being purchased
 * @param {string} successUrl - Redirect URL after successful payment
 * @param {string} cancelUrl - Redirect URL after cancellation
 * @returns {Promise<{url: string}>} Checkout session URL
 */
export async function createPayPerIncidentCheckout(user, currency, labId, successUrl, cancelUrl) {
  const customerId = await createOrRetrieveCustomer(user);
  const priceConfig = PRICES.payPerIncident[currency] || PRICES.payPerIncident.usd;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment', // One-time payment
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: priceConfig.currency,
          product_data: {
            name: `Lab Access: ${labId || 'Scenario'}`,
            description: `One-time access to lab scenario`,
            metadata: {
              labId,
              userId: user.id,
            },
          },
          unit_amount: priceConfig.amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user.id,
      labId,
      type: 'pay_per_incident',
    },
  });

  return { url: session.url };
}

/**
 * Create Stripe Checkout session for one-time payments (early access or lifetime)
 * @param {string} type - Payment type: 'earlyAccess' or 'lifetime'
 * @param {Object} user - User object (optional for early access, required for lifetime)
 * @param {string} successUrl - Redirect URL after successful payment
 * @param {string} cancelUrl - Redirect URL after cancellation
 * @returns {Promise<{url: string}>} Checkout session URL
 */
export async function createOneTimePaymentCheckout(type, user, successUrl, cancelUrl, currency = 'usd') {
  const priceOptions = PRICES.oneTime[type];

  if (!priceOptions) {
    throw new Error(`Invalid one-time payment type: ${type}`);
  }

  // Use EUR if available, fallback to USD
  const priceConfig = priceOptions[currency] || priceOptions.usd;
  const customerId = user?.id ? await createOrRetrieveCustomer(user) : undefined;

  const NAMES = {
    earlyAccess: {
      name: 'WinLab Early Access',
      description: `Launch price — locked forever (regular price: ${currency === 'eur' ? '€19' : '$19'}/month)`,
    },
    lifetime: {
      name: 'WinLab Lifetime Access',
      description: 'One-time payment — lifetime access, no renewals, all future labs included',
    },
  };

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: priceConfig.currency,
          product_data: {
            name: NAMES[type].name,
            description: NAMES[type].description,
          },
          unit_amount: priceConfig.amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user?.id || '',
      type: `one_time_${type}`,
      currency: priceConfig.currency,
    },
    customer_email: !customerId && user?.email ? user.email : undefined,
  });

  return { url: session.url, amount: priceConfig.amount / 100, currency: priceConfig.currency };
}

/**
 * Create Stripe Billing Portal session for managing subscription
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - Return URL after portal interaction
 * @returns {Promise<{url: string}>} Billing portal URL
 */
export async function createBillingPortalSession(customerId, returnUrl) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Cancel subscription at end of billing period
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Updated subscription object
 */
export async function cancelSubscription(subscriptionId) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Resume a canceled subscription (before period ends)
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Updated subscription object
 */
export async function resumeSubscription(subscriptionId) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Pause subscription (temporarily stop billing)
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} behavior - 'pause_collection' or 'keep_as_draft'
 * @returns {Promise<Object>} Updated subscription object
 */
export async function pauseSubscription(subscriptionId, behavior = 'pause_collection') {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior,
    },
  });
}

/**
 * Update subscription payment method
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - Return URL after setup
 * @returns {Promise<{url: string}>} Setup intent URL
 */
export async function createSetupIntentForPaymentMethod(customerId, returnUrl) {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });

  return { clientSecret: setupIntent.client_secret };
}

/**
 * Retrieve subscription details
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Object>} Stripe subscription object
 */
export async function getSubscription(subscriptionId) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Retrieve customer with subscriptions
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Object>} Stripe customer object
 */
export async function getCustomer(customerId) {
  return await stripe.customers.retrieve(customerId, {
    expand: ['subscriptions'],
  });
}

/**
 * Verify and construct Stripe event from webhook
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @param {string} webhookSecret - Webhook secret from env
 * @returns {Stripe.Event} Verified Stripe event
 */
export function constructWebhookEvent(payload, signature, webhookSecret) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Map Stripe subscription status to internal status
 * @param {string} stripeStatus - Stripe subscription status
 * @returns {string} Internal status
 */
export function mapStripeStatus(stripeStatus) {
  const statusMap = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'pending',
    incomplete_expired: 'canceled',
    trialing: 'trial',
    paused: 'paused',
  };
  return statusMap[stripeStatus] || 'none';
}

/**
 * Get plan name from price ID
 * @param {string} priceId - Stripe price ID
 * @returns {string} Plan name
 */
export function getPlanFromPriceId(priceId) {
  // Reverse lookup from price ID to plan name
  for (const [plan, currencies] of Object.entries(PRICES.subscriptions)) {
    for (const [currency, id] of Object.entries(currencies)) {
      if (id === priceId) return plan;
    }
  }
  return 'unknown';
}

export default {
  createOrRetrieveCustomer,
  createSubscriptionCheckout,
  createPayPerIncidentCheckout,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  pauseSubscription,
  createSetupIntentForPaymentMethod,
  getSubscription,
  getCustomer,
  constructWebhookEvent,
  mapStripeStatus,
  getPlanFromPriceId,
  createOneTimePaymentCheckout,
  PRICES,
};
