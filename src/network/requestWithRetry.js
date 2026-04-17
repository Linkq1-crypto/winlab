// src/network/requestWithRetry.js
// Retry with exponential backoff + jitter for poor networks

export async function requestWithRetry(input, init = {}, options = {}) {
  const {
    retries = 2,
    timeoutMs = 6_000,
    baseDelayMs = 450,
    maxDelayMs = 4_000,
    shouldRetry = defaultShouldRetry,
    onAttempt,
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    const attemptStartedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      if (!shouldRetry(response, null, attempt)) {
        onAttempt?.({ ok: response.ok, durationMs: performance.now() - attemptStartedAt, attempt });
        return response;
      }

      const retryableError = new Error(`Retryable HTTP status: ${response.status}`);
      retryableError.response = response;
      throw retryableError;
    } catch (error) {
      lastError = error;
      onAttempt?.({ ok: false, durationMs: performance.now() - attemptStartedAt, attempt, error });

      if (attempt >= retries) {
        throw error;
      }

      const delayMs = Math.min(maxDelayMs, jitter(baseDelayMs * 2 ** attempt));
      await sleep(delayMs);
      attempt += 1;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('requestWithRetry: unknown failure');
}

function defaultShouldRetry(response, error, attempt) {
  if (error) return true;
  if (!response) return true;
  if (response.status === 408 || response.status === 429) return true;
  return response.status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms) {
  const spread = Math.max(25, ms * 0.2);
  return ms - spread + Math.random() * spread * 2;
}
