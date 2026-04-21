// AuthPage.jsx — Jobs-Dark redesign · matches LaunchLanding aesthetic
import { useState, useEffect } from "react";
import { useLab } from "./LabContext";
import { t } from "./theme";

function evaluatePassword(pw) {
  const score = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
  const labels = ["", "Very Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-[#FF3B30]", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
  return { score, label: labels[score] || "Very Weak", color: colors[score] || "bg-[#FF3B30]" };
}

function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = evaluatePassword(password);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-px flex-1 transition-colors ${i <= score ? color : "bg-[#222]"}`} />
        ))}
      </div>
      <p className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">{label}</p>
    </div>
  );
}

export default function AuthPage({ onBack, onLoginSuccess, initialMode = "login" }) {
  const { login } = useLab();
  const [mode, setMode]       = useState(initialMode);
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, name, password };
      const res  = await fetch(endpoint, {
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

  async function handleForgot(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/forgot-password", {
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

  const inputClass = t.input;

  // ── Forgot password view ─────────────────────────────────────────────────────
  if (forgotMode) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
            className={`${t.btnGhost} mb-10`}
          >
            ← Back
          </button>

          {/* Terminal header */}
          <div className="bg-[#050505] border border-[#222] p-5 font-mono mb-8">
            <div className="text-[10px] text-gray-700 mb-4 tracking-widest">
              winlab@auth-server:~$
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="text-gray-600">$ </span>
                <span className="text-gray-300">./recovery --protocol=EMAIL_TOKEN</span>
              </div>
              <div className="text-green-500">[ OK ] Secure channel established</div>
              <div className="text-green-500">[ OK ] Token TTL: 15 minutes</div>
              <div className={`transition-colors ${forgotSent ? "text-green-500" : "text-gray-600"}`}>
                {forgotSent
                  ? "[ OK ] Dispatch complete — check your inbox"
                  : "[ .. ] Awaiting target identity..."}
              </div>
              {loading && (
                <div className="text-yellow-500 animate-pulse">
                  [ .. ] Generating token, dispatching link...
                </div>
              )}
            </div>
          </div>

          {forgotSent ? (
            <div className="font-mono space-y-3">
              <p className="text-sm text-gray-300 leading-relaxed">
                Reset link sent to <span className="text-white">{forgotEmail}</span>.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Check your inbox and click the link within 15 minutes.<br />
                The token self-destructs after use.
              </p>
              <button
                onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                className={`${t.btnPrimary} mt-4`}
              >
                [ Back to Login ]
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              {error && <p className={`${t.error} mb-2`}>{error}</p>}

              <div>
                <label className={t.label}>Target Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              <button type="submit" disabled={loading} className={t.btnPrimary}>
                {loading ? "// Dispatching..." : "[ Dispatch Recovery Token ]"}
              </button>

              <p className="font-mono text-[9px] text-gray-700 text-center tracking-widest uppercase">
                Token expires in 15 min · Single use
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main auth view ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {onBack && (
          <button
            onClick={onBack}
            className={`${t.btnGhost} mb-12`}
          >
            ← Back
          </button>
        )}

        <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
          // WINLAB — ACCESS_CONTROL
        </p>

        {/* Mode toggle */}
        <div className="flex font-mono text-xs tracking-widest uppercase mb-10 border-b border-[#1a1a1a]">
          {["login", "register"].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`pb-3 mr-8 transition-colors duration-200 ${
                mode === m ? "text-white border-b border-white -mb-px" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {error && (
          <p className={`${t.error} mb-6`}>{error}</p>
        )}

        {/* Microsoft SSO */}
        <a
          href="/api/auth/microsoft"
          className="flex items-center justify-center gap-3 w-full py-3 border border-[#222] font-mono text-xs tracking-widest uppercase text-gray-400 hover:border-[#444] hover:text-white transition-colors duration-200 mb-6"
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
          <div className="flex-1 h-px bg-[#1a1a1a]" />
          <span className="font-mono text-[9px] text-gray-700 tracking-widest uppercase">or</span>
          <div className="flex-1 h-px bg-[#1a1a1a]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className={t.label}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={t.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[10px] tracking-widest text-gray-600 uppercase">Password</label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); setError(""); }}
                  className="font-mono text-[10px] tracking-widest text-gray-500 hover:text-white uppercase transition-colors"
                >
                  Forgot?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              maxLength={128}
              className={inputClass}
            />
            {mode === "register" && <StrengthMeter password={password} />}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={t.btnPrimary}
            >
              {loading
                ? "// Please wait..."
                : mode === "login"
                  ? "[ Sign In → ]"
                  : "[ Create Account → ]"}
            </button>
          </div>
        </form>

        <p className="font-mono text-[10px] tracking-widest text-gray-700 text-center mt-8 uppercase">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("register"); setError(""); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                Register for free
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="font-mono text-[9px] text-gray-800 text-center mt-4 tracking-widest uppercase">
          Free plan · No credit card · Cancel anytime
        </p>
      </div>
    </div>
  );
}
