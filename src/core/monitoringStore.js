/**
 * Monitoring Store — Lightweight reactive metrics store
 * Uses simple pub/sub pattern (no external deps)
 */

const subscribers = new Set();

const state = {
  errors: 0,
  apiCalls: 0,
  apiFailures: 0,
  events: 0,
  latency: [],
  history: [], // Time series for charts
};

function notify() {
  for (const fn of subscribers) {
    try {
      fn({ ...state });
    } catch (err) {
      console.error("[MonitoringStore] Subscriber error:", err);
    }
  }
}

export const monitoringStore = {
  getState() {
    return { ...state };
  },

  setState(updates) {
    if (typeof updates === "function") {
      updates(state);
    } else {
      Object.assign(state, updates);
    }
    notify();
  },

  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },

  // Metric helpers
  recordApiCall(latency = 0, success = true) {
    state.apiCalls += 1;
    if (latency > 0) state.latency.push(latency);
    if (!success) state.apiFailures += 1;
    // Keep latency array bounded
    if (state.latency.length > 200) state.latency = state.latency.slice(-200);
    notify();
  },

  recordError() {
    state.errors += 1;
    notify();
  },

  recordEvent() {
    state.events += 1;
    notify();
  },

  pushHistoryPoint() {
    const avgLatency =
      state.latency.length > 0
        ? Math.round(state.latency.reduce((a, b) => a + b, 0) / state.latency.length)
        : 0;

    state.history.push({
      time: Date.now(),
      latency: avgLatency,
      errors: state.errors,
      api: state.apiCalls,
      failures: state.apiFailures,
    });

    // Keep last 60 points (~30s at 500ms sampling)
    if (state.history.length > 60) {
      state.history = state.history.slice(-60);
    }
    notify();
  },

  reset() {
    state.errors = 0;
    state.apiCalls = 0;
    state.apiFailures = 0;
    state.events = 0;
    state.latency = [];
    state.history = [];
    notify();
  },
};

// Expose globally for monitoring sampler
if (typeof window !== "undefined") {
  window.__MONITORING_STORE__ = monitoringStore;
}

export default monitoringStore;
