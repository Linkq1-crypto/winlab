import { getOrCreateBrowserSessionId } from "./browserSession.js";

const ENDPOINT = "/api/events";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "hero_cta_clicked",
  "lab_started",
  "lab_boot_started",
  "lab_boot_completed",
  "command_entered",
  "hint_requested",
  "verify_requested",
  "verify_passed",
  "verify_failed",
  "pricing_clicked",
  "signup_started",
  "signup_completed",
  "checkout_started",
  "checkout_succeeded",
  "checkout_failed",
  "checkout_abandoned",
]);

function syncSessionCookie(sessionId) {
  if (typeof document === "undefined" || !sessionId) return;
  document.cookie = `winlab_session_id=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

function serializePayload(event, payload = {}) {
  const sessionId = getOrCreateBrowserSessionId();
  syncSessionCookie(sessionId);

  return JSON.stringify({
    event,
    payload: {
      path: typeof window !== "undefined" ? window.location.pathname : "",
      sessionId,
      ...payload,
    },
    sessionId,
    ts: new Date().toISOString(),
  });
}

export function trackEvent(event, payload = {}) {
  if (!ALLOWED_EVENTS.has(event)) return false;

  try {
    const body = serializePayload(event, payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      return navigator.sendBeacon(ENDPOINT, body);
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body,
      keepalive: true,
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

export { ALLOWED_EVENTS as TRACKABLE_EVENTS };

