const ALLOWED_EVENT_TYPES = new Set([
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

const SCORE_RULES = [
  { counter: "labStartedCount", threshold: 1, points: 10 },
  { counter: "commandCount", threshold: 5, points: 15 },
  { counter: "hintRequestedCount", threshold: 1, points: 10 },
  { counter: "verifyFailedCount", threshold: 1, points: 10 },
  { counter: "verifyPassedCount", threshold: 1, points: 30 },
  { counter: "pricingClickedCount", threshold: 1, points: 25 },
  { counter: "checkoutStartedCount", threshold: 1, points: 40 },
  { counter: "checkoutAbandonedCount", threshold: 1, points: 20 },
];

const EVENT_COUNTER_MAP = {
  lab_started: "labStartedCount",
  command_entered: "commandCount",
  hint_requested: "hintRequestedCount",
  verify_failed: "verifyFailedCount",
  verify_passed: "verifyPassedCount",
  pricing_clicked: "pricingClickedCount",
  checkout_started: "checkoutStartedCount",
  checkout_succeeded: "checkoutSucceededCount",
  checkout_failed: "checkoutFailedCount",
  checkout_abandoned: "checkoutAbandonedCount",
};

function safeString(value, maxLen = 240) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function isAllowedRevenueEvent(eventType) {
  return ALLOWED_EVENT_TYPES.has(String(eventType || "").trim());
}

export function sanitizeSensitiveText(input, maxLen = 240) {
  const value = safeString(input, maxLen * 2);
  if (!value) return "";

  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [REDACTED]")
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*([^\s]+)/gi, "$1=[REDACTED]")
    .replace(/((?:password|passwd|token|secret|api[_-]?key|authorization))\s*[:=]\s*([^\s]+)/gi, "$1=[REDACTED]")
    .replace(/\b(sk_(?:live|test)_[A-Za-z0-9]+)\b/g, "[REDACTED]")
    .replace(/\b(ghp_[A-Za-z0-9]+)\b/g, "[REDACTED]")
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]+)\b/g, "[REDACTED]")
    .slice(0, maxLen);
}

function pickDefinedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

export function sanitizeEventPayload(eventType, payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const base = {
    path: safeString(source.path),
    location: safeString(source.location),
    component: safeString(source.component),
    trigger: safeString(source.trigger),
    source: safeString(source.source),
    plan: safeString(source.plan),
    currency: safeString(source.currency, 24),
    labId: safeString(source.labId, 120),
    labTitle: safeString(source.labTitle),
    levelId: safeString(source.levelId, 40),
    mode: safeString(source.mode, 40),
    cta: safeString(source.cta, 80),
    statusCode: Number.isFinite(Number(source.statusCode)) ? Number(source.statusCode) : undefined,
    success: typeof source.success === "boolean" ? source.success : undefined,
  };

  switch (eventType) {
    case "command_entered":
      return pickDefinedEntries([
        ["labId", base.labId],
        ["levelId", base.levelId],
        ["source", base.source],
        ["command", sanitizeSensitiveText(source.command, 320)],
      ]);
    case "verify_requested":
    case "verify_passed":
    case "verify_failed":
      return pickDefinedEntries([
        ["labId", base.labId],
        ["levelId", base.levelId],
        ["source", base.source],
        ["success", base.success],
      ]);
    case "hint_requested":
      return pickDefinedEntries([
        ["labId", base.labId],
        ["source", base.source],
        ["trigger", base.trigger],
      ]);
    case "checkout_started":
    case "checkout_succeeded":
    case "checkout_failed":
    case "checkout_abandoned":
      return pickDefinedEntries([
        ["plan", base.plan],
        ["currency", base.currency],
        ["labId", base.labId],
        ["source", base.source],
        ["trigger", base.trigger],
        ["statusCode", base.statusCode],
      ]);
    default:
      return pickDefinedEntries(Object.entries(base));
  }
}

export function resolveIntentScore(profileLike = {}) {
  const score = SCORE_RULES.reduce((sum, rule) => {
    const count = Number(profileLike?.[rule.counter] || 0);
    return sum + (count >= rule.threshold ? rule.points : 0);
  }, 0);

  return Math.min(100, score);
}

export function deriveConversionState(profileLike = {}) {
  if (profileLike?.paidAt || Number(profileLike?.checkoutSucceededCount || 0) > 0) {
    return "paid";
  }

  const score = resolveIntentScore(profileLike);
  if (score >= 80) return "ready_to_convert";
  if (score >= 50) return "high_intent";
  if (score >= 10) return "engaged";
  return "anonymous";
}

