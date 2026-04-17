/**
 * Timeline Store — Incident log with severity and metadata
 * Maintains a rolling window of the last 200 events
 */

export const SEVERITY = {
  INFO: "INFO",
  WARN: "WARN",
  CRITICAL: "CRITICAL",
};

class TimelineStore {
  constructor(maxEvents = 200) {
    this.events = [];
    this.maxEvents = maxEvents;
  }

  add({ type, message, severity, metadata = {} }) {
    const incident = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      ts: Date.now(),
      type,
      message,
      severity,
      metadata,
    };

    this.events.unshift(incident);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    return incident;
  }

  all() {
    return [...this.events];
  }

  latest() {
    return this.events[0] || null;
  }

  clear() {
    this.events = [];
  }

  getBySeverity(severity) {
    return this.events.filter((e) => e.severity === severity);
  }

  getByType(type) {
    return this.events.filter((e) => e.type === type);
  }

  getRecent(count = 20) {
    return this.events.slice(0, count);
  }

  count() {
    return this.events.length;
  }
}

export const timelineStore = new TimelineStore();

/**
 * Convenience function for logging incidents
 */
export function logIncident(type, message, severity = SEVERITY.INFO, metadata = {}) {
  return timelineStore.add({ type, message, severity, metadata });
}

export default timelineStore;
