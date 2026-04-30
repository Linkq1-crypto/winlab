import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { track } from '../analytics';

const DISMISS_KEY = 'winlab_pwa_install_prompt_dismissed';

function getDismissedState() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissedState() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {}
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit = /WebKit/.test(ua);
  const isCriOS = /CriOS/.test(ua);
  const isFxiOS = /FxiOS/.test(ua);
  return isIOS && isWebKit && !isCriOS && !isFxiOS;
}

function getMobilePlatform() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return 'ios-phone';
  if (/iPad/i.test(ua)) return 'ios-tablet';
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'android-phone';
  if (/Android/i.test(ua)) return 'android-tablet';
  if (/Mobile/i.test(ua)) return 'mobile-other';
  return 'desktop';
}

function getManualInstallLabel({ iOS, platform }) {
  if (iOS) return 'Open Safari Share, then tap Add to Home Screen.';
  if (platform === 'android-phone') return 'Open the browser menu, then tap Install app or Add to Home screen.';
  if (platform === 'android-tablet') return 'Use the browser menu to install WinLab on this tablet.';
  return 'Use your browser menu to add WinLab to your device home screen.';
}

export default function PWAInstallPrompt({ hidden = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(getDismissedState);
  const [installed, setInstalled] = useState(isStandaloneMode);
  const [showManualSteps, setShowManualSteps] = useState(false);
  const shownTrackedRef = useRef(false);
  const iOS = useMemo(() => isIosSafari(), []);
  const platform = useMemo(() => getMobilePlatform(), []);
  const isPhone = platform === 'ios-phone' || platform === 'android-phone' || platform === 'mobile-other';
  const manualInstallLabel = useMemo(() => getManualInstallLabel({ iOS, platform }), [iOS, platform]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    const syncInstalledState = () => {
      if (isStandaloneMode()) {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('focus', syncInstalledState);
    window.addEventListener('pageshow', syncInstalledState);
    document.addEventListener('visibilitychange', syncInstalledState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('focus', syncInstalledState);
      window.removeEventListener('pageshow', syncInstalledState);
      document.removeEventListener('visibilitychange', syncInstalledState);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (installed) {
      document.body.setAttribute('data-pwa-installed', 'true');
      return;
    }
    document.body.removeAttribute('data-pwa-installed');
  }, [installed]);

  const showManualFallback = isPhone && !deferredPrompt;
  const visible = !hidden && !dismissed && !installed && (Boolean(deferredPrompt) || showManualFallback);

  useEffect(() => {
    if (!visible || shownTrackedRef.current) return;
    shownTrackedRef.current = true;
    track('pwa_install_prompt_shown');
  }, [visible]);

  function dismissPrompt() {
    setDismissed(true);
    setShowManualSteps(false);
    setDismissedState();
    track('pwa_install_prompt_dismissed');
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);

    if (choice?.outcome === 'accepted') {
      setInstalled(true);
      track('pwa_install_prompt_accepted');
      return;
    }

    dismissPrompt();
  }

  function openManualSteps() {
    setShowManualSteps(true);
    track('pwa_install_prompt_manual_opened');
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 sm:px-6 lg:px-8">
      <div
        className="pointer-events-auto w-full max-w-md rounded-3xl border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(10,18,16,0.96),rgba(5,5,5,0.98))] p-4 shadow-[0_18px_60px_rgba(5,5,5,0.55)] backdrop-blur-xl"
        data-testid="pwa-install-prompt"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            {deferredPrompt ? <Download className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-white">Add WinLab To Your Screen</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-300">
              Open labs in one tap and come back faster on mobile.
            </p>
            {!deferredPrompt ? (
              <p className="mt-2 text-xs text-emerald-200/85">
                {manualInstallLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-full border border-white/10 p-2 text-gray-500 transition-colors hover:text-white"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {deferredPrompt ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleInstall}
              className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-500 sm:w-auto"
            >
              Install Now
            </button>
            <button
              type="button"
              onClick={dismissPrompt}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-gray-300 transition-colors hover:bg-white/5 sm:w-auto"
            >
              Not Now
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={openManualSteps}
              className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-500"
            >
              Add To Screen
            </button>
            {showManualSteps ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-gray-300">
                <div className="font-black uppercase tracking-[0.16em] text-white">
                  {iOS ? 'iPhone steps' : 'Android steps'}
                </div>
                <ol className="mt-3 space-y-2 text-sm text-gray-300">
                  {iOS ? (
                    <>
                      <li>1. Tap the Share button in Safari.</li>
                      <li>2. Scroll down and tap Add to Home Screen.</li>
                      <li>3. Confirm Add to install WinLab.</li>
                    </>
                  ) : (
                    <>
                      <li>1. Open the browser menu.</li>
                      <li>2. Tap Install app or Add to Home screen.</li>
                      <li>3. Confirm Add or Install.</li>
                    </>
                  )}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
