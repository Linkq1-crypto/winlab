// CookieBanner.jsx — GDPR cookie consent, geek edition
// Chiede consenso per: cookie tecnici + analytics + AI/ML training

import { useState, useEffect } from "react";

const KEY = "winlab_cookie_consent"; // "all" | "essential" | null

const LINES = [
  "$ sudo apt install privacy-policy",
  "Reading package lists... Done",
  "Building dependency tree... Done",
  "> Found: cookies [essential, analytics, ai-training]",
];

export default function CookieBanner({ onConsent }) {
  const [visible, setVisible]   = useState(false);
  const [typed, setTyped]       = useState(0);   // how many LINES are typed
  const [expanded, setExpanded] = useState(false);
  const [aiCheck, setAiCheck]   = useState(true);
  const [analyticsCheck, setAnalyticsCheck] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (!saved) {
      // small delay so page renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Typewriter effect for the terminal lines
  useEffect(() => {
    if (!visible || typed >= LINES.length) return;
    const t = setTimeout(() => setTyped(n => n + 1), 420);
    return () => clearTimeout(t);
  }, [visible, typed]);

  const accept = (all) => {
    setAccepting(true);
    const consent = { essential: true, analytics: all ? analyticsCheck : false, ai: all ? aiCheck : false };
    localStorage.setItem(KEY, JSON.stringify(consent));
    localStorage.setItem("winlab_ai_consent", String(consent.ai));
    if (consent.ai) {
      fetch("/api/user/ai-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ consent: true }),
      }).catch(() => {});
    }
    onConsent?.(consent);
    setTimeout(() => setVisible(false), 600);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, width: "min(620px, calc(100vw - 32px))",
      background: "#060d12", border: "1px solid #1a2e1a",
      borderRadius: 10, fontFamily: "monospace", fontSize: 12,
      boxShadow: "0 0 40px rgba(74,222,128,.08), 0 8px 32px rgba(0,0,0,.6)",
      overflow: "hidden",
      transition: accepting ? "opacity .5s, transform .5s" : "none",
      opacity: accepting ? 0 : 1,
    }}>
      {/* Terminal title bar */}
      <div style={{ background: "#0d1a12", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1a2e1a" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e05252", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e0c052", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#52e080", display: "inline-block" }} />
        <span style={{ marginLeft: 8, color: "#3a6", fontSize: 10, letterSpacing: 2 }}>winlab@privacy:~$</span>
        <span style={{ marginLeft: "auto", color: "#244", fontSize: 9 }}>GDPR v2.0</span>
      </div>

      {/* Terminal output */}
      <div style={{ padding: "14px 18px 10px", minHeight: 80 }}>
        {LINES.slice(0, typed).map((line, i) => (
          <div key={i} style={{
            color: i === 0 ? "#4ade80" : i === LINES.length - 1 ? "#facc15" : "#3a5a3a",
            marginBottom: 3, fontSize: 11,
          }}>
            {line}{i === typed - 1 && typed < LINES.length && <span style={{ animation: "blink 1s step-end infinite" }}>▌</span>}
          </div>
        ))}

        {typed >= LINES.length && (
          <>
            <div style={{ marginTop: 10, color: "#4ade80", fontSize: 11 }}>
              Questo sito usa cookie. Scegli cosa abilitare:
            </div>

            {/* Checkboxes */}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed", opacity: .5 }}>
                <input type="checkbox" checked disabled style={{ accentColor: "#4ade80" }} />
                <span style={{ color: "#4a7" }}>[essential]</span>
                <span style={{ color: "#556" }}>— sessione, sicurezza, funzionamento base</span>
                <span style={{ marginLeft: "auto", color: "#244", fontSize: 9 }}>obbligatorio</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={analyticsCheck} onChange={e => setAnalyticsCheck(e.target.checked)}
                  style={{ accentColor: "#4ade80", cursor: "pointer" }} />
                <span style={{ color: analyticsCheck ? "#4ade80" : "#3a5a3a" }}>[analytics]</span>
                <span style={{ color: "#556" }}>— pageview, UTM, scroll depth</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={aiCheck} onChange={e => setAiCheck(e.target.checked)}
                  style={{ accentColor: "#a78bfa", cursor: "pointer" }} />
                <span style={{ color: aiCheck ? "#a78bfa" : "#3a3a5a" }}>[ai-training]</span>
                <span style={{ color: "#556" }}>— sessioni lab usate per migliorare il modello AI</span>
              </label>
            </div>

            {/* Expand details */}
            <button onClick={() => setExpanded(e => !e)}
              style={{ background: "none", border: "none", color: "#246", cursor: "pointer", fontSize: 10, marginTop: 8, padding: 0 }}>
              {expanded ? "▲ meno dettagli" : "▼ leggi di più — privacy policy"}
            </button>

            {expanded && (
              <div style={{ marginTop: 8, color: "#3a5a4a", fontSize: 10, lineHeight: 1.7, borderLeft: "2px solid #1a3a1a", paddingLeft: 10 }}>
                <div>• <b>essential</b>: JWT cookie httpOnly (non leggibile da JS), sessione 24h.</div>
                <div>• <b>analytics</b>: dati aggregati anonimi — nessun dato personale venduto.</div>
                <div>• <b>ai-training</b>: i comandi che esegui nei lab (es. <code>ls -la</code>, <code>chmod</code>) vengono usati per addestrare il nostro AI Mentor. Nessun dato personale incluso. Puoi revocare in Impostazioni → AI Privacy.</div>
                <div style={{ marginTop: 6 }}>
                  <a href="/privacy" style={{ color: "#4ade80" }}>Privacy Policy</a>
                  {" · "}
                  <a href="/cookies" style={{ color: "#4ade80" }}>Cookie Policy</a>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => accept(true)}
                style={{ flex: 1, padding: "9px 16px", background: "#0d3a1a", border: "1px solid #4ade80", borderRadius: 6, color: "#4ade80", fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                $ ./accept-all.sh
              </button>
              <button onClick={() => accept(false)}
                style={{ flex: 1, padding: "9px 16px", background: "#0d0d0d", border: "1px solid #2a3a2a", borderRadius: 6, color: "#3a6a4a", fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}>
                $ ./essential-only.sh
              </button>
            </div>
            <div style={{ marginTop: 8, color: "#1e3a2a", fontSize: 9, textAlign: "center" }}>
              Puoi modificare le preferenze in qualsiasi momento da Impostazioni → Privacy
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
    </div>
  );
}

// Helper: check if user has already consented (for analytics gating)
export function hasConsent(type = "analytics") {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return false;
    return JSON.parse(s)[type] === true;
  } catch { return false; }
}
