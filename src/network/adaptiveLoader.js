// src/network/adaptiveLoader.js
// Adaptive network loader for 2G/3G/4G/GSM networks with progressive degradation
// Ensures WinLab works on very poor connections (India/Africa rural areas)

const DEFAULT_CONFIG = {
  probe: {
    url: '/healthz/ping.txt',
    sizeBytes: 40_000,
    timeoutMs: 3_500,
  },
  thresholds: {
    minimal: {
      rttMs: 1_200,
      kbps: 150,
      failRate: 0.2,
    },
    standard: {
      rttMs: 400,
      kbps: 800,
      failRate: 0.08,
    },
  },
  reevaluateMs: 45_000,
  samplesWindow: 20,
};

function mergeConfig(base, patch) {
  return {
    ...base,
    ...patch,
    probe: {
      ...base.probe,
      ...(patch.probe || {}),
    },
    thresholds: {
      ...base.thresholds,
      ...(patch.thresholds || {}),
      minimal: {
        ...base.thresholds.minimal,
        ...(patch.thresholds?.minimal || {}),
      },
      standard: {
        ...base.thresholds.standard,
        ...(patch.thresholds?.standard || {}),
      },
    },
  };
}

function readConnectionHints() {
  if (typeof navigator === 'undefined') {
    return {
      effectiveType: 'unknown',
      downlink: null,
      rtt: null,
      saveData: false,
    };
  }

  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return { effectiveType: 'standard', downlink: null, rtt: null, saveData: false };
  return {
    effectiveType: c.effectiveType || 'unknown',
    downlink: Number.isFinite(c.downlink) ? c.downlink : null,
    rtt: Number.isFinite(c.rtt) ? c.rtt : null,
    saveData: Boolean(c.saveData),
  };
}

function recentFailRate(samples) {
  if (!samples.length) return 0;
  const fails = samples.filter((x) => !x.ok).length;
  return fails / samples.length;
}

function isMinimalByRules({ hints, probe, failRate, thresholds }) {
  if (['slow-2g', '2g'].includes(hints.effectiveType)) return true;
  return (
    probe.rttMs >= thresholds.rttMs ||
    probe.kbps <= thresholds.kbps ||
    failRate >= thresholds.failRate
  );
}

function isFullByRules({ probe, failRate, thresholds }) {
  return (
    probe.ok &&
    probe.rttMs <= thresholds.rttMs &&
    probe.kbps >= thresholds.kbps &&
    failRate <= thresholds.failRate
  );
}

function scoreNetwork({ hints, probe, failRate }) {
  let score = 50;

  if (['4g'].includes(hints.effectiveType)) score += 15;
  if (['3g'].includes(hints.effectiveType)) score += 5;
  if (['2g', 'slow-2g'].includes(hints.effectiveType)) score -= 25;

  if (probe.rttMs < 350) score += 15;
  if (probe.rttMs > 1_200) score -= 20;

  if (probe.kbps > 900) score += 15;
  if (probe.kbps < 150) score -= 25;

  if (failRate > 0.2) score -= 20;
  if (failRate < 0.05) score += 10;

  if (hints.saveData) score -= 30;

  return Math.max(0, Math.min(100, score));
}

export async function runProbe({ url, sizeBytes, timeoutMs }) {
  if (typeof fetch === 'undefined' || !url) {
    return { ok: false, rttMs: Infinity, kbps: 0 };
  }

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}?_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'x-probe-size': String(sizeBytes),
      },
    });

    if (!response.ok) {
      throw new Error(`Probe failed with status ${response.status}`);
    }

    const text = await response.text();
    const durationMs = Math.max(1, performance.now() - started);
    const bytes = new TextEncoder().encode(text).length || sizeBytes;
    const kbps = (bytes * 8) / durationMs;

    return { ok: true, rttMs: durationMs, kbps };
  } catch {
    return { ok: false, rttMs: Infinity, kbps: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export class AdaptiveLoader {
  constructor(options = {}) {
    this.config = mergeConfig(DEFAULT_CONFIG, options);
    this.profile = 'standard';
    this.requestSamples = [];
    this.listeners = new Set();
    this.reevaluateTimer = null;
    this.boundOnOnline = () => this.evaluateAndNotify('network:online');
    this.boundOnOffline = () => this.setProfile('minimal', 'network:offline');
    this.boundOnConnectionChange = () => this.evaluateAndNotify('network:change');
  }

  async start() {
    this.attachEvents();
    await this.evaluateAndNotify('startup');
    this.startReevaluation();
    return this.profile;
  }

  stop() {
    this.detachEvents();
    if (this.reevaluateTimer) {
      clearInterval(this.reevaluateTimer);
      this.reevaluateTimer = null;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ profile: this.profile, reason: 'subscribe' });
    return () => this.listeners.delete(listener);
  }

  recordRequest({ ok, durationMs }) {
    this.requestSamples.push({ ok: !!ok, durationMs: Number(durationMs) || 0, ts: Date.now() });
    if (this.requestSamples.length > this.config.samplesWindow) {
      this.requestSamples.shift();
    }
  }

  async evaluateAndNotify(reason = 'manual') {
    const next = await this.evaluateProfile();
    this.setProfile(next, reason);
    return next;
  }

  async evaluateProfile() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'minimal';
    }

    const hints = readConnectionHints();
    if (hints.saveData) return 'minimal';

    const probe = await runProbe(this.config.probe);
    const failRate = recentFailRate(this.requestSamples);
    scoreNetwork({ hints, probe, failRate });

    if (isMinimalByRules({ hints, probe, failRate, thresholds: this.config.thresholds.minimal })) {
      return 'minimal';
    }

    if (isFullByRules({ probe, failRate, thresholds: this.config.thresholds.standard })) {
      return 'full';
    }

    return 'standard';
  }

  attachEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', this.boundOnOnline);
    window.addEventListener('offline', this.boundOnOffline);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', this.boundOnConnectionChange);
    }
  }

  detachEvents() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', this.boundOnOnline);
    window.removeEventListener('offline', this.boundOnOffline);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && typeof connection.removeEventListener === 'function') {
      connection.removeEventListener('change', this.boundOnConnectionChange);
    }
  }

  startReevaluation() {
    this.reevaluateTimer = setInterval(() => {
      this.evaluateAndNotify('timer').catch(() => {
        this.setProfile('minimal', 'timer:error');
      });
    }, this.config.reevaluateMs);
  }

  setProfile(profile, reason) {
    if (profile === this.profile) return;
    this.profile = profile;
    for (const listener of this.listeners) {
      listener({ profile, reason });
    }
  }
}

export async function loadByProfile({ profile, loaders }) {
  if (profile === 'minimal') return loaders.minimal();
  if (profile === 'full') return loaders.full();
  return loaders.standard();
}

// ── Global singleton ──────────────────────────────────────────────────────────
let globalLoader = null;

export function getAdaptiveLoader() {
  if (!globalLoader) {
    globalLoader = new AdaptiveLoader();
  }
  return globalLoader;
}
