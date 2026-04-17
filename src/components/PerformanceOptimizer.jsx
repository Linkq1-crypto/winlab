/**
 * Performance Optimizer — Network-aware rendering
 * Wraps app and disables heavy features on slow connections
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { getConnectionDetector } from '../utils/connectionDetector.js';

const PerformanceContext = createContext(null);

/**
 * Performance Provider — detects connection and provides config
 * Wraps your app to enable progressive enhancement
 */
export function PerformanceProvider({ children }) {
  const [perf, setPerf] = useState(() => {
    const detector = getConnectionDetector();
    const state = detector.getState();
    return {
      ...state,
      getImageQuality: () => detector.getImageQuality(),
      getLazyLoadThreshold: () => detector.getLazyLoadThreshold(),
      getActionTimeout: () => detector.getActionTimeout(),
    };
  });

  useEffect(() => {
    const detector = getConnectionDetector();
    return detector.subscribe(state => {
      setPerf({
        ...state,
        getImageQuality: () => detector.getImageQuality(),
        getLazyLoadThreshold: () => detector.getLazyLoadThreshold(),
        getActionTimeout: () => detector.getActionTimeout(),
      });
    });
  }, []);

  return (
    <PerformanceContext.Provider value={perf}>
      {children}
    </PerformanceContext.Provider>
  );
}

/**
 * usePerformance hook — get connection-aware config
 */
export function usePerformance() {
  return useContext(PerformanceContext) || {
    online: true,
    isSlow: false,
    isVerySlow: false,
    shouldReduceData: false,
    shouldDisableAnimations: false,
    quality: 50,
    getImageQuality: () => 0.8,
    getLazyLoadThreshold: () => 500,
    getActionTimeout: () => 3000,
  };
}

/**
 * PerformanceAware component — conditionally renders children based on connection
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.fallback] — Shown on very slow connections
 * @param {string} [props.minQuality] — Minimum quality to render ('low', 'medium', 'high')
 */
export function PerformanceAware({ children, fallback, minQuality }) {
  const perf = usePerformance();

  const qualityThresholds = { low: 10, medium: 40, high: 70 };
  const threshold = qualityThresholds[minQuality] || 0;

  if (perf.quality < threshold && fallback) {
    return fallback;
  }

  return children;
}

/**
 * OptimizedImage — automatically reduces quality on slow connections
 */
export function OptimizedImage({ src, alt, className = '', ...props }) {
  const perf = usePerformance();

  // On very slow connections, skip images entirely
  if (perf.isVerySlow) {
    return (
      <div className={`bg-slate-800 flex items-center justify-center text-[#9ca3af] text-xs ${className}`} role="img" aria-label={alt}>
        🖼️ {alt}
      </div>
    );
  }

  // On slow connections, use lower quality
  const quality = perf.getImageQuality();

  // Append quality parameter if supported (Imgix/Cloudinary style)
  const optimizedSrc = src
    .includes('?') ? `${src}&q=${Math.round(quality * 100)}` : `${src}?q=${Math.round(quality * 100)}`;

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      loading={perf.isSlow ? 'lazy' : 'eager'}
      decoding={perf.isSlow ? 'async' : 'auto'}
      {...props}
    />
  );
}

/**
 * useOptimistic — optimistic UI state management
 * Shows result immediately, reconciles with server later
 * @param {T} initialValue
 * @returns {[T, Function, boolean]} [value, setter, isPending]
 */
export function useOptimistic(initialValue) {
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);

  /**
   * Set optimistic value immediately
   * @param {Promise} serverUpdate - Server update promise
   * @param {any} optimisticValue - Value to show immediately
   */
  function setOptimistic(serverUpdate, optimisticValue) {
    // Apply optimistic value immediately
    setValue(optimisticValue);
    setPending(true);

    // Wait for server
    serverUpdate
      .then(result => {
        setValue(result);
        setPending(false);
      })
      .catch(() => {
        // Revert on error (caller should handle)
        setPending(false);
      });
  }

  return [value, setOptimistic, pending];
}

export default {
  PerformanceProvider,
  usePerformance,
  PerformanceAware,
  OptimizedImage,
  useOptimistic,
};
