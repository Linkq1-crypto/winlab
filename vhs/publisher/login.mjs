#!/usr/bin/env node
// One-time login — saves session cookies so the worker never needs to log in again
// Usage:
//   node login.mjs --platform instagram
//   node login.mjs --platform facebook
//   node login.mjs --platform linkedin
//   node login.mjs --platform tiktok
// NOTE: YouTube è disabilitato — carica manualmente su YouTube Studio

import { loginInstagram } from "./bots/instagram.bot.mjs";
import { loginFacebook  } from "./bots/facebook.bot.mjs";
import { loginLinkedIn  } from "./bots/linkedin.bot.mjs";
import { loginTikTok    } from "./bots/tiktok.bot.mjs";

const args     = process.argv.slice(2);
const platform = args[args.indexOf("--platform") + 1];
const account  = args[args.indexOf("--account") + 1] || "main";

if (!platform) {
  console.error("Usage: node login.mjs --platform <instagram|facebook|linkedin|tiktok> [--account <id>]");
  process.exit(1);
}

const LOGINS = {
  instagram: () => loginInstagram(account),
  facebook:  () => loginFacebook(account),
  linkedin:  () => loginLinkedIn(account),
  tiktok:    () => loginTikTok(account),
};

const fn = LOGINS[platform];
if (!fn) {
  console.error(`Unknown platform: ${platform}`);
  process.exit(1);
}

console.log(`\nLogging in to ${platform}...\n`);
await fn();
console.log(`\nDone! Session saved. You can now run: node workers/publisher.worker.mjs\n`);
