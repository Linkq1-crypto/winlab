import { describe, it, expect, beforeEach } from 'vitest';
import { generateToken, hashToken, verifyToken, generateOtp } from '../src/services/tokenService.js';
import { _test as alertTest, dispatchAlert, bootstrapAlertFlow } from '../src/core/alertDispatcher.js';
import { eventBus } from '../src/core/eventBus.js';
import { SEVERITY, timelineStore } from '../src/core/timelineStore.js';

describe('tokenService', () => {
  it('generates a 64-char hex token (32 bytes)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates different tokens each time', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
  });

  it('hashes a token to SHA-256 (64 hex chars)', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies a token against its hash', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken(token, hash)).toBe(true);
  });

  it('rejects wrong token', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(verifyToken('wrong_token', hash)).toBe(false);
  });

  it('generates 6-digit OTP', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(otp)).toBeLessThanOrEqual(999999);
  });

  it('same token always produces same hash', () => {
    const token = 'test-token-abc';
    const h1 = hashToken(token);
    const h2 = hashToken(token);
    expect(h1).toBe(h2);
  });
});

describe('alertDispatcher', () => {
  beforeEach(() => {
    alertTest.dedupWindow.clear();
    alertTest.emailTimestamps.clear();
    timelineStore.clear();
  });

  it('deduplicates same alert within 5 minutes', () => {
    const now = Date.now();
    const key = 'SERVICE_DOWN-DB is DOWN';

    expect(alertTest.isDuplicate(key, now)).toBe(false); // first time
    expect(alertTest.isDuplicate(key, now + 1000)).toBe(true); // within 5min
  });

  it('allows same alert after dedup window expires', () => {
    const key = 'SERVICE_DOWN-DB is DOWN';
    const now = Date.now();

    alertTest.isDuplicate(key, now);
    expect(alertTest.isDuplicate(key, now + 6 * 60 * 1000)).toBe(false); // after 6min
  });

  it('rate limits after 5 emails per hour', () => {
    const userId = 'test-user-1';
    const now = Date.now();

    for (let i = 0; i < 5; i++) {
      expect(alertTest.isRateLimited(userId, now + i)).toBe(false);
    }
    expect(alertTest.isRateLimited(userId, now + 5)).toBe(true);
  });

  it('resets rate limit after window expires', () => {
    const userId = 'test-user-2';
    const now = Date.now();

    // Fill up rate limit
    for (let i = 0; i < 5; i++) {
      alertTest.isRateLimited(userId, now + i);
    }

    // After 1 hour + 1 second, should be allowed again
    expect(alertTest.isRateLimited(userId, now + 60 * 60 * 1000 + 1000)).toBe(false);
  });

  it('logs incident for non-CRITICAL alerts', async () => {
    await dispatchAlert({
      type: 'TEST_WARN',
      message: 'Latency spike detected',
      severity: SEVERITY.WARN,
    });

    const incidents = timelineStore.all();
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0].severity).toBe(SEVERITY.WARN);
  });

  it('logs incident for CRITICAL alerts', async () => {
    await dispatchAlert({
      type: 'TEST_CRITICAL',
      message: 'Service is down',
      severity: SEVERITY.CRITICAL,
    });

    const incidents = timelineStore.all();
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0].severity).toBe(SEVERITY.CRITICAL);
  });

  it('does NOT send email for WARN severity', async () => {
    // Dev mode logs instead of sends — but we verify it's not rate-limited or deduped incorrectly
    const emailKey = 'TEST_WARN-warn@test.com';
    const now = Date.now();

    // Not a real email test (would need mocked sendEmail), but verifies flow
    await dispatchAlert({
      type: 'TEST_WARN',
      message: 'warn@test.com',
      severity: SEVERITY.WARN,
    }, 'warn@test.com');

    // Should not be in email timestamps (only UI logging)
    const count = alertTest.emailTimestamps.get('warn@test.com')?.length || 0;
    expect(count).toBe(0);
  });
});

describe('bootstrapAlertFlow', () => {
  beforeEach(() => {
    alertTest.dedupWindow.clear();
    alertTest.emailTimestamps.clear();
    timelineStore.clear();
    eventBus.clear();
  });

  it('registers event bus handlers without error', () => {
    expect(() => bootstrapAlertFlow()).not.toThrow();
  });

  it('emits timeline entry on SERVICE_DOWN event', async () => {
    bootstrapAlertFlow();

    eventBus.emit('SERVICE_DOWN', { serviceId: 'DB' });

    // Give async handlers time
    await new Promise((resolve) => setTimeout(resolve, 100));

    const incidents = timelineStore.all();
    expect(incidents.some((i) => i.type === 'SERVICE_DOWN')).toBe(true);
  });
});
