export const DEFAULT_LAUNCH_START_AT = "2026-05-01T21:00:00+02:00";
export const LAUNCH_DURATION_MS = 72 * 60 * 60 * 1000;

export function parseLaunchStartAt(value = DEFAULT_LAUNCH_START_AT) {
  const parsedMs = Date.parse(value);
  if (!Number.isFinite(parsedMs)) {
    throw new Error(`Invalid LAUNCH_START_AT value: ${value}`);
  }
  return parsedMs;
}

export function buildLaunchWindow(startAt = DEFAULT_LAUNCH_START_AT) {
  const launchStartMs = parseLaunchStartAt(startAt);
  const launchEndMs = launchStartMs + LAUNCH_DURATION_MS;

  return {
    launchStartMs,
    launchEndMs,
    launchStart: new Date(launchStartMs).toISOString(),
    launchEnd: new Date(launchEndMs).toISOString(),
  };
}

export function getLaunchState({ launchStartMs, launchEndMs, nowMs = Date.now() }) {
  let phase = "before";
  let remainingMs = Math.max(0, launchStartMs - nowMs);

  if (nowMs >= launchStartMs && nowMs <= launchEndMs) {
    phase = "active";
    remainingMs = Math.max(0, launchEndMs - nowMs);
  } else if (nowMs > launchEndMs) {
    phase = "expired";
    remainingMs = 0;
  }

  return {
    earlyAccessActive: phase === "active",
    remainingMs,
    phase,
  };
}

export function normalizeLaunchPricingPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const launchStartMs = Date.parse(payload.launchStart);
  const launchEndMs = Date.parse(payload.launchEnd);
  if (!Number.isFinite(launchStartMs) || !Number.isFinite(launchEndMs)) return null;

  return {
    phase: payload.phase,
    earlyAccessActive: payload.earlyAccessActive === true,
    remainingMs: Number.isFinite(payload.remainingMs) ? payload.remainingMs : 0,
    launchStart: payload.launchStart,
    launchEnd: payload.launchEnd,
    launchStartMs,
    launchEndMs,
  };
}

export function getLaunchCountdownState(pricing, nowMs) {
  if (!pricing) return null;

  const state = getLaunchState({
    launchStartMs: pricing.launchStartMs,
    launchEndMs: pricing.launchEndMs,
    nowMs,
  });

  if (state.phase === "expired") {
    return {
      ...state,
      visible: false,
      label: "",
      countdown: "",
    };
  }

  return {
    ...state,
    visible: true,
    label: state.phase === "before" ? "Early Access opens in:" : "72h Launch · Ends in:",
    countdown: formatCountdown(state.remainingMs),
  };
}

export function formatCountdown(inputMs) {
  const totalSeconds = Math.max(0, Math.floor((inputMs || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hh}h ${mm}m ${ss}s`;
  }

  return `${hh}h ${mm}m ${ss}s`;
}
