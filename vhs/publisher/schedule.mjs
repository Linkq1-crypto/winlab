#!/usr/bin/env node
// Schedule posts from the CONTENT map in config.mjs
//
// Usage — schedule a content slug across all platforms:
//   node schedule.mjs --content connection_lost --now
//   node schedule.mjs --content hero_launch --at "2026-04-17T18:00:00+02:00"
//
// Usage — schedule individual platform:
//   node schedule.mjs --content fail_fix --platform linkedin --at "2026-04-18T08:00:00+02:00"
//
// Schedule the full launch week (auto-optimal times):
//   node schedule.mjs --launch-week

import { schedulePost, postNow } from "./queue/queue.mjs";
import { CONTENT, ACCOUNTS } from "./config.mjs";
import { log } from "./utils/logger.mjs";

const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has  = (flag) => args.includes(flag);

// ── Launch week schedule (April 17-20, pre-configured) ───────────────────────
if (has("--launch-week")) {
  // Optimal post times (Rome timezone UTC+2):
  // IG/TikTok: 12:30 and 19:00
  // LinkedIn:  08:00 and 12:00
  // YouTube:   18:00
  // FB:        09:00 and 20:00

  // NOTA: "facebook" pubblica FB + IG insieme (1 job → 2 piattaforme)
  // Non serve schedulare instagram separatamente per i contenuti già su facebook
  const SCHEDULE = [
    // DAY 1 — 17 aprile (lancio)
    { content: "hero_launch",      platform: "linkedin",  at: "2026-04-17T06:00:00Z" },  // 08:00 Roma
    // youtube: upload manuale su YouTube Studio
    { content: "hero_launch",      platform: "facebook",  at: "2026-04-17T10:30:00Z" },  // 12:30 Roma → FB+IG
    { content: "hero_launch",      platform: "tiktok",    at: "2026-04-17T17:00:00Z" },  // 19:00 Roma

    // DAY 2 — 18 aprile
    { content: "connection_lost",  platform: "facebook",  at: "2026-04-18T10:30:00Z" },  // 12:30 Roma → FB+IG
    { content: "connection_lost",  platform: "tiktok",    at: "2026-04-18T17:00:00Z" },  // 19:00 Roma
    { content: "connection_lost",  platform: "linkedin",  at: "2026-04-18T10:00:00Z" },  // 12:00 Roma

    // DAY 3 — 19 aprile
    { content: "fail_fix",         platform: "facebook",  at: "2026-04-19T10:30:00Z" },  // 12:30 Roma → FB+IG
    { content: "fail_fix",         platform: "tiktok",    at: "2026-04-19T17:00:00Z" },  // 19:00 Roma
    { content: "fail_fix",         platform: "linkedin",  at: "2026-04-19T06:00:00Z" },  // 08:00 Roma

    // DAY 4 — 20 aprile (ultimo giorno early access)
    { content: "watching_vs_doing", platform: "tiktok",   at: "2026-04-20T10:30:00Z" },  // 12:30 Roma
    { content: "watching_vs_doing", platform: "facebook",  at: "2026-04-20T17:00:00Z" },  // 19:00 Roma → FB+IG
    { content: "career",            platform: "linkedin",  at: "2026-04-20T06:00:00Z" },  // 08:00 Roma
  ];

  let count = 0;
  for (const { content: slug, platform, at } of SCHEDULE) {
    const data = CONTENT[slug]?.[platform];
    if (!data) { log.warn(`No content for ${slug}/${platform} — skipping`); continue; }

    const jobId = await schedulePost({ platform, ...data }, at);
    log.ok(`Scheduled`, { platform, content: slug, at, jobId });
    count++;
  }
  log.ok(`\nLaunch week scheduled: ${count} posts across all platforms`);
  process.exit(0);
}

// ── Single content/platform schedule ─────────────────────────────────────────
const slug     = get("--content");
const platform = get("--platform");  // optional — if omitted, schedules all platforms
const at       = get("--at");
const now      = has("--now");

if (!slug) {
  console.log(`
Usage:
  node schedule.mjs --launch-week
  node schedule.mjs --content <slug> [--platform <name>] --now
  node schedule.mjs --content <slug> [--platform <name>] --at "2026-04-17T18:00:00+02:00"

Available content slugs: ${Object.keys(CONTENT).join(", ")}
`);
  process.exit(0);
}

const contentMap = CONTENT[slug];
if (!contentMap) {
  console.error(`Unknown content slug: ${slug}. Available: ${Object.keys(CONTENT).join(", ")}`);
  process.exit(1);
}

const platforms = platform ? [platform] : Object.keys(contentMap);

for (const p of platforms) {
  const data = contentMap[p];
  if (!data) { log.warn(`No content defined for ${slug}/${p}`); continue; }

  const post = { platform: p, ...data };

  if (now) {
    const jobId = await postNow(post);
    log.ok(`Queued immediately`, { platform: p, content: slug, jobId });
  } else if (at) {
    const jobId = await schedulePost(post, at);
    log.ok(`Scheduled`, { platform: p, content: slug, at, jobId });
  } else {
    console.error("Specify --now or --at <ISO datetime>");
    process.exit(1);
  }
}

process.exit(0);
