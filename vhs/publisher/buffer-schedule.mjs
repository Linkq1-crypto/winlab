#!/usr/bin/env node
// ── WinLab → Buffer API publisher ────────────────────────────────────────────
// Schedula i 12 video pre-launch via Buffer (API ufficiali = no shadow ban).
//
// Setup (una volta sola):
//   1. Crea token su https://buffer.com/developers/apps
//   2. export BUFFER_TOKEN=your_access_token
//   3. node buffer-schedule.mjs --profiles       # copia i profile ID
//   4. export BUFFER_IG_ID=xxx BUFFER_TT_ID=xxx ...
//
// Comandi:
//   node buffer-schedule.mjs --profiles          # elenca profili Buffer
//   node buffer-schedule.mjs --launch-week --dry # preview senza pubblicare
//   node buffer-schedule.mjs --launch-week       # schedula tutti i 12 video
//   node buffer-schedule.mjs --content fri_01 --platform tiktok --now
//   node buffer-schedule.mjs --content fri_01 --platform instagram --at "2026-04-17T18:00:00+02:00"

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const TOKEN      = process.env.BUFFER_TOKEN;
const BASE       = 'https://api.bufferapp.com/1';
const VIDEO_DIR  = resolve(__dirname, '../output/prelaunch');

// ── Profile ID per piattaforma (setta le env var o incolla qui) ───────────────
const PROFILE_IDS = {
  instagram: process.env.BUFFER_IG_ID || '',
  tiktok:    process.env.BUFFER_TT_ID || '',
  linkedin:  process.env.BUFFER_LI_ID || '',
  youtube:   process.env.BUFFER_YT_ID || '',
};

if (!TOKEN) {
  console.error([
    '',
    '  BUFFER_TOKEN mancante.',
    '  Ottienilo su: https://buffer.com/developers/apps',
    '  Poi: export BUFFER_TOKEN=your_token',
    '',
  ].join('\n'));
  process.exit(1);
}

