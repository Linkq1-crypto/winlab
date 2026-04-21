// AuthPage.jsx — Jobs-Dark · leggibile · funzionale
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
  const colors = ["", "bg-[#FF3B30]", "bg-orange-500", "bg-yellow-500", "bg-blue-400", "bg-green-500"];
  return { score, label: labels[score] || "Very Weak", color: colors[score] || "bg-[#FF3B30]" };
}

function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = evaluatePassword(password);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-px flex-1 transition-colors ${i <= score ? color : "bg-[#333]"}`} />
        ))}
      </div>
      <p className="font-mono text-[10px] text-gray-500 tracking-widest uppercase">{label}</p>
    </div>
  );
}

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Shared input + password field ─────────────────────────────────────────────
const field = "w-full bg-[#0a0a0a] border border-[#333] px-4 py-3 font-mono text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors duration-200";

function PasswordField({ value, onChange, placeholder = "••••••••", required = true, minLength = 8 }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={128}
        className={`${field} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors p-1"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────
function Label({ children }) {
  return <label className="font-mono text-[11px] tracking-widest text-gray-400 uppercase block mb-2">{children}</label>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AuthPage({ onBack, onLoginSuccess, initialMode = "login" }) {
  const { login } = useLab();
  const [mode, setMode]         = useState(initialMode);
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body     = mode === "login" ? { email, password } : { email, name, password };
      const res      = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      login(data.user);
      onLoginSuccess?.(data.user);
    } catch {
      setError("Network error. Is the server running?");
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
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password screen ─────────────────────────────────────────────────
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
            className="font-mono text-[11px] tracking-widest text-gray-500 hover:text-white uppercase transition-colors mb-10"
          >
            ← Back
          </button>

          {/* Terminal block */}
          <div className="bg-[#050505] border border-[#2a2a2a] p-5 font-mono mb-8">
            <div className="text-[10px] text-gray-600 mb-4 tracking-widest">winlab@auth-server:~$</div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-gray-600">$ </span>
                <span className="text-gray-200">./recovery --protocol=EMAIL_TOKEN</span>
              </div>
              <div className="text-green-500">[ OK ] Secure channel established</div>
              <div className="text-green-500">[ OK ] Token TTL: 15 minutes · Single use</div>
              <div className={`transition-colors ${forgotSent ? "text-green-500" : loading ? "text-yellow-400 animate-pulse" : "text-gray-500"}`}>
                {forgotSent
                  ? "[ OK ] Dispatch complete — check your inbox"
                  : loading
                    ? "[ .. ] Generating token, dispatching link..."
                    : "[ .. ] Awaiting target identity..."}
              </div>
            </div>
          </div>

          {forgotSent ? (
            <div className="font-mono space-y-4">
              <p className="text-sm text-gray-200 leading-relaxed">
                Reset link sent to <span className="text-white font-semibold">{forgotEmail}</span>.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Check your inbox (and spam). Click the link within 15 minutes —
                the token self-destructs after use.
              </p>
              <button
                onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                className={`${t.btnPrimary} mt-2`}
              >
                [ Back to Login ]
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              {error && <p className={t.error}>{error}</p>}
              <div>
                <Label>Target Email</Label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className={field}
                />
              </div>
              <button type="submit" disabled={loading} className={t.btnPrimary}>
                {loading ? "// Dispatching..." : "[ Dispatch Recovery Token ]"}
              </button>
              <p className="font-mono text-[10px] text-gray-600 text-center tracking-widest uppercase">
                Token expires in 15 min · Single use
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main auth screen ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-[11px] tracking-widest text-gray-500 hover:text-white uppercase transition-colors mb-12"
          >
            ← Back
          </button>
        )}

        <p className="font-mono text-[10px] tracking-[0.4em] text-gray-500 uppercase mb-8">
          // WINLAB — ACCESS_CONTROL
        </p>

        {/* Mode toggle */}
        <div className="flex font-mono text-xs tracking-widest uppercase mb-10 border-b border-[#222]">
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`pb-3 mr-8 transition-colors duration-200 ${
                mode === m
                  ? "text-white border-b-2 border-white -mb-px"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {error && <p className={`${t.error} mb-6`}>{error}</p>}

        {/* Microsoft SSO */}
        <a
          href="/api/auth/microsoft"
          className="flex items-center justify-center gap-3 w-full py-3 border border-[#333] font-mono text-xs tracking-widest uppercase text-gray-400 hover:border-gray-400 hover:text-white transition-colors duration-200 mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 21 21" fill="none">
            <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continue with Microsoft
        </a>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-[#222]" />
          <span className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">or</span>
          <div className="flex-1 h-px bg-[#222]" />
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
                placeholder="Your name"
                required
                maxLength={80}
                className={field}
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
              className={field}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] tracking-widest text-gray-400 uppercase">Password</span>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); setError(""); }}
                  className="font-mono text-[11px] tracking-widest text-gray-400 hover:text-white uppercase transition-colors underline underline-offset-2"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordField
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {mode === "register" && <StrengthMeter password={password} />}
          </div>

          <div className="pt-2">
            <button type="submit" disabled={loading} className={t.btnPrimary}>
              {loading
                ? "// Please wait..."
                : mode === "login"
                  ? "[ Sign In → ]"
                  : "[ Create Account → ]"}
            </button>
          </div>
        </form>

        {/* Toggle mode */}
        <p className="font-mono text-[11px] tracking-widest text-gray-500 text-center mt-8 uppercase">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("register"); setError(""); }}
                className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors"
              >
                Register free
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="font-mono text-[10px] text-gray-600 text-center mt-3 tracking-widest uppercase">
          Free plan · No credit card · Cancel anytime
        </p>

      </div>
    </div>
  );
}
