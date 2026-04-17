// ── Publisher Config ──────────────────────────────────────────────────────────
// Edit this file with your real account IDs and API keys.

export const REDIS = {
  host: "127.0.0.1",
  port: 6379,
  // password: "your-redis-password",  // uncomment if Redis has auth
};

// ── Platform accounts ────────────────────────────────────────────────────────
// Add multiple accounts for rotation. Each needs a session file saved via:
//   node login.mjs --platform instagram --account acc_main
export const ACCOUNTS = {
  instagram: [
    { id: "ig_main",  sessionFile: "sessions/ig/main.json" },
  ],
  facebook: [
    { id: "fb_main",  sessionFile: "sessions/fb/main.json" },
  ],
  linkedin: [
    { id: "li_main",  sessionFile: "sessions/linkedin/main.json" },
  ],
  tiktok: [
    { id: "tt_main",  sessionFile: "sessions/tiktok/main.json" },
  ],
};

// ── YouTube OAuth2 ───────────────────────────────────────────────────────────
// Get from Google Cloud Console → APIs & Services → Credentials
// Enable: YouTube Data API v3
export const YOUTUBE = {
  clientId:     process.env.YT_CLIENT_ID     || "YOUR_CLIENT_ID",
  clientSecret: process.env.YT_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
  redirectUri:  "urn:ietf:wg:oauth:2.0:oob",
  tokenFile:    "sessions/yt_token.json",
};

// ── Captions per platform per video ─────────────────────────────────────────
// Loaded by schedule.mjs when scheduling content
export const VIDEO_BASE_PATH = "../output";

