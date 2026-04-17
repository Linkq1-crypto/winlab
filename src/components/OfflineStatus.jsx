/**
 * Offline Status Indicator — Shows sync state to user
 * "Saved locally" → "Syncing..." → "All changes saved"
 */

import { useState, useEffect } from 'react';
import { getOfflineStatus, startAutoSync, stopAutoSync } from '../services/offlineEngine.js';

export function OfflineStatusBar() {
  const [status, setStatus] = useState({
    online: navigator.onLine,
    unsyncedCount: 0,
    queuedCount: 0,
    syncing: false,
  });

  // Poll status
  useEffect(() => {
    async function updateStatus() {
      try {
        const s = await getOfflineStatus();
        setStatus(s);
      } catch {}
    }

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    // Listen for online/offline
    const onOnline = () => updateStatus();
    const onOffline = () => updateStatus();

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Auto-start sync when online
  useEffect(() => {
    if (status.online) {
      startAutoSync({ interval: 15000 });
    } else {
      stopAutoSync();
    }

    return () => stopAutoSync();
  }, [status.online]);

  // Determine display state
  let message;
  let bgColor;
  let textColor;

  if (!status.online) {
    message = `📴 Offline — ${status.queuedCount} action(s) queued for sync`;
    bgColor = 'bg-orange-600/20';
    textColor = 'text-orange-400';
  } else if (status.syncing) {
    message = '🔄 Syncing changes...';
    bgColor = 'bg-blue-600/20';
    textColor = 'text-blue-400';
  } else if (status.unsyncedCount > 0) {
    message = `⏳ ${status.unsyncedCount} change(s) pending sync`;
    bgColor = 'bg-yellow-600/20';
    textColor = 'text-yellow-400';
  } else if (status.queuedCount > 0) {
    message = `⏳ ${status.queuedCount} action(s) queued`;
    bgColor = 'bg-yellow-600/20';
    textColor = 'text-yellow-400';
  } else {
    message = '✅ All changes saved';
    bgColor = 'bg-green-600/10';
    textColor = 'text-green-400';
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 ${bgColor} border-t border-current/10 px-3 py-1.5 text-[10px] ${textColor} text-center z-40`}>
      {message}
    </div>
  );
}

/**
 * Save Indicator — Shows when a specific action is saved locally
 */
export function SaveIndicator({ saved, syncing, className = '' }) {
  if (!saved && !syncing) return null;

  if (syncing) {
    return (
      <span className={`text-[10px] text-blue-400 ${className}`}>
        🔄 Syncing...
      </span>
    );
  }

  if (!navigator.onLine) {
    return (
      <span className={`text-[10px] text-orange-400 ${className}`}>
        💾 Saved locally
      </span>
    );
  }

  return (
    <span className={`text-[10px] text-green-400 ${className}`}>
      ✅ Saved
    </span>
  );
}

export default { OfflineStatusBar, SaveIndicator };
