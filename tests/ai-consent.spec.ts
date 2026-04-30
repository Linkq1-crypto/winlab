import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readStoredAiConsentPreference,
  saveAiConsentPreference,
  syncStoredAiConsentPreference,
} from '../src/services/aiConsent.js';

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('ai consent persistence', () => {
  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    globalThis.fetch = vi.fn();
  });

  it('stores consent locally and skips backend sync when token is missing', async () => {
    const result = await saveAiConsentPreference({ consent: true });

    expect(readStoredAiConsentPreference()).toBe(true);
    expect(result).toMatchObject({ skipped: true, reason: 'missing-token' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('syncs stored consent with bearer auth after login', async () => {
    globalThis.localStorage.setItem('winlab_ai_consent', 'true');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await syncStoredAiConsentPreference({ token: 'jwt-123' });

    expect(result).toMatchObject({ ok: true, skipped: false, status: 200 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/user/ai-consent',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer jwt-123',
        }),
      })
    );
  });
});
