// AuthPage.jsx — alto contrasto · Jobs-Dark · funzionale
import { useState, useEffect } from "react";
import { useLab } from "./LabContext";
import { t } from "./theme";

// ── Password strength ──────────────────────────────────────────────────────────
function evaluatePassword(pw) {
  const score = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
  const labels = ["", "Very Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-400", "bg-green-500"];
  return { score, label: labels[score] || "Very Weak", color: colors[score] || "bg-red-500" };
}

function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = evaluatePassword(password);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-sm transition-colors ${i <= score ? color : "bg-[#333]"}`} />
        ))}
      </div>
      <p className="text-[11px] text-gray-400 tracking-wider uppercase">{label}</p>
    </div>
  );
}

// ── Eye toggle ────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Input styles — chiaramente visibili su sfondo nero ────────────────────────
const INPUT = "w-full bg-[#1a1a1a] border border-[#444] rounded px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-300 transition-colors";

function PasswordField({ value, onChange, placeholder = "min 8 caratteri", minLength = 8 }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        minLength={minLength}
        maxLength={128}
        className={`${INPUT} pr-12`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors"
        aria-label={show ? "Nascondi password" : "Mostra password"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-sm text-gray-300 mb-1.5">{children}</label>;
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function AuthPage({ onBack, onLoginSuccess, initialMode = "login" }) {
  const { login } = useLab();
  const [mode, setMode]         = useState(initialMode);
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [success, setSuccess]   = useState("");

  const [forgotMode, setForgotMode]   = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent]   = useState(false);

  // Microsoft SSO callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ms_login") === "ok") {
      fetch("/api/user/me", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) { login(data.user); onLoginSuccess?.(data.user); }
        })
        .catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("auth_error")) {
      setError(`Microsoft login failed: ${params.get("auth_error").replace(/_/g, " ")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [login, onLoginSuccess]);

  // ── Login / Register ───────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDebugInfo("");
    setSuccess("");

    if (mode === "register") {
      const { score } = evaluatePassword(password);
      if (score < 3) { setError("Password troppo debole. Usa maiuscole, numeri e simboli."); return; }
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body     = mode === "login" ? { email, password } : { email, name, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch { setError(`Server error (non-JSON): ${text.slice(0, 120)}`); return; }

      if (!res.ok) {
        setError(data.error || data.detail || `Error ${res.status}`);
        setDebugInfo(JSON.stringify(data));
        return;
      }

      if (!data.user) {
        setError("Server returned success but no user data.");
        setDebugInfo(JSON.stringify(data));
        return;
      }

      if (mode === "register") {
        setSuccess("Account creato! Accesso in corso…");
        await new Promise(r => setTimeout(r, 1000));
      }

      login(data.user, data.token);
      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (res.ok) setForgotSent(true);
      else { const d = await res.json(); setError(d.error || "Failed to send reset email."); }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  // ── Forgot password screen ─────────────────────────────────────────────────
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#111] border border-[#333] rounded-xl p-8">
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
            className="text-sm text-gray-400 hover:text-white transition-colors mb-8"
          >
            ← Back
          </button>

          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 font-mono mb-6">
            <div className="text-[10px] text-gray-600 mb-3">winlab@auth:~$</div>
            <div className="space-y-1 text-xs">
              <div><span className="text-gray-500">$ </span><span className="text-gray-200">./recovery --email-token</span></div>
              <div className="text-green-400">[ OK ] Channel established · TTL: 15min</div>
              <div className={forgotSent ? "text-green-400" : loading ? "text-yellow-400 animate-pulse" : "text-gray-500"}>
                {forgotSent ? "[ OK ] Link dispatched → check inbox" : loading ? "[ .. ] Dispatching..." : "[ .. ] Awaiting email..."}
              </div>
            </div>
          </div>

          {forgotSent ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-200">Link inviato a <span className="text-white font-semibold">{forgotEmail}</span>.</p>
              <p className="text-xs text-gray-500">Controlla inbox (e spam). Link valido 15 minuti, usa singola.</p>
              <button onClick={() => { setForgotMode(false); setForgotSent(false); }} className="w-full bg-white text-black text-sm font-semibold py-2.5 rounded hover:bg-gray-100 transition-colors mt-2">
                Torna al Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              {error && <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm px-3 py-2 rounded">{error}</div>}
              <div>
                <Label>Email</Label>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@company.com" required autoFocus className={INPUT} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-white text-black text-sm font-semibold py-2.5 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors">
                {loading ? "Invio in corso..." : "Invia Link di Reset"}
              </button>
              <p className="text-xs text-gray-600 text-center">Token scade in 15 min · Uso singolo</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main auth screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {onBack && (
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-white transition-colors mb-8 block">
            ← Back
          </button>
        )}

        <p className="text-[11px] tracking-[0.3em] text-gray-500 uppercase mb-6">
          WINLAB — ACCESS CONTROL
        </p>

        {/* Tab switcher */}
        <div className="flex border-b border-[#333] mb-8">
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setDebugInfo(""); }}
              className={`pb-3 mr-8 text-sm font-medium transition-colors ${
                mode === m ? "text-white border-b-2 border-white -mb-px" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Success */}
        {success && (
          <div className="bg-green-900/40 border border-green-600 text-green-300 text-sm px-4 py-3 rounded mb-5">
            {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-300 text-sm px-4 py-3 rounded mb-5">
            {error}
            {debugInfo && <pre className="text-[10px] text-red-400 mt-1 overflow-auto">{debugInfo}</pre>}
          </div>
        )}

        {/* Microsoft SSO */}
        <a
          href="/api/auth/microsoft"
          className="flex items-center justify-center gap-3 w-full py-2.5 border border-[#444] rounded text-sm text-gray-300 hover:border-gray-300 hover:text-white transition-colors mb-5"
        >
          <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
            <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continue with Microsoft
        </a>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#333]" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-[#333]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {mode === "register" && (
            <div>
              <Label>Name</Label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Il tuo nome"
                required
                maxLength={80}
                className={INPUT}
              />
            </div>
          )}

          <div>
            <Label>Email</Label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              maxLength={200}
              autoComplete="email"
              className={INPUT}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-300">Password</span>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); setError(""); }}
                  className="text-sm text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordField value={password} onChange={e => setPassword(e.target.value)} />
            {mode === "register" && <StrengthMeter password={password} />}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black text-sm font-semibold py-3 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors mt-2"
          >
            {loading
              ? "Please wait..."
              : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-sm text-gray-500 text-center mt-6">
          {mode === "login" ? (
            <>No account?{" "}
              <button onClick={() => { setMode("register"); setError(""); }} className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors">
                Register free
              </button>
            </>
          ) : (
            <>Have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors">
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="text-xs text-gray-600 text-center mt-3">
          Free plan · No credit card · Cancel anytime
        </p>

      </div>
    </div>
  );
}
