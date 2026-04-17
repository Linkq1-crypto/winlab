// PostHog analytics integration
let posthogInstance = null;

export function initPosthog() {
  if (typeof window === "undefined") return;
  if (posthogInstance) return posthogInstance;

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    console.warn("[PostHog] No VITE_POSTHOG_KEY found — tracking disabled");
    return null;
  }

  // Dynamically load PostHog script
  const script = document.createElement("script");
  script.src = "https://app.posthog.com/static/array.js";
  script.onload = () => {
    if (window.posthog) {
      window.posthog.init(key, {
        api_host: "https://app.posthog.com",
        capture_pageview: true,
        persistence: "localStorage",
      });
      posthogInstance = window.posthog;
      console.log("[PostHog] Initialized");
    }
  };
  document.head.appendChild(script);

  return null;
}

export function trackEvent(eventName, properties = {}) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(eventName, properties);
  } else {
    // Fallback: log to console in dev
    if (import.meta.env.DEV) {
      console.log(`[PostHog] ${eventName}`, properties);
    }
  }
}

export function identifyUser(userId, userProperties = {}) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.identify(userId, userProperties);
  }
}
