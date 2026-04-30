import { useEffect, useState } from "react";
import { saveAiConsentPreference } from "./services/aiConsent";

const KEY = "winlab_cookie_consent";

export default function CookieBanner({ onConsent }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiCheck, setAiCheck] = useState(false);
  const [analyticsCheck, setAnalyticsCheck] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (visible) {
      document.body.setAttribute("data-cookie-banner-visible", "true");
      return;
    }
    document.body.removeAttribute("data-cookie-banner-visible");
  }, [visible]);

  const accept = (all) => {
    setAccepting(true);
    const consent = {
      essential: true,
      analytics: all ? analyticsCheck : false,
      ai: all ? aiCheck : false,
    };
    localStorage.setItem(KEY, JSON.stringify(consent));
    void saveAiConsentPreference({ consent: consent.ai });
    onConsent?.(consent);
    setTimeout(() => setVisible(false), 220);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-[95] flex justify-center px-3 pb-[env(safe-area-inset-bottom)]">
      <div className={`pointer-events-auto w-full max-w-xl rounded-[18px] border border-white/10 bg-[#0c0c0d] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.28)] transition-all ${accepting ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Privacy</p>
            <h2 className="text-base font-black text-white">Choose what WinLab can store</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Essential cookies stay on. Analytics and AI training are optional.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/30 px-3 py-3 opacity-70">
            <input type="checkbox" checked disabled className="mt-1 accent-emerald-500" />
            <div>
              <div className="text-sm font-black text-white">Essential</div>
              <div className="text-xs leading-relaxed text-gray-500">Session, security, and core product functionality.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/30 px-3 py-3">
            <input type="checkbox" checked={analyticsCheck} onChange={(event) => setAnalyticsCheck(event.target.checked)} className="mt-1 accent-emerald-500" />
            <div>
              <div className="text-sm font-black text-white">Analytics</div>
              <div className="text-xs leading-relaxed text-gray-500">Anonymous usage signals like pageview and scroll depth.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/30 px-3 py-3">
            <input type="checkbox" checked={aiCheck} onChange={(event) => setAiCheck(event.target.checked)} className="mt-1 accent-violet-400" />
            <div>
              <div className="text-sm font-black text-white">AI training</div>
              <div className="text-xs leading-relaxed text-gray-500">Anonymized lab interactions used to improve AI Mentor quality.</div>
            </div>
          </label>
        </div>

        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 text-xs text-gray-500 transition-colors hover:text-white">
          {expanded ? "Hide details" : "Read more"}
        </button>

        {expanded ? (
          <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-3 text-xs leading-relaxed text-gray-500">
            You can update preferences later from Settings. Read the full <a href="/privacy" className="text-emerald-400">Privacy Policy</a> and <a href="/terms" className="text-emerald-400">Terms</a>.
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => accept(true)} className="min-h-[48px] rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white">
            Accept selected
          </button>
          <button type="button" onClick={() => accept(false)} className="min-h-[48px] rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-gray-300">
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}

export function hasConsent(type = "analytics") {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return false;
    return JSON.parse(stored)[type] === true;
  } catch {
    return false;
  }
}
