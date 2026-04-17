#!/usr/bin/env node
/**
 * setup-stripe.js — Creates all WinLab Stripe products + prices (27 prices)
 * Run once on VPS: node scripts/setup-stripe.js
 * Requires: STRIPE_SECRET_KEY in environment
 */
import Stripe from "stripe";
import { config } from "dotenv";
config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = [
  // ── Individual plans ───────────────────────────────────────────────────────
  { product: "WinLab Pro",          nick: "pro_monthly",        amount: 1900, interval: "month", currency: "usd" },
  { product: "WinLab Pro",          nick: "pro_annual",         amount: 19000, interval: "year",  currency: "usd" },
  { product: "WinLab Pro",          nick: "pro_monthly_eur",    amount: 1700, interval: "month", currency: "eur" },
  { product: "WinLab Pro",          nick: "pro_annual_eur",     amount: 17000, interval: "year",  currency: "eur" },

  // ── Business seat packs (USD) ─────────────────────────────────────────────
  { product: "WinLab Business",     nick: "biz_1seat_mo",       amount: 4900,  interval: "month", currency: "usd", seats: 1 },
  { product: "WinLab Business",     nick: "biz_1seat_yr",       amount: 49000, interval: "year",  currency: "usd", seats: 1 },
  { product: "WinLab Business",     nick: "biz_5seats_mo",      amount: 19900, interval: "month", currency: "usd", seats: 5 },
  { product: "WinLab Business",     nick: "biz_5seats_yr",      amount: 199000,interval: "year",  currency: "usd", seats: 5 },
  { product: "WinLab Business",     nick: "biz_10seats_mo",     amount: 34900, interval: "month", currency: "usd", seats: 10 },
  { product: "WinLab Business",     nick: "biz_10seats_yr",     amount: 349000,interval: "year",  currency: "usd", seats: 10 },
  { product: "WinLab Business",     nick: "biz_20seats_mo",     amount: 59900, interval: "month", currency: "usd", seats: 20 },
  { product: "WinLab Business",     nick: "biz_20seats_yr",     amount: 599000,interval: "year",  currency: "usd", seats: 20 },

  // ── Business seat packs (EUR) ─────────────────────────────────────────────
  { product: "WinLab Business",     nick: "biz_5seats_mo_eur",  amount: 18500, interval: "month", currency: "eur", seats: 5 },
  { product: "WinLab Business",     nick: "biz_5seats_yr_eur",  amount: 185000,interval: "year",  currency: "eur", seats: 5 },
  { product: "WinLab Business",     nick: "biz_10seats_mo_eur", amount: 32000, interval: "month", currency: "eur", seats: 10 },
  { product: "WinLab Business",     nick: "biz_10seats_yr_eur", amount: 320000,interval: "year",  currency: "eur", seats: 10 },

  // ── Enterprise annual ─────────────────────────────────────────────────────
  { product: "WinLab Enterprise",   nick: "ent_25seats_yr",     amount: 1199000,interval: "year", currency: "usd", seats: 25 },
  { product: "WinLab Enterprise",   nick: "ent_50seats_yr",     amount: 1999000,interval: "year", currency: "usd", seats: 50 },
  { product: "WinLab Enterprise",   nick: "ent_100seats_yr",    amount: 2999000,interval: "year", currency: "usd", seats: 100 },

  // ── Pilot (one-time) ──────────────────────────────────────────────────────
  { product: "WinLab Enterprise",   nick: "ent_pilot_30d",      amount: 29900, interval: null,    currency: "usd", oneTime: true },

  // ── Add-ons (one-time) ────────────────────────────────────────────────────
  { product: "WinLab Add-ons",      nick: "addon_ai_100",       amount: 900,   interval: null,    currency: "usd", oneTime: true },
  { product: "WinLab Add-ons",      nick: "addon_ai_500",       amount: 3900,  interval: null,    currency: "usd", oneTime: true },
  { product: "WinLab Add-ons",      nick: "addon_cert_exam",    amount: 1500,  interval: null,    currency: "usd", oneTime: true },
  { product: "WinLab Add-ons",      nick: "addon_api_monthly",  amount: 2900,  interval: "month", currency: "usd" },

  // ── Legacy / promo ────────────────────────────────────────────────────────
  { product: "WinLab Pro",          nick: "early_access_5",     amount: 500,   interval: "month", currency: "usd" },
  { product: "WinLab Pro",          nick: "early_access_5_eur", amount: 500,   interval: "month", currency: "eur" },
  { product: "WinLab Pro",          nick: "pro_annual_eur_promo",amount: 15000, interval: "year", currency: "eur" },
];

async function getOrCreateProduct(name) {
  const existing = await stripe.products.list({ limit: 100 });
  const found = existing.data.find(p => p.name === name && p.active);
  if (found) return found;
  return stripe.products.create({ name, description: `WinLab — ${name}` });
}

async function main() {
  console.log("🚀 WinLab Stripe setup — creating products and prices...\n");

  const productCache = {};
  const results = [];

  for (const p of PRICES) {
    try {
      // Get or create product
      if (!productCache[p.product]) {
        productCache[p.product] = await getOrCreateProduct(p.product);
        console.log(`📦 Product: ${p.product} (${productCache[p.product].id})`);
      }
      const product = productCache[p.product];

      // Build price params
      const priceData = {
        product: product.id,
        currency: p.currency,
        nickname: p.nick,
        metadata: {
          nick: p.nick,
          ...(p.seats ? { seats: String(p.seats) } : {}),
        },
      };

      if (p.oneTime) {
        priceData.unit_amount = p.amount;
      } else {
        priceData.unit_amount = p.amount;
        priceData.recurring = { interval: p.interval };
      }

      const price = await stripe.prices.create(priceData);
      results.push({ nick: p.nick, id: price.id, amount: p.amount / 100, currency: p.currency });
      console.log(`  ✓ ${p.nick.padEnd(28)} ${p.currency.toUpperCase()} ${(p.amount/100).toFixed(2).padStart(8)} — ${price.id}`);
    } catch (err) {
      console.error(`  ✗ ${p.nick}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done. ${results.length}/${PRICES.length} prices created.\n`);
  console.log("Copy these IDs to your .env / Stripe dashboard:\n");
  results.forEach(r => console.log(`STRIPE_PRICE_${r.nick.toUpperCase()}=${r.id}`));
}

main().catch(console.error);
