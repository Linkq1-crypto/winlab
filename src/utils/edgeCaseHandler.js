/**
 * Edge Case Handler — Real-world resilience engine
 * Handles: network changes, request failures, CPU overload, scroll jank
 */

// ──── 1. LIVE NETWORK CHANGE HANDLER ────

/**
 * Watch for network changes and adapt UI in real-time
 * 4G → 2G during use = must downgrade experience immediately
 */
export function watchNetworkChanges(onChange) {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  if (conn) {
    let prevType = conn.effectiveType;

    conn.addEventListener('change', () => {
      const newType = conn.effectiveType;

      // Detect downgrade
      const qualityOrder = ['slow-2g', '2g', '3g', '4g'];
      const prevIdx = qualityOrder.indexOf(prevType);
      const newIdx = qualityOrder.indexOf(newType);

      if (newIdx < prevIdx) {
        console.warn(`📶 Network downgraded: ${prevType} → ${newType}`);
        onChange({ type: 'downgrade', from: prevType, to: newType });
      } else if (newIdx > prevIdx) {
        console.info(`📶 Network upgraded: ${prevType} → ${newType}`);
        onChange({ type: 'upgrade', from: prevType, to: newType });
      }

      prevType = newType;
    });
  }

  // Also watch online/offline
  window.addEventListener('offline', () => onChange({ type: 'offline' }));
  window.addEventListener('online', () => onChange({ type: 'online' }));
}

// ──── 2. PROMISE.RACE TIMEOUT WRAPPER ────

/**
 * Wrap any promise with timeout + retry on failure
 * @param {Function} fn - Function that returns a promise
 * @param {object} [opts]
 * @param {number} [opts.timeout=3000] - Timeout in ms
 * @param {number} [opts.retries=2] - Number of retries
 * @param {number} [opts.retryDelay=1000] - Delay between retries
 * @param {Function} [opts.onRetry] - Callback on retry
 * @returns {Promise<any>}
 */
export async function fetchWithTimeout(fn, opts = {}) {
  const {
    timeout = 3000,
    retries = 2,
    retryDelay = 1000,
    onRetry,
  } = opts;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Promise.race: fetch vs timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const result = await Promise.race([
        fn({ signal: controller.signal }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        ),
      ]);

      clearTimeout(timer);
      return result;
    } catch (err) {
      lastError = err;

      if (attempt < retries) {
        onRetry?.({ attempt: attempt + 1, maxRetries: retries, error: err.message });
        await sleep(retryDelay * (attempt + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ──── 3. REQUEST IDLE CALLBACK (CPU overload protection) ────

/**
 * Run heavy work during idle time — won't block UI
 * @param {Function} fn - Heavy work function
 * @param {number} [timeout=2000] - Max time to wait for idle
 * @returns {Promise<void>}
 */
export function runIdle(fn, timeout = 2000) {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(deadline => {
        fn(deadline);
        resolve();
      }, { timeout });
    } else {
      // Fallback: setTimeout(0)
      setTimeout(() => {
        fn({ timeRemaining: () => 50 });
        resolve();
      }, 100);
    }
  });
}

/**
 * Split heavy array processing into chunks
 * @param {Array} array
 * @param {Function} fn - Process function(item, index)
 * @param {number} [chunkSize=100]
 * @returns {Promise<void>}
 */
export async function processInChunks(array, fn, chunkSize = 100) {
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      fn(chunk[j], i + j);
    }
    // Yield to browser between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// ──── 4. VIRTUAL SCROLL (scroll jank prevention) ────

/**
 * Lightweight virtual scroll — only renders visible items
 * @param {object} props
 * @param {Array} props.items - All items
 * @param {number} props.scrollTop - Current scroll position
 * @param {number} props.viewportHeight - Visible area height
 * @param {number} props.itemHeight - Height of each item in px
 * @param {number} [props.overscan=5] - Extra items to render above/below
 * @returns {object} { visibleItems, offsetTop }
 */
export function useVirtualScroll(items, scrollTop, viewportHeight, itemHeight, overscan = 5) {
  if (!items || items.length === 0) {
    return { visibleItems: [], offsetTop: 0, totalHeight: 0 };
  }

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex).map((item, idx) => ({
    ...item,
    virtualIndex: startIndex + idx,
    style: {
      position: 'absolute',
      top: (startIndex + idx) * itemHeight,
      left: 0,
      right: 0,
      height: itemHeight,
    },
  }));

  return {
    visibleItems,
    offsetTop: startIndex * itemHeight,
    totalHeight,
  };
}

// ──── 5. PRIORITY LOADING ────

const loadingQueue = { critical: [], normal: [], idle: [] };
let processing = false;

/**
 * Add a task to the priority loading queue
 * @param {'critical'|'normal'|'idle'} priority
 * @param {Function} fn - Async loading function
 * @returns {Promise<any>}
 */
