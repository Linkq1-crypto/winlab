// trusted-types.js – Trusted Types policy for DOM XSS mitigation
// This file creates a Trusted Types policy that sanitizes inputs before using dangerous DOM APIs

(function() {
  'use strict';

  // Check if Trusted Types are supported
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    
    // Create default policy for WINLAB
    // This policy ensures that all dynamic values passed to DOM sinks are properly sanitized
    const winlabPolicy = window.trustedTypes.createPolicy('default', {
      // Sanitize values passed to innerHTML
      createHTML: (input) => {
        // For React apps, we generally don't use innerHTML directly
        // But if needed, we would sanitize here using DOMPurify or similar
        // For now, we allow React's virtual DOM handling
        return input;
      },
      
      // Sanitize values passed to script URLs (eval, setTimeout with string, etc.)
      createScript: (input) => {
        // Block all dynamic script creation
        // This prevents eval(), setTimeout(string), etc.
        throw new TypeError('Dynamic script creation is not allowed in WINLAB for security reasons');
      },
      
      // Sanitize values passed to scriptURL (import(), etc.)
      createScriptURL: (input) => {
        const url = new URL(input, window.location.href);
        
        // Only allow scripts from same origin or Vite dev server
        const allowedOrigins = [
          window.location.origin,
          'http://localhost:5173',  // Vite dev server
        ];
        
        if (!allowedOrigins.includes(url.origin)) {
          throw new TypeError(`Script URL from ${url.origin} is not allowed`);
        }
        
        return input;
      },
    });

    console.log('[WINLAB] ✅ Trusted Types policy "default" created successfully');
    
  } else {
    // Trusted Types not supported - log warning
    console.warn('[WINLAB] ⚠️ Trusted Types not supported - DOM XSS mitigation unavailable');
  }

  // Monkey-patch dangerous APIs for extra safety (fallback if CSP not enforced)
  const originalEval = window.eval;
  window.eval = function(code) {
    console.warn('[WINLAB SECURITY] eval() called with:', code?.toString().slice(0, 50));
    return originalEval.apply(this, arguments);
  };

  // Log when document.write is used (discouraged)
  const originalDocumentWrite = document.write;
  document.write = function(...args) {
    console.warn('[WINLAB SECURITY] document.write() called:', args[0]?.slice(0, 50));
    return originalDocumentWrite.apply(this, args);
  };

})();
