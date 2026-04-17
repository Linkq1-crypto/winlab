/**
 * Service Worker Registration — Registers offline-capable SW
 */

export function registerOfflineSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return null;
  }

  return navigator.serviceWorker.register('/sw-offline.js', {
    scope: '/',
  }).then(registration => {
    console.log('[SW] Offline Service Worker registered');

    // Listen for offline queue messages
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data.type === 'QUEUE_ACTION') {
        console.log('[SW] Action queued:', event.data.action.url);
        // Dispatch to window for offline engine to pick up
        window.dispatchEvent(new CustomEvent('offline-queue', {
          detail: event.data.action,
        }));
      }
    });

    return registration;
  }).catch(err => {
    console.error('[SW] Registration failed:', err);
    return null;
  });
}

/**
 * Check if service worker is active
 * @returns {Promise<boolean>}
 */
export function isSWActive() {
  if (!('serviceWorker' in navigator)) return false;
  return navigator.serviceWorker.ready.then(reg => !!reg.active).catch(() => false);
}

/**
 * Unregister service worker (for development)
 */
export async function unregisterSW() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    await reg.unregister();
  }

  console.log('[SW] All Service Workers unregistered');
}

export default { registerOfflineSW, isSWActive, unregisterSW };
