// qaMonitor.js – Runtime error tracking for QA
// Injected into the app to capture JS errors during tests
(function() {
  if (typeof window === 'undefined') return;

  window.__QA_HEALTH__ = {
    errors: 0,
    events: 0,
    lastError: null,
  };

  // Capture unhandled errors
  window.addEventListener('error', function(e) {
    window.__QA_HEALTH__.errors++;
    window.__QA_HEALTH__.lastError = {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    };
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    window.__QA_HEALTH__.errors++;
    window.__QA_HEALTH__.lastError = {
      message: e.reason?.message || String(e.reason),
      type: 'unhandledrejection',
    };
  });

  // Track page events
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    window.__QA_HEALTH__.events++;
    return originalFetch.apply(this, args);
  };

  console.log('[QA] Health monitor active');
})();
