/**
 * Connection Speed Detector
 * Detects network quality and adapts UI accordingly
 * Used for progressive enhancement on slow connections
 */

class ConnectionDetector {
  constructor() {
    this._listeners = [];
    this._connection = null;
    this._effectiveType = 'unknown';
    this._downlink = null;
    this._rtt = null;
    this._saveData = false;
    this._isOnline = navigator.onLine;

    this._detect();
    this._listen();
  }

  /**
   * Detect connection info
   */
  _detect() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    this._connection = conn;

    if (conn) {
      this._effectiveType = conn.effectiveType || 'unknown';
      this._downlink = conn.downlink || null;
      this._rtt = conn.rtt || null;
      this._saveData = conn.saveData || false;
    }

    this._isOnline = navigator.onLine;
  }

  /**
   * Listen for connection changes
   */
  _listen() {
    const conn = this._connection;
    if (conn) {
      conn.addEventListener('change', () => {
        this._detect();
        this._notifyListeners();
      });
    }

    window.addEventListener('online', () => {
      this._isOnline = true;
      this._notifyListeners();
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      this._notifyListeners();
    });
  }

  /**
   * Notify all listeners
   */
  _notifyListeners() {
    const state = this.getState();
    for (const fn of this._listeners) {
      try { fn(state); } catch {}
    }
  }

  /**
   * Subscribe to connection changes
   * @param {Function} callback - (state) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this._listeners.push(callback);
    // Immediately call with current state
    callback(this.getState());
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== callback);
    };
  }

  /**
   * Get current connection state
   * @returns {object}
   */
  getState() {
    return {
      online: this._isOnline,
      effectiveType: this._effectiveType,
      downlink: this._downlink,
      rtt: this._rtt,
      saveData: this._saveData,
      isSlow: this.isSlow(),
      isVerySlow: this.isVerySlow(),
      shouldReduceData: this.shouldReduceData(),
      shouldDisableAnimations: this.shouldDisableAnimations(),
      quality: this.getQualityScore(),
    };
  }

  /**
   * Check if connection is slow (2G or slow-3G)
   * @returns {boolean}
   */
  isSlow() {
    return this._effectiveType === 'slow-2g' || this._effectiveType === '2g' || this._effectiveType === '3g';
  }

  /**
   * Check if connection is very slow (2G or slow-2G)
   * @returns {boolean}
   */
  isVerySlow() {
    return this._effectiveType === 'slow-2g' || this._effectiveType === '2g';
  }

  /**
   * Should we reduce data payload?
   * @returns {boolean}
   */
  shouldReduceData() {
    return this.isSlow() || this._saveData;
  }

  /**
   * Should we disable animations?
   * @returns {boolean}
   */
  shouldDisableAnimations() {
    return this.isVerySlow() || this._saveData;
  }

  /**
   * Get quality score (0-100)
   * @returns {number}
   */
  getQualityScore() {
    if (!this._isOnline) return 0;

    // Map effective type to score
    const typeScores = {
      'slow-2g': 10,
      '2g': 25,
      '3g': 50,
      '4g': 80,
      unknown: this._downlink ? (this._downlink > 1 ? 60 : 30) : 50,
    };

    let score = typeScores[this._effectiveType] ?? 50;

    // Adjust by downlink if available
    if (this._downlink != null) {
      const downlinkScore = Math.min(100, Math.round(this._downlink * 10));
      score = Math.round((score + downlinkScore) / 2);
    }

    // Penalty for save data
    if (this._saveData) score = Math.round(score * 0.7);

    // Penalty for high RTT
    if (this._rtt > 500) score = Math.round(score * 0.7);
    else if (this._rtt > 200) score = Math.round(score * 0.85);

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get recommended image quality (0-1)
   * @returns {number}
   */
  getImageQuality() {
    if (this.isVerySlow()) return 0.3;
    if (this.isSlow()) return 0.5;
    return 0.8;
  }

  /**
   * Get recommended lazy load threshold
   * @returns {number} px before viewport to start loading
   */
  getLazyLoadThreshold() {
    if (this.isVerySlow()) return 0;
    if (this.isSlow()) return 200;
    return 500;
  }

  /**
   * Get recommended timeout for user actions
   * @returns {number} ms
   */
  getActionTimeout() {
    if (this.isVerySlow()) return 10000;
    if (this.isSlow()) return 5000;
    return 3000;
  }
}

// Singleton
let _instance;

/**
 * Get connection detector singleton
 * @returns {ConnectionDetector}
 */
export function getConnectionDetector() {
  if (!_instance) {
    _instance = new ConnectionDetector();
  }
  return _instance;
}

/**
 * React hook-style connection state
 * For use in React components
 * @returns {object} Connection state
 */
export function useConnection() {
  const { useState, useEffect, useMemo } = require('react');
  const detector = getConnectionDetector();
  const [state, setState] = useState(detector.getState());

  useEffect(() => {
    return detector.subscribe(setState);
  }, []);

  return useMemo(() => ({
    ...state,
    getImageQuality: () => detector.getImageQuality(),
    getLazyLoadThreshold: () => detector.getLazyLoadThreshold(),
    getActionTimeout: () => detector.getActionTimeout(),
  }), [state]);
}

export default { getConnectionDetector, ConnectionDetector };
