const STORAGE_KEY = 'winlab_session_id';

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getStoredBrowserSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getOrCreateBrowserSessionId() {
  const stored = getStoredBrowserSessionId();
  if (stored) return stored;

  const sessionId = createSessionId();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, sessionId);
    } catch {
      // Best effort only; still return the generated ID for this session.
    }
  }
  return sessionId;
}

export { STORAGE_KEY as WINLAB_SESSION_ID_STORAGE_KEY };
