#!/usr/bin/env node
// ── WinLab → Ayrshare API publisher ──────────────────────────────────────────
// API ufficiali social (no shadow ban), auth con semplice API key.
//
// Setup (una volta sola):
//   1. Registrati su ayrshare.com → Dashboard → API Key
//   2. Collega i profili social: Instagram, TikTok, LinkedIn, YouTube
//   3. export AYRSHARE_KEY=la_tua_api_key   (PowerShell: $env:AYRSHARE_KEY="...")
//
// Comandi:
//   node ayrshare-schedule.mjs --profiles          # verifica profili collegati
//   node ayrshare-schedule.mjs --launch-week --dry # preview senza pubblicare
//   node ayrshare-schedule.mjs --launch-week       # schedula tutti i 32 post
//   node ayrshare-schedule.mjs --content fri_01 --platform tiktok --now
//   node ayrshare-schedule.mjs --content fri_01 --platform instagram --at "2026-04-17T18:00:00+02:00"

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY       = process.env.AYRSHARE_KEY;
const BASE      = 'https://app.ayrshare.com/api';
const VIDEO_DIR = resolve(__dirname, '../output/prelaunch');

if (!KEY) {
  console.error([
    '',
    '  AYRSHARE_KEY mancante.',
    '  Ottienila su: ayrshare.com → Dashboard → API Key',
    '  PowerShell: $env:AYRSHARE_KEY = "la_tua_key"',
    '',
  ].join('\n'));
  process.exit(1);
}