// ── Contenuti pre-launch ──────────────────────────────────────────────────────
// Orari in UTC (Roma = UTC+2 in aprile)
const CONTENT = {
  fri_01: {
    video: 'prelaunch_fri_01_announcement.mp4',
    platforms: ['tiktok', 'instagram', 'youtube', 'linkedin'],
    caption: `A real Linux terminal in your browser.

Type real commands. Break things. Fix them.
No setup. No VM. No excuses.

First lab starts in 30 seconds.

🔗 WinLab.cloud

#Linux #SysAdmin #DevOps #TechEducation #CloudComputing`,
  },
  fri_02: {
    video: 'prelaunch_fri_02_500_seats.mp4',
    platforms: ['tiktok', 'instagram'],
    caption: `500 seats. That's it.

Early access locked at $5.
Then $19. Then gone.

First come, first served.

🔒 Secure your spot: WinLab.cloud

#EarlyAccess #Linux #TechSkills #DevOps`,
  },
  fri_03: {
    video: 'prelaunch_fri_03_30_seconds.mp4',
    platforms: ['youtube', 'linkedin'],
    caption: `No account required.
Just open the browser.

First lab starts in 30 seconds.

Try it → WinLab.cloud

#LinuxTerminal #CloudComputing #SysAdmin #Tech`,
  },
  sat_04: {
    video: 'prelaunch_sat_04_real_linux.mp4',
    platforms: ['tiktok', 'instagram', 'youtube'],
    caption: `This isn't a simulator. It's real Linux.

Real commands. Real output.
Same terminal you'll use at 3AM.

Practice before it matters → WinLab.cloud

#Linux #RealSkills #TechEducation #DevOps`,
  },
  sat_05: {
    video: 'prelaunch_sat_05_offline.mp4',
    platforms: ['tiktok', 'linkedin'],
    caption: `Works on 2G.
Works offline.

Your internet shouldn't decide your career.

Talent is universal. Access should be too.

🌍 WinLab.cloud

#InclusiveTech #Linux #OfflineLearning #Tech`,
  },
  sat_06: {
    video: 'prelaunch_sat_06_break_fix.mp4',
    platforms: ['instagram', 'youtube'],
    caption: `Break it on purpose. That's how you learn.

10+ labs. Zero consequences.
Until it becomes one.

Real practice → WinLab.cloud

#BreakItFixIt #LinuxLabs #SysAdmin #DevOps`,
  },
  sun_07: {
    video: 'prelaunch_sun_07_countdown.mp4',
    platforms: ['tiktok', 'instagram', 'youtube', 'linkedin'],
    caption: `48 hours left.

Early access closes Monday.
$5 locks your price forever.
After that? $19.

Don't miss out → WinLab.cloud

⏰ Countdown is on

#EarlyAccess #Linux #TechSkills #Countdown`,
  },
  sun_08: {
    video: 'prelaunch_sun_08_skills.mp4',
    platforms: ['linkedin', 'tiktok'],
    caption: `Same skills. Different outcome.

Talent is universal.
Access shouldn't be the barrier.

Change your outcome → WinLab.cloud

#TechEducation #Linux #CareerGrowth #DevOps`,
  },
  sun_09: {
    video: 'prelaunch_sun_09_no_excuses.mp4',
    platforms: ['instagram', 'youtube'],
    caption: `No setup.
No VM.
No excuses.

Just open your browser.

Start now → WinLab.cloud

#NoExcuses #Linux #BrowserBased #TechSkills`,
  },
  mon_10: {
    video: 'prelaunch_mon_10_final_call.mp4',
    platforms: ['tiktok', 'instagram', 'youtube', 'linkedin'],
    caption: `Last chance. $5 early access.

Locks your price forever.
Tomorrow it's $19.

Final hours → WinLab.cloud

⚡ LAST CALL

#FinalCall #EarlyAccess #Linux #Tech`,
  },
  mon_11: {
    video: 'prelaunch_mon_11_closing.mp4',
    platforms: ['tiktok', 'linkedin'],
    caption: `This is it.
Real Linux. Real labs.

Early access closes tonight.
Don't watch. Do.

Last chance → WinLab.cloud

#ThisIsIt #Linux #RealSkills #TechEducation`,
  },
  mon_12: {
    video: 'prelaunch_mon_12_going_live.mp4',
    platforms: ['tiktok', 'instagram', 'youtube', 'linkedin'],
    caption: `Going live in 3... 2... 1...

We're live.

Early access is NOW OPEN.
500 seats. First come, first served.

🚀 WinLab.cloud

#WereLive #Linux #Launch #EarlyAccess #WinLab`,
  },
};