function applyIncrementPatch(eventType) {
  const counter = EVENT_COUNTER_MAP[eventType];
  return counter ? { [counter]: { increment: 1 } } : {};
}

function mergeProfileCounts(primary, secondary) {
  const merged = {};
  for (const counter of Object.values(EVENT_COUNTER_MAP)) {
    merged[counter] = Number(primary?.[counter] || 0) + Number(secondary?.[counter] || 0);
  }
  return merged;
}

function withProfileDefaults(profile = {}) {
  const next = { ...profile };
  for (const counter of Object.values(EVENT_COUNTER_MAP)) {
    if (!Number.isFinite(Number(next[counter]))) {
      next[counter] = 0;
    } else {
      next[counter] = Number(next[counter]);
    }
  }
  return next;
}

async function createProfile(tx, { userId = null, sessionId = null, occurredAt }) {
  return tx.userProfile.create({
    data: {
      userId,
      sessionId,
      lastEventAt: occurredAt,
    },
  });
}

async function resolveProfile(tx, { userId = null, sessionId = null, occurredAt }) {
  const userProfile = userId ? await tx.userProfile.findUnique({ where: { userId } }) : null;
  const sessionProfile = sessionId ? await tx.userProfile.findUnique({ where: { sessionId } }) : null;

  if (userProfile && sessionProfile && userProfile.id !== sessionProfile.id) {
    const mergedCounts = mergeProfileCounts(userProfile, sessionProfile);
    const paidAt = userProfile.paidAt || sessionProfile.paidAt || null;
    const merged = await tx.userProfile.update({
      where: { id: userProfile.id },
      data: {
        ...mergedCounts,
        sessionId: userProfile.sessionId || sessionProfile.sessionId || sessionId || null,
        paidAt,
        lastEventAt: occurredAt,
      },
    });
    await tx.userProfile.delete({ where: { id: sessionProfile.id } });
    return merged;
  }

  if (userProfile) {
    return tx.userProfile.update({
      where: { id: userProfile.id },
      data: {
        sessionId: userProfile.sessionId || sessionId || null,
        lastEventAt: occurredAt,
      },
    });
  }

  if (sessionProfile) {
    return tx.userProfile.update({
      where: { id: sessionProfile.id },
      data: {
        userId: sessionProfile.userId || userId || null,
        lastEventAt: occurredAt,
      },
    });
  }

  return createProfile(tx, { userId, sessionId, occurredAt });
}

export async function recordRevenueEvent({
  prisma,
  eventType,
  payload = {},
  userId = null,
  sessionId = null,
  occurredAt = new Date(),
}) {
  if (!isAllowedRevenueEvent(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }

  const sanitizedPayload = sanitizeEventPayload(eventType, payload);
  const resolvedOccurredAt = occurredAt instanceof Date ? occurredAt : new Date(occurredAt || Date.now());

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        type: eventType,
        source: "revenue_engine",
        userId,
        sessionId,
        occurredAt: resolvedOccurredAt,
        payload: JSON.stringify(sanitizedPayload),
        status: "done",
        processedAt: new Date(),
        version: 1,
        attempts: 0,
      },
    });

    const profile = await resolveProfile(tx, { userId, sessionId, occurredAt: resolvedOccurredAt });
    const incrementPatch = applyIncrementPatch(eventType);
    const nextCounts = withProfileDefaults({
      ...profile,
      ...Object.fromEntries(
        Object.entries(incrementPatch).map(([key, value]) => [key, Number(profile?.[key] || 0) + Number(value?.increment || 0)])
      ),
      paidAt: eventType === "checkout_succeeded" ? resolvedOccurredAt : profile?.paidAt || null,
    });
    const intentScore = resolveIntentScore(nextCounts);
    const conversionState = deriveConversionState(nextCounts);

    const updatedProfile = await tx.userProfile.update({
      where: { id: profile.id },
      data: {
        ...incrementPatch,
        userId: profile.userId || userId || null,
        sessionId: profile.sessionId || sessionId || null,
        paidAt: eventType === "checkout_succeeded" ? resolvedOccurredAt : profile.paidAt || null,
        lastEventAt: resolvedOccurredAt,
        intentScore,
        conversionState,
      },
    });

    return { event, profile: updatedProfile };
  });
}

export const _test = {
  ALLOWED_EVENT_TYPES,
  EVENT_COUNTER_MAP,
  SCORE_RULES,
  applyIncrementPatch,
  mergeProfileCounts,
  withProfileDefaults,
};

