/**
 * State Rebuild Engine — Pure Event Sourcing
 *
 * Principle: state does NOT exist in the DB.
 * It is always computed from the ordered event log.
 *
 *   state = INITIAL_STATE
 *   for event in ordered_event_log(device_id, sequence):
 *       state = reducer(state, event)
 *   return state
 *
 * Rules:
 *   - No randomness inside reducer
 *   - No DB reads inside reducer
 *   - No side effects during replay
 *   - Same event log → same state, always
 */

// ──── Initial State ────
export const INITIAL_STATE = Object.freeze({
  users:         {},  // userId → UserState
  labProgress:   {},  // userId → { [labId]: { completed, score, updatedAt } }
  subscriptions: {},  // userId → SubscriptionState
  skills:        {},  // userId → { [branch]: { xp, sessionsCompleted, bestScore } }
  badges:        {},  // userId → string[]
  payments:      {},  // userId → PaymentState[]
  earlyAccess:   {},  // email  → EarlyAccessState
});

// ──── Reducer ────
/**
 * Pure function: apply one event to current state.
 * Returns a NEW state object — never mutates input.
 *
 * @param {object} state  - Current state (starts from INITIAL_STATE)
 * @param {object} event  - { id, type, payload (JSON string or object), createdAt }
 * @returns {object}      - Next state
 */
export function reducer(state, event) {
  const payload = parsePayload(event.payload);
  const type    = event.type;

  switch (type) {
    case 'USER_REGISTERED':
      return applyUserRegistered(state, payload, event);

    case 'USER_UPDATED':
      return applyUserUpdated(state, payload);

    case 'USER_DELETED':
      return applyUserDeleted(state, payload);

    case 'LAB_COMPLETED':
      return applyLabCompleted(state, payload, event);

    case 'LAB_PROGRESS_UPDATED':
      return applyLabProgressUpdated(state, payload, event);

    case 'XP_EARNED':
      return applyXpEarned(state, payload);

    case 'BADGE_UNLOCKED':
      return applyBadgeUnlocked(state, payload);

    case 'SKILL_UPDATED':
      return applySkillUpdated(state, payload, event);

    case 'PAYMENT_DONE':
      return applyPaymentDone(state, payload, event);

    case 'SUBSCRIPTION_ACTIVATED':
      return applySubscriptionActivated(state, payload, event);

    case 'SUBSCRIPTION_CANCELED':
      return applySubscriptionCanceled(state, payload, event);

    case 'SUBSCRIPTION_UPDATED':
      return applySubscriptionUpdated(state, payload, event);

    case 'EARLY_ACCESS_SIGNUP':
      return applyEarlyAccessSignup(state, payload, event);

    case 'EARLY_ACCESS_ACTIVATED':
      return applyEarlyAccessActivated(state, payload, event);

    default:
      // Unknown event types are silently ignored — forward compatible
      return state;
  }
}

// ──── Core Rebuild ────
/**
 * Rebuild full state from an ordered event array.
 * Events must be sorted by (device_id ASC, sequence ASC) or (createdAt ASC).
 *
 * @param {object[]} events     - Ordered event log
 * @param {object}   [snapshot] - Optional starting snapshot (performance only, not truth)
 * @returns {{ state: object, eventsApplied: number, lastEventId: string|null }}
 */
export function rebuildState(events, snapshot = null) {
  let state = snapshot ? deepClone(snapshot.state) : deepClone(INITIAL_STATE);
  let eventsApplied = 0;
  let lastEventId   = null;

  for (const event of events) {
    state = reducer(state, event);
    eventsApplied++;
    lastEventId = event.id;
  }

  return { state, eventsApplied, lastEventId };
}

/**
 * Rebuild state for a single user — cheaper than full rebuild.
 *
 * @param {object[]} events - All events for this userId
 * @param {string}   userId
 * @returns {object} Partial state slice for this user
 */
export function rebuildUserState(events, userId) {
  const userEvents = events.filter(e => {
    const p = parsePayload(e.payload);
    return p.userId === userId || p.email === userId;
  });

  const { state } = rebuildState(userEvents);

  return {
    user:         state.users[userId]         ?? null,
    labProgress:  state.labProgress[userId]   ?? {},
    subscription: state.subscriptions[userId] ?? null,
    skills:       state.skills[userId]        ?? {},
    badges:       state.badges[userId]        ?? [],
    payments:     state.payments[userId]      ?? [],
  };
}

// ──── Snapshot ────
/**
 * Produce a performance snapshot from current state.
 * Snapshots are NEVER the source of truth — they are caches.
 *
 * @param {object} state        - Rebuilt state
 * @param {string} lastEventId  - Last event applied
 * @returns {object} Snapshot with metadata
 */
export function createSnapshot(state, lastEventId) {
  return {
    state:        deepClone(state),
    lastEventId,
    createdAt:    Date.now(),
    snapshotVersion: 1,
  };
}

// ──── Event Handlers (pure, no side effects) ────

function applyUserRegistered(state, payload, event) {
  const { userId, email, name, plan } = payload;
  if (!userId) return state;
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: {
        userId,
        email:        email ?? '',
        name:         name  ?? '',
        plan:         plan  ?? 'none',
        accountStatus:'active',
        createdAt:    event.createdAt ?? new Date().toISOString(),
      },
    },
    labProgress:   { ...state.labProgress,   [userId]: state.labProgress[userId]   ?? {} },
    subscriptions: { ...state.subscriptions, [userId]: state.subscriptions[userId] ?? null },
    skills:        { ...state.skills,        [userId]: state.skills[userId]        ?? {} },
    badges:        { ...state.badges,        [userId]: state.badges[userId]        ?? [] },
    payments:      { ...state.payments,      [userId]: state.payments[userId]      ?? [] },
  };
}