const HEADERS = {
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// ── Ayrshare platform names ───────────────────────────────────────────────────
// instagram, tiktok, linkedin, youtube, facebook, twitter, pinterest
const PLATFORM_MAP = {
  instagram: 'instagram',
  tiktok:    'tiktok',
  linkedin:  'linkedin',
  youtube:   'youtube',
};

// ── Contenuti pre-launch ──────────────────────────────────────────────────────
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

// ── Schedule 17-20 aprile (UTC) ───────────────────────────────────────────────
const LAUNCH_WEEK = [
  // VENERDÌ 17
  { slug: 'fri_01', platform: 'linkedin',  at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_01', platform: 'instagram', at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_01', platform: 'tiktok',    at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_01', platform: 'youtube',   at: '2026-04-17T16:00:00Z' },
  { slug: 'fri_02', platform: 'tiktok',    at: '2026-04-17T18:00:00Z' },
  { slug: 'fri_02', platform: 'instagram', at: '2026-04-17T18:00:00Z' },
  { slug: 'fri_03', platform: 'youtube',   at: '2026-04-17T19:00:00Z' },
  { slug: 'fri_03', platform: 'linkedin',  at: '2026-04-17T19:00:00Z' },
  // SABATO 18
  { slug: 'sat_04', platform: 'tiktok',    at: '2026-04-18T10:00:00Z' },
  { slug: 'sat_04', platform: 'instagram', at: '2026-04-18T10:00:00Z' },
  { slug: 'sat_04', platform: 'youtube',   at: '2026-04-18T10:00:00Z' },
  { slug: 'sat_05', platform: 'tiktok',    at: '2026-04-18T13:00:00Z' },
  { slug: 'sat_05', platform: 'linkedin',  at: '2026-04-18T13:00:00Z' },
  { slug: 'sat_06', platform: 'instagram', at: '2026-04-18T17:00:00Z' },
  { slug: 'sat_06', platform: 'youtube',   at: '2026-04-18T17:00:00Z' },
  // DOMENICA 19
  { slug: 'sun_07', platform: 'tiktok',    at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_07', platform: 'instagram', at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_07', platform: 'youtube',   at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_07', platform: 'linkedin',  at: '2026-04-19T08:00:00Z' },
  { slug: 'sun_08', platform: 'linkedin',  at: '2026-04-19T12:00:00Z' },
  { slug: 'sun_08', platform: 'tiktok',    at: '2026-04-19T12:00:00Z' },
  { slug: 'sun_09', platform: 'instagram', at: '2026-04-19T16:00:00Z' },
  { slug: 'sun_09', platform: 'youtube',   at: '2026-04-19T16:00:00Z' },
  // LUNEDÌ 20
  { slug: 'mon_10', platform: 'tiktok',    at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_10', platform: 'instagram', at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_10', platform: 'youtube',   at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_10', platform: 'linkedin',  at: '2026-04-20T06:00:00Z' },
  { slug: 'mon_11', platform: 'tiktok',    at: '2026-04-20T12:00:00Z' },
  { slug: 'mon_11', platform: 'linkedin',  at: '2026-04-20T12:00:00Z' },
  { slug: 'mon_12', platform: 'tiktok',    at: '2026-04-20T18:00:00Z' },
  { slug: 'mon_12', platform: 'instagram', at: '2026-04-20T18:00:00Z' },
  { slug: 'mon_12', platform: 'youtube',   at: '2026-04-20T18:00:00Z' },
  { slug: 'mon_12', platform: 'linkedin',  at: '2026-04-20T18:00:00Z' },
];

// ── Ayrshare API helpers ──────────────────────────────────────────────────────

async function getProfiles() {
  const res  = await fetch(`${BASE}/user`, { headers: HEADERS });
  const body = await res.json();
  if (!res.ok) throw new Error(`Ayrshare ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function uploadMedia(videoPath) {
  if (!existsSync(videoPath)) {
    console.warn(`  ⚠  Video non trovato: ${basename(videoPath)}`);
    return null;
  }
  console.log(`  ↑  Carico: ${basename(videoPath)} ...`);
  const fileBuffer = readFileSync(videoPath);
  const blob       = new Blob([fileBuffer], { type: 'video/mp4' });
  const form       = new FormData();
  form.append('file', blob, basename(videoPath));

  const res  = await fetch(`${BASE}/media/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}` },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Upload ${res.status}: ${JSON.stringify(body)}`);
  console.log(`  ✓  Caricato → ${body.url}`);
  return body.url;
}

async function schedulePost({ platform, caption, videoPath, scheduledAt, postNow, dry }) {
  if (dry) return { id: 'DRY_RUN', status: 'dry' };

  let mediaUrl = null;
  if (videoPath) {
    mediaUrl = await uploadMedia(videoPath);
  }

  const body = {
    post:      caption,
    platforms: [PLATFORM_MAP[platform]],
  };

  if (postNow) {
    // nessun scheduleDate = pubblica ora
  } else {
    body.scheduleDate = scheduledAt;
  }

  if (mediaUrl) {
    body.mediaUrls = [mediaUrl];
    body.isVideo   = true;
  }

  const res  = await fetch(`${BASE}/post`, {
    method:  'POST',
    headers: HEADERS,
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Post ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2);
const get   = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const has   = (flag) => args.includes(flag);
const isDry = has('--dry');

// --profiles
if (has('--profiles')) {
  const user = await getProfiles();
  console.log('\nAccount Ayrshare:\n');
  console.log(`  Email:     ${user.email}`);
  console.log(`  Piano:     ${user.plan}`);
  console.log(`  Profili:   ${(user.activeSocialAccounts || []).join(', ') || 'nessuno'}\n`);
  if (!user.activeSocialAccounts?.length) {
    console.log('  → Vai su app.ayrshare.com e collega i tuoi profili social.\n');
  }
  process.exit(0);
}

// --launch-week
if (has('--launch-week')) {
  console.log(`\n${isDry ? '[DRY RUN] ' : ''}Schedulo ${LAUNCH_WEEK.length} post — 17-20 aprile\n`);
  let ok = 0, skip = 0;

  for (const { slug, platform, at } of LAUNCH_WEEK) {
    const content = CONTENT[slug];
    const label   = `${slug} → ${platform} @ ${at.replace('T', ' ').replace('Z', ' UTC')}`;

    if (!content) { console.warn(`  –  ${label}: slug non trovato`); skip++; continue; }

    const videoPath = resolve(VIDEO_DIR, content.video);

    try {
      const res = await schedulePost({
        platform,
        caption:     content.caption,
        videoPath,
        scheduledAt: at,
        dry:         isDry,
      });
      const id = res.id || res.postIds?.[0] || '—';
      console.log(`  ✓  ${label}${isDry ? '' : `  (id=${id})`}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${label}\n     ${err.message}`);
      skip++;
    }
  }

  console.log(`\n${ok} schedulati, ${skip} saltati.\n`);
  process.exit(skip > 0 ? 1 : 0);
}

// Post singolo
const slug    = get('--content');
const platform = get('--platform');
const at      = get('--at');
const postNow = has('--now');

if (!slug) {
  console.log(`
Uso:
  node ayrshare-schedule.mjs --profiles
  node ayrshare-schedule.mjs --launch-week [--dry]
  node ayrshare-schedule.mjs --content <slug> --platform <nome> --now
  node ayrshare-schedule.mjs --content <slug> --platform <nome> --at "2026-04-17T18:00:00+02:00"

Slug: ${Object.keys(CONTENT).join(', ')}
Piattaforme: instagram, tiktok, linkedin, youtube
`);
  process.exit(0);
}

if (!platform) { console.error('Specifica --platform'); process.exit(1); }
if (!at && !postNow) { console.error('Specifica --now o --at <datetime ISO>'); process.exit(1); }

const content = CONTENT[slug];
if (!content) { console.error(`Slug non trovato: ${slug}`); process.exit(1); }

const videoPath = resolve(VIDEO_DIR, content.video);
const res = await schedulePost({ platform, caption: content.caption, videoPath, scheduledAt: at, postNow, dry: isDry });
const id  = res.id || res.postIds?.[0] || '—';
console.log(`✓ ${slug}/${platform} ${postNow ? 'in coda ora' : `@ ${at}`}  id=${id}`);
