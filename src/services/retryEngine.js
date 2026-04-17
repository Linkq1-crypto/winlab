/**
 * Intelligent Retry Engine — Network-aware adaptive retry
 * Delays adapt to connection speed (2G → longer, 4G → shorter)
 * Exponential backoff with jitter
 */

import { getConnectionDetector } from '../utils/connectionDetector.js';

/**
 * Get adaptive delay based on current connection
 * @returns {number} Delay in ms
 */
function getAdaptiveDelay() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const type = conn?.effectiveType || 'unknown';

  const delays = {
    'slow-2g': 8000,
    '2g': 5000,
    '3g': 2000,
    '4g': 800,
    unknown: 1500,
  };

  return delays[type] || delays.unknown;
}

/**
 * Add jitter to avoid thundering herd
 * @param {number} delay - Base delay
 * @param {number} factor - Jitter factor (0-1)
 * @returns {number} Delay with jitter
 */
function addJitter(delay, factor = 0.3) {
  const jitter = delay * factor * (Math.random() * 2 - 1);
  return Math.max(100, delay + jitter);
}

/**
 * Intelligent retry with adaptive delay + exponential backoff + jitter
 * @param {Function} fn - Async function to retry
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=3] - Maximum retry attempts
 * @param {number} [opts.baseDelay] - Base delay (auto-detected if not set)
 * @param {number} [opts.maxDelay=30000] - Maximum delay cap
 * @param {number} [opts.backoff=2] - Exponential backoff multiplier
 * @param {Function} [opts.onRetry] - Callback on each retry
 * @param {Function} [opts.shouldRetry] - Custom retry decision
 * @returns {Promise<any>}
 */
export async function smartRetry(fn, opts = {}) {
  const {
    maxRetries = 3,
    baseDelay: customBaseDelay,
    maxDelay = 30000,
    backoff = 2,
    onRetry,
    shouldRetry,
  } = opts;

  let lastError;
  let baseDelay = customBaseDelay ?? getAdaptiveDelay();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Custom retry decision
      if (shouldRetry && !shouldRetry(err, attempt)) {
        throw err;
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          maxDelay,
          addJitter(baseDelay * Math.pow(backoff, attempt))
        );

        onRetry?.({
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: err.message,
        });

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Stale-while-revalidate fetch
 * Returns cached data immediately, updates from network in background
 * @param {string} url
 * @param {Map} cache - Cache store
 * @param {number} [maxAge=60000] - Max cache age in ms
 * @returns {Promise<any>}
 */
export async function staleWhileRevalidate(url, cache, maxAge = 60000) {
  const cached = cache.get(url);

  // Return stale if fresh enough
  if (cached && Date.now() - cached.fetchedAt < maxAge) {
    return cached.data;
  }

  // Fetch in background
  const fetchPromise = fetch(url)
    .then(res => res.json())
    .then(data => {
      cache.set(url, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch(() => cached?.data);

  // Return cached if available, else wait for network
  if (cached) {
    return cached.data;
  }

  return fetchPromise;
}

/**
 * Fetch with circuit breaker
 * Opens circuit after N consecutive failures, prevents hammering
 */
class CircuitBreaker {
  constructor(opts = {}) {
    this.failureThreshold = opts.failureThreshold || 5;
    this.resetTimeout = opts.resetTimeout || 30000;
    this._failures = 0;
    this._state = 'closed'; // closed, open, half-open
    this._lastFailure = 0;
  }

  async execute(fn) {
    if (this._state === 'open') {
      // Check if reset timeout has passed
      if (Date.now() - this._lastFailure > this.resetTimeout) {
        this._state = 'half-open';
      } else {
        throw new Error('Circuit breaker open — service unavailable');
      }
    }

    try {
      const result = await fn();

      // Success — reset if half-open
      if (this._state === 'half-open') {
        this._state = 'closed';
        this._failures = 0;
      }

      return result;
    } catch (err) {
      this._failures++;
      this._lastFailure = Date.now();

      if (this._failures >= this.failureThreshold) {
        this._state = 'open';
      }

      throw err;
    }
  }

  getState() {
    return {
      state: this._state,
      failures: this._failures,
      threshold: this.failureThreshold,
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { CircuitBreaker, getAdaptiveDelay, addJitter, sleep };
export default { smartRetry, staleWhileRevalidate, CircuitBreaker, getAdaptiveDelay, addJitter };