function applyUserUpdated(state, payload) {
  const { userId, ...fields } = payload;
  if (!userId || !state.users[userId]) return state;
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: { ...state.users[userId], ...fields },
    },
  };
}

function applyUserDeleted(state, payload) {
  const { userId } = payload;
  if (!userId) return state;
  return {
    ...state,
    users: { ...state.users, [userId]: { ...(state.users[userId] ?? {}), accountStatus: 'deleted' } },
  };
}

function applyLabCompleted(state, payload, event) {
  const { userId, labId, score = 0 } = payload;
  if (!userId || !labId) return state;
  const userProgress = state.labProgress[userId] ?? {};
  return {
    ...state,
    labProgress: {
      ...state.labProgress,
      [userId]: {
        ...userProgress,
        [labId]: { completed: true, score, updatedAt: event.createdAt ?? new Date().toISOString() },
      },
    },
  };
}

function applyLabProgressUpdated(state, payload, event) {
  const { userId, labId, score = 0, completed = false } = payload;
  if (!userId || !labId) return state;
  const userProgress  = state.labProgress[userId]  ?? {};
  const existing      = userProgress[labId]         ?? {};
  return {
    ...state,
    labProgress: {
      ...state.labProgress,
      [userId]: {
        ...userProgress,
        [labId]: {
          ...existing,
          score:    Math.max(existing.score ?? 0, score),
          completed: existing.completed || completed,
          updatedAt: event.createdAt ?? new Date().toISOString(),
        },
      },
    },
  };
}

function applyXpEarned(state, payload) {
  const { userId, xp = 0 } = payload;
  if (!userId || !state.users[userId]) return state;
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: {
        ...state.users[userId],
        totalXp: (state.users[userId].totalXp ?? 0) + xp,
      },
    },
  };
}

function applyBadgeUnlocked(state, payload) {
  const { userId, badgeId } = payload;
  if (!userId || !badgeId) return state;
  const current = state.badges[userId] ?? [];
  if (current.includes(badgeId)) return state; // idempotent
  return {
    ...state,
    badges: { ...state.badges, [userId]: [...current, badgeId] },
  };
}

function applySkillUpdated(state, payload, event) {
  const { userId, branch, xp = 0, sessionsCompleted = 0, bestScore = 0 } = payload;
  if (!userId || !branch) return state;
  const userSkills = state.skills[userId] ?? {};
  const existing   = userSkills[branch]   ?? { xp: 0, sessionsCompleted: 0, bestScore: 0 };
  return {
    ...state,
    skills: {
      ...state.skills,
      [userId]: {
        ...userSkills,
        [branch]: {
          xp:               existing.xp + xp,
          sessionsCompleted: existing.sessionsCompleted + sessionsCompleted,
          bestScore:        Math.max(existing.bestScore, bestScore),
          updatedAt:        event.createdAt ?? new Date().toISOString(),
        },
      },
    },
  };
}

function applyPaymentDone(state, payload, event) {
  const { userId, amount, currency = 'usd', stripePaymentIntentId } = payload;
  if (!userId) return state;
  const existing = state.payments[userId] ?? [];
  // Idempotent: skip if same payment intent already recorded
  if (stripePaymentIntentId && existing.some(p => p.stripePaymentIntentId === stripePaymentIntentId)) {
    return state;
  }
  return {
    ...state,
    payments: {
      ...state.payments,
      [userId]: [
        ...existing,
        { amount, currency, stripePaymentIntentId, paidAt: event.createdAt ?? new Date().toISOString() },
      ],
    },
  };
}

function applySubscriptionActivated(state, payload, event) {
  const { userId, plan, stripeSubscriptionId, periodEnd } = payload;
  if (!userId) return state;
  return {
    ...state,
    subscriptions: {
      ...state.subscriptions,
      [userId]: { status: 'active', plan, stripeSubscriptionId, periodEnd, activatedAt: event.createdAt ?? new Date().toISOString() },
    },
  };
}

function applySubscriptionCanceled(state, payload, event) {
  const { userId } = payload;
  if (!userId || !state.subscriptions[userId]) return state;
  return {
    ...state,
    subscriptions: {
      ...state.subscriptions,
      [userId]: { ...state.subscriptions[userId], status: 'canceled', canceledAt: event.createdAt ?? new Date().toISOString() },
    },
  };
}

function applySubscriptionUpdated(state, payload, event) {
  const { userId, ...fields } = payload;
  if (!userId || !state.subscriptions[userId]) return state;
  return {
    ...state,
    subscriptions: {
      ...state.subscriptions,
      [userId]: { ...state.subscriptions[userId], ...fields, updatedAt: event.createdAt ?? new Date().toISOString() },
    },
  };
}

function applyEarlyAccessSignup(state, payload, event) {
  const { email, name, referredBy, position } = payload;
  if (!email) return state;
  return {
    ...state,
    earlyAccess: {
      ...state.earlyAccess,
      [email]: { email, name, referredBy, position, activated: false, signedUpAt: event.createdAt ?? new Date().toISOString() },
    },
  };
}

function applyEarlyAccessActivated(state, payload, event) {
  const { email } = payload;
  if (!email || !state.earlyAccess[email]) return state;
  return {
    ...state,
    earlyAccess: {
      ...state.earlyAccess,
      [email]: { ...state.earlyAccess[email], activated: true, activatedAt: event.createdAt ?? new Date().toISOString() },
    },
  };
}

// ──── Helpers ────
function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
