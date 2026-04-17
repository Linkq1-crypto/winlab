// src/network/analyticsEngine.js
// Real conversion tracking + heatmap + auto-optimization + dynamic paywall
// TRACK EVERYTHING → OPTIMIZE AUTOMATICALLY → MAXIMIZE REVENUE

class AnalyticsEngine {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.events = [];
    this.clickHeatmap = {};
    this.conversionData = {
      labStarts: 0,
      labCompletions: 0,
      hintUses: 0,
      errors: 0,
      timeToComplete: {},
      dropoffPoints: [],
      upgradeClicks: 0,
      paywallShown: 0,
      region: "GLOBAL",
    };
    this.userBehavior = {
      totalClicks: 0,
      clickPositions: [],
      scrollDepth: 0,
      timeOnPage: 0,
      commandsAttempted: [],
    };

    this.optimizePaywall = this.optimizePaywall.bind(this);
    this.trackClick = this.trackClick.bind(this);
    this.trackScroll = this.trackScroll.bind(this);

    this.initAutoTracking();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ── Event Tracking ──────────────────────────────────────────────────────
  track(event, data = {}) {
    const timestamp = new Date().toISOString();
    const eventObj = { event, data, timestamp, sessionId: this.sessionId };
    this.events.push(eventObj);

    // Update conversion metrics
    switch (event) {
      case "lab_start":
        this.conversionData.labStarts++;
        break;
      case "lab_complete":
        this.conversionData.labCompletions++;
        this.conversionData.timeToComplete[data.labId] = data.timeMs;
        break;
      case "hint_use":
        this.conversionData.hintUses++;
        break;
      case "command_error":
        this.conversionData.errors++;
        break;
      case "upgrade_click":
        this.conversionData.upgradeClicks++;
        break;
      case "paywall_shown":
        this.conversionData.paywallShown++;
        break;
      case "dropoff":
        this.conversionData.dropoffPoints.push({ labId: data.labId, timeMs: data.timeMs });
        break;
    }

    // Send to analytics backend (fire-and-forget)
    this.sendToBackend(eventObj);
    this.saveToLocalStorage();
  }

  async sendToBackend(eventObj) {
    try {
      navigator.sendBeacon?.("/api/analytics/track", JSON.stringify(eventObj)) ||
        fetch("/api/analytics/track", {
          method: "POST",
          body: JSON.stringify(eventObj),
          keepalive: true,
        });
    } catch {
      // Analytics should never break UX
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem("winlab_analytics", JSON.stringify({
        sessionId: this.sessionId,
        conversionData: this.conversionData,
        lastEventCount: this.events.length,
      }));
    } catch {}
  }

  // ── Heatmap Tracking ────────────────────────────────────────────────────
  trackClick(e) {
    const x = e.clientX || 0;
    const y = e.clientY || 0;
    const key = `${Math.round(x / 50) * 50},${Math.round(y / 50) * 50}`;

    this.clickHeatmap[key] = (this.clickHeatmap[key] || 0) + 1;
    this.userBehavior.totalClicks++;
    this.userBehavior.clickPositions.push({ x, y, timestamp: Date.now() });

    // Save heatmap
    try {
      localStorage.setItem("winlab_heatmap", JSON.stringify(this.clickHeatmap));
    } catch {}
  }

  trackScroll() {
    const scrollDepth = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    this.userBehavior.scrollDepth = Math.max(this.userBehavior.scrollDepth, scrollDepth);
  }

  initAutoTracking() {
    if (typeof window === "undefined") return;

    // Track clicks
    document.addEventListener("click", this.trackClick);

    // Track scroll depth
    window.addEventListener("scroll", this.trackScroll, { passive: true });

    // Track time on page
    setInterval(() => {
      this.userBehavior.timeOnPage++;
    }, 1000);

    // Track drop-off (page unload)
    window.addEventListener("beforeunload", () => {
      this.track("dropoff", {
        scrollDepth: this.userBehavior.scrollDepth,
        timeOnPage: this.userBehavior.timeOnPage,
        labsCompleted: this.conversionData.labCompletions,
      });
      this.saveToLocalStorage();
    });
  }

  // ── Conversion Funnel ───────────────────────────────────────────────────
  getConversionRate() {
    if (this.conversionData.labStarts === 0) return 0;
    return (this.conversionData.labCompletions / this.conversionData.labStarts) * 100;
  }

  getPaywallConversionRate() {
    if (this.conversionData.paywallShown === 0) return 0;
    return (this.conversionData.upgradeClicks / this.conversionData.paywallShown) * 100;
  }

  getAverageTimeToComplete() {
    const times = Object.values(this.conversionData.timeToComplete);
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  getFunnel() {
    return {
      landingViews: this.events.filter(e => e.event === "page_view").length,
      labStarts: this.conversionData.labStarts,
      labCompletions: this.conversionData.labCompletions,
      paywallShown: this.conversionData.paywallShown,
      upgradeClicks: this.conversionData.upgradeClicks,
      conversionRate: this.getConversionRate().toFixed(2) + "%",
      paywallConversionRate: this.getPaywallConversionRate().toFixed(2) + "%",
    };
  }

  // ── Dynamic Paywall Optimization ────────────────────────────────────────
  optimizePaywall() {
    const { labCompletions, paywallShown, upgradeClicks } = this.conversionData;

    // Calculate optimal trigger point
    const completionRate = labCompletions > 0 ? paywallShown / labCompletions : 0;
    const clickRate = paywallShown > 0 ? upgradeClicks / paywallShown : 0;

    // If low click rate → show paywall later (after more value)
    if (clickRate < 0.1) {
      return {
        triggerAfterLabs: 2, // Wait for 2 labs
        price: "₹199/month",
        message: "You're making real progress. Unlock all labs to continue.",
      };
    }

    // If high click rate → show paywall earlier (they're engaged)
    if (clickRate > 0.3) {
      return {
        triggerAfterLabs: 1, // Show after 1 lab
        price: "₹199/month",
        message: "Ready for more? Unlock unlimited labs.",
      };
    }

    // Default
    return {
      triggerAfterLabs: 1,
      price: "₹199/month",
      message: "You're making real progress. Unlock all labs to continue.",
    };
  }

  // ── Get Heatmap Data ────────────────────────────────────────────────────
  getHeatmap() {
    return this.clickHeatmap;
  }

  // ── Stop tracking ───────────────────────────────────────────────────────
  destroy() {
    if (typeof window === "undefined") return;
    document.removeEventListener("click", this.trackClick);
    window.removeEventListener("scroll", this.trackScroll);
  }
}

// ── Global singleton ──────────────────────────────────────────────────────────
let globalAnalytics = null;

export function getAnalytics() {
  if (!globalAnalytics) {
    globalAnalytics = new AnalyticsEngine();
  }
  return globalAnalytics;
}

export function getFunnelData() {
  const engine = getAnalytics();
  return engine.getFunnel();
}

export function getOptimizedPaywall() {
  const engine = getAnalytics();
  return engine.optimizePaywall();
}
