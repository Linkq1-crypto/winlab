import { registerSW } from 'virtual:pwa-register';

let unregisterUpdateHandler = null;

export function registerWinLabPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) {
    return null;
  }

  if (!unregisterUpdateHandler) {
    unregisterUpdateHandler = registerSW({
      immediate: true,
      onRegisterError(error) {
        console.error('[PWA] service worker registration failed', error);
      },
    });
  }

  return unregisterUpdateHandler;
}
