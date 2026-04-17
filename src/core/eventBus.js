/**
 * Event Bus — Central pub/sub system for simulation events
 * Exposes window.emit() for test automation and demo mode
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }

  listenerCount(event) {
    return this.listeners.get(event)?.size || 0;
  }
}

export const eventBus = new EventBus();

// Expose globally for test automation
if (typeof window !== "undefined") {
  window.emit = (event, payload) => eventBus.emit(event, payload);
  window.__EVENT_BUS__ = eventBus;
}