export const CONTENT = {
  "connection_lost": {
    instagram: {
      caption: "Your internet shouldn't decide your career.\n\nThis sysadmin completed a full Linux lab on a 2G connection in rural India.\n\nWinLab works offline. Period.\n\n#Linux #SysAdmin #DevOps #TechEducation #WinLab #ITCareers",
      video: "connection_lost.mp4",
    },
    facebook: {
      caption: "Same skills. Different outcome.\n\nA junior sysadmin in Bangalore lost his connection mid-lab.\nHe kept going anyway — because WinLab works on 2G.\n\nTry it free → winlab.cloud",
      video: "connection_lost.mp4",
    },
    linkedin: {
      caption: "Talent is universal. Access shouldn't be the barrier.\n\nWe built WinLab to work on any connection — 2G, 3G, offline.\nBecause the best sysadmin might be somewhere with bad internet.\n\nReal Linux labs. Real vSphere. Real RAID. Browser-based.\n\n→ winlab.cloud\n\n#DevOps #Linux #CloudComputing #ITEducation #TechSkills",
      video: "connection_lost.mp4",
    },
    tiktok: {
      caption: "POV: you're studying Linux sysadmin on a 2G connection and it just works ⚡ #Linux #SysAdmin #TechTok #DevOps #WinLab",
      video: "connection_lost.mp4",
    },
    youtube: {
      title: "Fix a Broken Server on 2G — WinLab",
      description: "Watch how a sysadmin diagnoses and fixes a downed web server in WinLab — even on a 2G connection.\n\n✅ No VM required\n✅ Works offline\n✅ Real Linux scenarios\n\nTry it free: https://winlab.cloud\n\n#Linux #SysAdmin #DevOps",
      tags: ["Linux", "SysAdmin", "DevOps", "WinLab", "IT", "Cloud"],
      video: "connection_lost.mp4",
      thumbnail: null,
    },
  },
  "hero_launch": {
    instagram: {
      caption: "Break servers safely. Save your career.\n\n10 interactive labs. AI mentor. Real scenarios.\n\n🔒 Early access $5 — 72h only\n→ winlab.cloud\n\n#Linux #SysAdmin #vSphere #RAID #DevOps #ITLab",
      video: "hero_launch.mp4",
    },
    facebook: {
      caption: "Launch week: WinLab is live.\n\nThe only browser-based sysadmin simulator where you can fail safely — without taking down production.\n\nLinux · vSphere · RAID · SSSD · Terraform\n\n🔒 Lock your $5 early access price → winlab.cloud",
      video: "hero_launch.mp4",
    },
    linkedin: {
      caption: "WinLab is officially live.\n\nWe've built 10 hands-on sysadmin labs — Linux, vSphere, RAID, SSSD, Terraform — that run entirely in your browser.\n\nNo VMs. No setup. No taking production down while you learn.\n\n🔒 Early access at $5 (72h window) → winlab.cloud\n\n#SysAdmin #Linux #vSphere #DevOps #ITTraining",
      video: "hero_launch.mp4",
    },
    tiktok: {
      caption: "I broke a production server and fixed it without touching anything real 😅 WinLab hits different #SysAdmin #Linux #DevOps #WinLab #TechTok",
      video: "hero_launch_vertical.mp4",
    },
    youtube: {
      title: "WinLab Launch — Hands-On Sysadmin Training in Your Browser",
      description: "WinLab is a browser-based sysadmin simulator. Practice Linux, vSphere, RAID, SSSD and Terraform without a VM.\n\nTry it free: https://winlab.cloud\n\n#Linux #SysAdmin #DevOps #vSphere #RAID",
      tags: ["Linux", "SysAdmin", "vSphere", "RAID", "DevOps", "WinLab", "IT Training"],
      video: "hero_launch.mp4",
      thumbnail: null,
    },
  },
  "fail_fix": {
    instagram: {
      caption: "The first 30 minutes of any sysadmin job:\n\n$ systemctl status nginx\n✗ Active: failed\n\n→ 10 mins of panic\n→ logs, logs, logs\n→ fixed\n\nPractice this loop safely → winlab.cloud\n\n#Linux #SysAdmin #Nginx #DevOps #WinLab",
      video: "fail_fix.mp4",
    },
    linkedin: {
      caption: "Every sysadmin knows this feeling.\n\nService down. On-call. 2AM.\nYou need to fix it fast — without making it worse.\n\nWinLab gives you a safe sandbox to practice exactly this.\nFail. Learn. Fix. Repeat.\n\n→ winlab.cloud\n\n#Linux #SysAdmin #DevOps #ITOps",
      video: "fail_fix.mp4",
    },
    tiktok: {
      caption: "nginx is down at 2AM and you're on call 💀 here's how to debug it fast #SysAdmin #Linux #Nginx #TechTok #DevOps",
      video: "fail_fix.mp4",
    },
  },
  "career": {
    instagram: {
      caption: "Junior → SysAdmin → Infra Engineer → AI Ops → Enterprise Architect\n\nOne path. 5 levels.\nAll in your browser.\n\n→ winlab.cloud\n\n#CareerPath #SysAdmin #Linux #DevOps #ITCareers #WinLab",
      video: "career.mp4",
    },
    linkedin: {
      caption: "We mapped 5 real sysadmin career paths — and built the labs to match.\n\nJunior → SysAdmin → Infra → AI Ops → Enterprise Architect\n\nEach path: ordered labs, skill tree, verified certificate.\n\n→ winlab.cloud\n\n#CareerDevelopment #SysAdmin #Linux #IT #DevOps",
      video: "career.mp4",
    },
  },
  "watching_vs_doing": {
    instagram: {
      caption: "Watching 4 hours of YouTube tutorials vs doing 1 lab on WinLab.\n\nGuess which one gets you hired.\n\n→ winlab.cloud\n\n#SysAdmin #Linux #LearnByDoing #DevOps #TechEducation",
      video: "watching_vs_doing.mp4",
    },
    tiktok: {
      caption: "watching linux tutorials for 4 hours vs actually doing linux for 20 minutes 💀 #Linux #SysAdmin #WinLab #TechTok #LearnToCode",
      video: "watching_vs_doing.mp4",
    },
  },
};
