// analytics.js – Lightweight event tracking
const ENDPOINT = "/api/analytics/track";

function getSessionId() {
  let sid = sessionStorage.getItem("winlab_sid");
  if (!sid) {
    sid = crypto.randomUUID?.() || Date.now().toString(36);
    sessionStorage.setItem("winlab_sid", sid);
  }
  return sid;
}

function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Kolkata") || tz.includes("Calcutta")) return "IN";
    if (tz.startsWith("Africa")) return "AF";
    if (tz.startsWith("America")) return "AM";
    if (tz.startsWith("Europe")) return "EU";
    if (tz.startsWith("Asia")) return "AS";
  } catch {}
  return "GLOBAL";
}

function detectDevice() {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return "mobile";
  if (/Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

function getUTM() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utm_source:   p.get("utm_source")   || null,
      utm_medium:   p.get("utm_medium")   || null,
      utm_campaign: p.get("utm_campaign") || null,
      utm_content:  p.get("utm_content")  || null,
      referrer:     document.referrer     || null,
    };
  } catch { return {}; }
}

export function track(event, data = {}) {
  try {
    const payload = {
      event,
      sid: getSessionId(),
      region: detectRegion(),
      device: detectDevice(),
      ts: Date.now(),
      url: window.location.pathname,
      ua: navigator.userAgent.slice(0, 100),
      ...getUTM(),
      ...data,
    };
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, JSON.stringify(payload));
    } else {
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
    }
  } catch { /* silently fail */ }
}

// Key events
export const EVENTS = {
  PAGE_VIEW:          "page_view",
  SIGNUP:             "signup",
  LOGIN:              "login",
  LAB_START:          "lab_start",
  LAB_COMPLETE:       "lab_complete",
  LAB_ABANDON:        "lab_abandon",
  UPGRADE_CLICK:      "upgrade_click",
  UPGRADE_SUCCESS:    "upgrade_success",
  ONBOARDING_SKIP:    "onboarding_skip",
  SHARE_LAB:          "share_lab",
  // Launch week
  LANDING_CTA_CLICK:  "landing_cta_click",   // quale CTA, dove sulla pagina
  SECTION_VIEW:       "section_view",         // hero / pricing / early-access / features
  SCROLL_DEPTH:       "scroll_depth",         // 25 / 50 / 75 / 100
  EARLY_ACCESS_START: "early_access_start",   // ha aperto il form
  EARLY_ACCESS_DONE:  "early_access_done",    // signup completato
  COUNTDOWN_SEEN:     "countdown_seen",       // ha visto il banner countdown
};

// ── Auto-track page views ────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  track(EVENTS.PAGE_VIEW);
}

// ── Scroll depth tracker ─────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  const THRESHOLDS = [25, 50, 75, 100];
  const fired = new Set();

  function onScroll() {
    const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    THRESHOLDS.forEach(t => {
      if (!fired.has(t) && scrolled >= t) {
        fired.add(t);
        track(EVENTS.SCROLL_DEPTH, { pct: t });
      }
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
}

// ── Section intersection observer ────────────────────────────────────────────
if (typeof window !== "undefined" && typeof IntersectionObserver !== "undefined") {
  const SECTIONS = ["#hero", "#pricing", "#early-access", "#features", "#labs"];
  const firedSections = new Set();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !firedSections.has(entry.target.id)) {
        firedSections.add(entry.target.id);
        track(EVENTS.SECTION_VIEW, { section: entry.target.id });
      }
    });
  }, { threshold: 0.4 });

  // Observe once DOM is ready
  window.addEventListener("DOMContentLoaded", () => {
    SECTIONS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) observer.observe(el);
    });
  });
}
