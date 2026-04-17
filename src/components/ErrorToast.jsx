/**
 * Error Toast — User-friendly error notifications
 * Shows contextual errors with retry action
 */

import { useState, useEffect, useCallback } from 'react';
import { getUserFriendlyError } from '../utils/edgeCaseHandler.js';

// Global error queue
const _errorQueue = [];
const _listeners = [];

/**
 * Push error to global queue
 */
export function pushError(error, context = '') {
  const friendly = getUserFriendlyError(error, context);
  const entry = {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ...friendly,
    original: error,
    timestamp: Date.now(),
  };

  _errorQueue.push(entry);

  // Keep last 3
  if (_errorQueue.length > 3) _errorQueue.shift();

  // Notify listeners
  for (const fn of _listeners) fn([..._errorQueue]);

  // Auto-dismiss after 8s
  setTimeout(() => {
    const idx = _errorQueue.findIndex(e => e.id === entry.id);
    if (idx !== -1) {
      _errorQueue.splice(idx, 1);
      for (const fn of _listeners) fn([..._errorQueue]);
    }
  }, 8000);
}

/**
 * Subscribe to error queue
 */
export function subscribeErrors(fn) {
  _listeners.push(fn);
  fn([..._errorQueue]);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx !== -1) _listeners.splice(idx, 1);
  };
}

/**
 * Error Toast Component — shows user-friendly errors
 */
export function ErrorToast() {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    return subscribeErrors(setErrors);
  }, []);

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {errors.map(err => (
        <div
          key={err.id}
          className={`p-3 rounded-lg border shadow-lg animate-slide-in ${
            err.action === 'wait'
              ? 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400'
              : err.action === 'manual'
              ? 'bg-blue-600/20 border-blue-600/30 text-blue-400'
              : 'bg-red-600/20 border-red-600/30 text-red-400'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold">{err.title}</div>
              <div className="text-[10px] opacity-80 mt-0.5">{err.message}</div>
            </div>
            <button
              onClick={() => {
                const idx = _errorQueue.findIndex(e => e.id === err.id);
                if (idx !== -1) {
                  _errorQueue.splice(idx, 1);
                  setErrors([..._errorQueue]);
                }
              }}
              className="text-xs opacity-60 hover:opacity-100 ml-2 shrink-0"
            >
              ✕
            </button>
          </div>
          {err.action === 'retry' && (
            <div className="mt-2 text-[10px] underline cursor-pointer opacity-80 hover:opacity-100">
              Tap to retry
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Inline Error — shows error inline within a component
 */
export function InlineError({ error, onRetry, className = '' }) {
  if (!error) return null;

  const friendly = typeof error === 'string'
    ? { title: error, message: '', action: 'retry' }
    : getUserFriendlyError(error.original || error);

  return (
    <div className={`p-3 bg-red-600/10 border border-red-600/20 rounded-lg text-red-400 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium">{friendly.title}</div>
          {friendly.message && (
            <div className="text-[10px] opacity-80 mt-0.5">{friendly.message}</div>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-[10px] bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 px-2 py-1 rounded transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export default { ErrorToast, InlineError, pushError, subscribeErrors };