export async function queueLoad(priority, fn) {
  return new Promise((resolve, reject) => {
    loadingQueue[priority].push({ fn, resolve, reject });

    if (!processing) {
      processQueue();
    }
  });
}

async function processQueue() {
  processing = true;

  // Process critical first, then normal, then idle
  for (const priority of ['critical', 'normal', 'idle']) {
    const queue = loadingQueue[priority];

    while (queue.length > 0) {
      const task = queue.shift();

      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (err) {
        task.reject(err);
      }

      // Yield between tasks in lower priority queues
      if (priority === 'idle') {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  processing = false;
}

// ──── 6. USER-FRIENDLY ERROR UX ────

const errorMessages = {
  'AbortError': 'Request cancelled',
  'Request timeout': 'Connection slow — retrying...',
  'Failed to fetch': 'Unable to reach server',
  'NetworkError': 'Network connection lost',
  default: 'Something went wrong',
};

/**
 * Get user-friendly error message
 * @param {Error} error
 * @param {string} context - What was happening (e.g. 'loading inbox')
 * @returns {object} { title, message, action }
 */
export function getUserFriendlyError(error, context = '') {
  const name = error?.name || '';
  const message = error?.message || '';

  // Map to user-friendly message
  let title = errorMessages.default;
  let userMessage = '';
  let action = 'retry';

  if (name === 'AbortError') {
    title = 'Request cancelled';
    userMessage = 'The request took too long and was cancelled.';
  } else if (message.includes('timeout')) {
    title = 'Connection slow';
    userMessage = 'Your connection seems slow. Retrying automatically...';
    action = 'wait';
  } else if (message.includes('Failed to fetch')) {
    title = 'Unable to connect';
    userMessage = 'Check your internet connection and try again.';
  } else if (message.includes('Network')) {
    title = 'Network issue';
    userMessage = 'Connection lost. Please check your network.';
  }

  // Context-specific messages
  if (context === 'loading inbox') {
    title = "Can't load inbox";
  } else if (context === 'sending reply') {
    title = "Couldn't send reply";
    userMessage = 'Your message was not sent. Please try again.';
  } else if (context === 'generating AI reply') {
    title = "AI unavailable";
    userMessage = "Can't generate AI response right now. You can write manually.";
    action = 'manual';
  }

  return {
    title,
    message: userMessage || title,
    action, // 'retry', 'wait', 'manual'
    code: name || 'unknown',
  };
}

// ──── 7. OBSERVABILITY (error tracking + performance monitoring) ────

const errorLog = [];
const perfLog = [];

/**
 * Track an error with context
 * @param {object} params
 * @param {string} params.error - Error message
 * @param {string} params.context - Where it happened
 * @param {string} [params.severity] - 'low' | 'medium' | 'high' | 'critical'
 */
export function trackError(params) {
  const entry = {
    timestamp: Date.now(),
    error: params.error,
    context: params.context,
    severity: params.severity || 'medium',
    url: window.location.href,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
  };

  errorLog.unshift(entry);

  // Keep last 100 errors
  if (errorLog.length > 100) errorLog.length = 100;

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${params.severity?.toUpperCase() || 'ERROR'}] ${params.context}:`, params.error);
  }
}

/**
 * Track a performance metric
 * @param {object} params
 * @param {string} params.name - Metric name (e.g. 'load-inbox')
 * @param {number} params.duration - Duration in ms
 * @param {object} [params.metadata] - Additional context
 */
export function trackPerformance(params) {
  const entry = {
    timestamp: Date.now(),
    name: params.name,
    duration: params.duration,
    metadata: params.metadata || {},
  };

  perfLog.unshift(entry);

  // Keep last 200 metrics
  if (perfLog.length > 200) perfLog.length = 200;
}

/**
 * Get error log
 * @param {number} [limit=20]
 * @returns {Array}
 */
export function getErrorLog(limit = 20) {
  return errorLog.slice(0, limit);
}

/**
 * Get performance log
 * @param {string} [name] - Filter by metric name
 * @returns {Array}
 */
export function getPerfLog(name) {
  if (name) return perfLog.filter(e => e.name === name);
  return perfLog;
}

/**
 * Calculate average duration for a metric
 * @param {string} name
 * @returns {number|null}
 */
export function getAvgPerf(name) {
  const entries = perfLog.filter(e => e.name === name);
  if (entries.length === 0) return null;
  return entries.reduce((sum, e) => sum + e.duration, 0) / entries.length;
}

// ──── EXPORTS ────

export default {
  watchNetworkChanges,
  fetchWithTimeout,
  runIdle,
  processInChunks,
  useVirtualScroll,
  queueLoad,
  getUserFriendlyError,
  trackError,
  trackPerformance,
  getErrorLog,
  getPerfLog,
  getAvgPerf,
};
