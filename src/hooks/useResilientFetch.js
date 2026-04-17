/**
 * useResilientFetch Hook — Production-ready fetch with edge case handling
 * Handles: timeouts, retries, network changes, user-friendly errors
 */

import { useState, useCallback, useRef } from 'react';
import {
  fetchWithTimeout,
  getUserFriendlyError,
  trackError,
  trackPerformance,
} from '../utils/edgeCaseHandler.js';
import { getConnectionDetector } from '../utils/connectionDetector.js';

/**
 * @param {object} [opts]
 * @param {number} [opts.timeout] - Request timeout (auto-adapts to connection)
 * @param {number} [opts.retries=2] - Number of retries
 * @param {Function} [opts.onError] - Custom error handler
 * @param {string} [opts.context] - Error context for user-friendly messages
 * @returns {object} { data, loading, error, fetchData }
 */
export function useResilientFetch(opts = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const fetchData = useCallback(async (url, fetchOpts = {}) => {
    const { timeout: customTimeout, retries, onError, context } = optsRef.current;

    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    setLoading(true);
    setError(null);

    const startTime = Date.now();

    // Auto-adapt timeout to connection
    const detector = getConnectionDetector();
    const autoTimeout = detector.getActionTimeout();
    const timeout = customTimeout ?? autoTimeout;

    try {
      const result = await fetchWithTimeout(
        ({ signal }) => fetch(url, { ...fetchOpts, signal }),
        { timeout, retries }
      );

      const duration = Date.now() - startTime;
      trackPerformance({ name: `fetch-${context || url}`, duration });

      const json = await result.json();
      setData(json);
      return json;
    } catch (err) {
      const duration = Date.now() - startTime;

      // Track error
      trackError({
        error: err.message,
        context: context || url,
        severity: err.name === 'AbortError' ? 'low' : 'high',
      });

      // User-friendly error
      const friendlyError = getUserFriendlyError(err, context);
      setError({ ...friendlyError, original: err });

      // Custom error handler
      onError?.(err, friendlyError);

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cleanup on unmount
  const _fetchData = fetchData;
  useCallback(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { data, loading, error, fetchData: _fetchData };
}

/**
 * useOptimisticUpdate — Optimistic UI with server reconciliation
 * @param {object} opts
 * @param {Function} opts.updateFn - Server update function
 * @param {Function} [opts.onSuccess] - Success callback
 * @param {Function} [opts.onRollback] - Rollback callback on failure
 * @returns {object} { value, update, loading, error }
 */
export function useOptimisticUpdate(opts = {}) {
  const [value, setValue] = useState(opts.initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const previousRef = useRef(null);

  const update = useCallback(async (newValue, serverFn) => {
    const previous = value;
    previousRef.current = previous;

    // Apply optimistically
    setValue(newValue);
    setLoading(true);
    setError(null);

    try {
      if (serverFn) {
        await serverFn(newValue);
      }
      opts.onSuccess?.(newValue);
    } catch (err) {
      // Rollback
      setValue(previous);
      setError(getUserFriendlyError(err));
      opts.onRollback?.(previous, err);
    } finally {
      setLoading(false);
    }
  }, [value, opts]);

  return { value, update, loading, error };
}

/**
 * useRetryable — Adds retry UI to any action
 * @param {Function} actionFn
 * @returns {object} { execute, loading, error, canRetry, retry }
 */
export function useRetryable(actionFn, maxRetries = 3) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const fnRef = useRef(actionFn);
  fnRef.current = actionFn;

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fnRef.current(...args);
      setRetryCount(0);
      return result;
    } catch (err) {
      setError(getUserFriendlyError(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setError({ title: 'Max retries reached', message: 'Please try again later.', action: 'wait' });
      return;
    }

    setRetryCount(prev => prev + 1);
    return execute();
  }, [retryCount, maxRetries, execute]);

  return {
    execute,
    loading,
    error,
    canRetry: retryCount < maxRetries,
    retry,
    retryCount,
  };
}

export default { useResilientFetch, useOptimisticUpdate, useRetryable };