// ── Schedule ottimale 17-20 aprile (orari UTC, Roma = UTC+2) ─────────────────
const LAUNCH_WEEK = [
  // VENERDÌ 17
  { slug: 'fri_01', platform: 'linkedin',  at: '2026-04-17T16:00:00Z' },  // 18:00 Roma
  { slug: 'fri_01', platform: 'instagram', at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_01', platform: 'tiktok',    at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_01', platform: 'youtube',   at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_02', platform: 'tiktok',    at: '2026-04-17T18:00:00Z' },  // 20:00 Roma
  { slug: 'fri_02', platform: 'instagram', at: '2026-04-17T18:00:00Z' },
  { slug: 'fri_03', platform: 'youtube',   at: '2026-04-17T19:00:00Z' },  // 21:00 Roma
  { slug: 'fri_03', platform: 'linkedin',  at: '2026-04-17T19:00:00Z' },

  // SABATO 18
  { slug: 'sat_04', platform: 'tiktok',    at: '2026-04-18T10:00:00Z' },  // 12:00 Roma
  { slug: 'sat_04', platform: 'instagram', at: '2026-04-18T10:00:00Z' },
  { slug: 'sat_04', platform: 'youtube',   at: '2026-04-18T10:00:00Z' },
  { slug: 'sat_05', platform: 'tiktok',    at: '2026-04-18T13:00:00Z' },  // 15:00 Roma
  { slug: 'sat_05', platform: 'linkedin',  at: '2026-04-18T13:00:00Z' },
  { slug: 'sat_06', platform: 'instagram', at: '2026-04-18T17:00:00Z' },  // 19:00 Roma
  { slug: 'sat_06', platform: 'youtube',   at: '2026-04-18T17:00:00Z' },

  // DOMENICA 19
  { slug: 'sun_07', platform: 'tiktok',    at: '2026-04-19T08:00:00Z' },  // 10:00 Roma
  { slug: 'sun_07', platform: 'instagram', at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_07', platform: 'youtube',   at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_07', platform: 'linkedin',  at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_08', platform: 'linkedin',  at: '2026-04-19T12:00:00Z' },  // 14:00 Roma
  { slug: 'sun_08', platform: 'tiktok',    at: '2026-04-19T12:00:00Z' },
  { slug: 'sun_09', platform: 'instagram', at: '2026-04-19T16:00:00Z' },  // 18:00 Roma
  { slug: 'sun_09', platform: 'youtube',   at: '2026-04-19T16:00:00Z' },

  // LUNEDÌ 20 (ultimo giorno early access)
  { slug: 'mon_10', platform: 'tiktok',    at: '2026-04-20T06:00:00Z' },  // 08:00 Roma
  { slug: 'mon_10', platform: 'instagram', at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_10', platform: 'youtube',   at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_10', platform: 'linkedin',  at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_11', platform: 'tiktok',    at: '2026-04-20T12:00:00Z' },  // 14:00 Roma
  { slug: 'mon_11', platform: 'linkedin',  at: '2026-04-20T12:00:00Z' },
  { slug: 'mon_12', platform: 'tiktok',    at: '2026-04-20T18:00:00Z' },  // 20:00 Roma — GO LIVE
  { slug: 'mon_12', platform: 'instagram', at: '2026-04-20T18:00:00Z' },
  { slug: 'mon_12', platform: 'youtube',   at: '2026-04-20T18:00:00Z' },
  { slug: 'mon_12', platform: 'linkedin',  at: '2026-04-20T18:00:00Z' },
];

// ── Buffer API helpers ────────────────────────────────────────────────────────

async function bufferGet(path) {
  const res  = await fetch(`${BASE}${path}?access_token=${TOKEN}`);
  const body = await res.json();
  if (!res.ok) throw new Error(`Buffer ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function bufferPost(path, params) {
  const form = new URLSearchParams();
  form.append('access_token', TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(item => form.append(`${k}[]`, item));
    else form.append(k, String(v));
  }
  const res  = await fetch(`${BASE}${path}`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`Buffer ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function uploadVideo(videoPath) {
  if (!existsSync(videoPath)) {
    console.warn(`  ⚠  Video non trovato: ${basename(videoPath)}`);
    return null;
  }
  console.log(`  ↑  Carico: ${basename(videoPath)} ...`);
  const fileBuffer = readFileSync(videoPath);
  const blob       = new Blob([fileBuffer], { type: 'video/mp4' });
  const form       = new FormData();
  form.append('access_token', TOKEN);
  form.append('file', blob, basename(videoPath));
  const res  = await fetch(`${BASE}/media/upload.json`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`Upload ${res.status}: ${JSON.stringify(body)}`);
  console.log(`  ✓  Caricato → media_id=${body.id}`);
  return body.id;
}

async function scheduleUpdate({ profileId, text, videoPath, scheduledAt, postNow, dry }) {
  if (dry) return { id: 'DRY_RUN' };

  const params = { profile_ids: [profileId], text };

  if (postNow) {
    params.now = 'true';
  } else {
    params.scheduled_at = Math.floor(new Date(scheduledAt).getTime() / 1000);
  }

  if (videoPath) {
    const videoId = await uploadVideo(videoPath);
    if (videoId) params['media[video_id]'] = videoId;
  }

  return bufferPost('/updates/create.json', params);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const get     = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has     = (flag) => args.includes(flag);
const isDry   = has('--dry');

// --profiles
if (has('--profiles')) {
  const profiles = await bufferGet('/profiles.json');
  console.log('\nProfili Buffer:\n');
  for (const p of profiles) {
    console.log(`  ${p.service.padEnd(12)} id=${p.id}  @${p.service_username}`);
  }
  console.log('\nEsporta come env var:');
  const keyMap = { instagram: 'BUFFER_IG_ID', tiktok: 'BUFFER_TT_ID', linkedin: 'BUFFER_LI_ID', youtube: 'BUFFER_YT_ID' };
  for (const p of profiles) {
    const key = keyMap[p.service];
    if (key) console.log(`  export ${key}=${p.id}`);
  }
  console.log('');
  process.exit(0);
}

// --launch-week
if (has('--launch-week')) {
  console.log(`\n${isDry ? '[DRY RUN] ' : ''}Schedulo ${LAUNCH_WEEK.length} post — 17-20 aprile\n`);
  let ok = 0, skip = 0;

  for (const { slug, platform, at } of LAUNCH_WEEK) {
    const content   = CONTENT[slug];
    const profileId = PROFILE_IDS[platform];
    const label     = `${slug} → ${platform} @ ${at.replace('T', ' ').replace('Z', ' UTC')}`;

    if (!content) { console.warn(`  –  ${label}: slug non trovato`); skip++; continue; }
    if (!profileId) { console.warn(`  ⚠  ${label}: PROFILE_IDS[${platform}] vuoto`); skip++; continue; }

    const videoPath = resolve(VIDEO_DIR, content.video);

    try {
      const res = await scheduleUpdate({ profileId, text: content.caption, videoPath, scheduledAt: at, dry: isDry });
      console.log(`  ✓  ${label}${isDry ? '' : `  (id=${res.id})`}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${label}\n     ${err.message}`);
      skip++;
    }
  }

  console.log(`\n${ok} schedulati, ${skip} saltati.\n`);
  process.exit(skip > 0 ? 1 : 0);
}

// --content + --platform (post singolo)
const slug     = get('--content');
const platform = get('--platform');
const at       = get('--at');
const postNow  = has('--now');

if (!slug) {
  const slugs = Object.keys(CONTENT).join(', ');
  console.log(`
Uso:
  node buffer-schedule.mjs --profiles
  node buffer-schedule.mjs --launch-week [--dry]
  node buffer-schedule.mjs --content <slug> --platform <name> --now
  node buffer-schedule.mjs --content <slug> --platform <name> --at "2026-04-17T18:00:00+02:00"

Slug disponibili: ${slugs}
Piattaforme:     instagram, tiktok, linkedin, youtube
`);
  process.exit(0);
}

if (!platform) { console.error('Specifica --platform'); process.exit(1); }
if (!at && !postNow) { console.error('Specifica --now o --at <datetime ISO>'); process.exit(1); }

const content   = CONTENT[slug];
const profileId = PROFILE_IDS[platform];

if (!content)   { console.error(`Slug non trovato: ${slug}`); process.exit(1); }
if (!profileId) { console.error(`PROFILE_IDS[${platform}] vuoto — setta la env var`); process.exit(1); }

const videoPath = resolve(VIDEO_DIR, content.video);

const res = await scheduleUpdate({ profileId, text: content.caption, videoPath, scheduledAt: at, postNow, dry: isDry });
console.log(`✓ ${slug}/${platform} ${postNow ? 'in coda ora' : `@ ${at}`}  id=${res.id}`);
