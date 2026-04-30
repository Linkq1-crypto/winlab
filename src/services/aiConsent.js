const AI_CONSENT_KEY = 'winlab_ai_consent';
const AUTH_TOKEN_KEY = 'winlab_token';

export function readStoredAiConsentPreference() {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(AI_CONSENT_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function writeStoredAiConsentPreference(consent) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AI_CONSENT_KEY, String(Boolean(consent)));
}

function resolveAuthToken(explicitToken) {
  if (explicitToken) return explicitToken;
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export async function saveAiConsentPreference({ consent, token, timestamp } = {}) {
  const normalizedConsent = Boolean(consent);
  writeStoredAiConsentPreference(normalizedConsent);

  const authToken = resolveAuthToken(token);
  if (!authToken) {
    return { ok: false, skipped: true, reason: 'missing-token' };
  }

  try {
    const response = await fetch('/api/user/ai-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        consent: normalizedConsent,
        timestamp: timestamp || new Date().toISOString(),
      }),
    });

    return {
      ok: response.ok,
      skipped: false,
      status: response.status,
    };
  } catch {
    return { ok: false, skipped: false, reason: 'network-error' };
  }
}

export async function syncStoredAiConsentPreference(options = {}) {
  const consent = readStoredAiConsentPreference();
  if (typeof consent !== 'boolean') {
    return { ok: false, skipped: true, reason: 'missing-local-consent' };
  }

  return saveAiConsentPreference({
    consent,
    ...options,
  });
}
