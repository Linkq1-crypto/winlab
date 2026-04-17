// AuthPage.jsx – Login / Register with email + password + Microsoft SSO
import { useState, useEffect, useMemo } from "react";
import { useLab } from "./LabContext";

// ─── Password strength evaluator ──────────────────────────────────────────────
function evaluatePassword(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  let label = "Very Weak";
  let color = "bg-red-500";
  if (score >= 5) { label = "Strong"; color = "bg-green-500"; }
  else if (score >= 4) { label = "Good"; color = "bg-blue-500"; }
  else if (score >= 3) { label = "Fair"; color = "bg-yellow-500"; }
  else if (score >= 2) { label = "Weak"; color = "bg-orange-500"; }
  return { score, label, color, checks };
}

// ─── Strength meter bar component ─────────────────────────────────────────────
function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label, color } = evaluatePassword(password);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? color : "bg-slate-700"}`} />
        ))}
      </div>
      <p className={`text-xs ${score >= 4 ? "text-green-400" : score >= 3 ? "text-yellow-400" : "text-red-400"}`}>
        {label}
      </p>
    </div>
  );
}

export default function AuthPage({ onBack, onLoginSuccess, initialMode = "login" }) {
  const { login } = useLab();
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle redirect-back from Microsoft OAuth (?ms_login=ok or ?auth_error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ms_login") === "ok") {
      // JWT cookie already set by server — fetch user profile to update client state
      fetch("/api/user/me", { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.user) {
            login(data.user);
            if (onLoginSuccess) onLoginSuccess(data.user);
          }
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
      const body = mode === "login"
        ? { email, password }
        : { email, name, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      // Cookie is set by the server; just update client state
      login(data.user);
      if (onLoginSuccess) onLoginSuccess(data.user);
    } catch (err) {
      setError("Network error. Is the backend server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/[0.06] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-white text-sm mb-8 transition-colors px-2 py-2 min-h-[44px] -ml-2"
          >
            ← Back
          </button>
        )}

        {/* Card */}
        <div className="bg-[#0d0d0f] border border-slate-800 rounded-2xl p-8">
          {/* Logo */}
          <div className="flex items-center gap-1 mb-6">
            <span className="text-blue-500 font-black text-xl tracking-tight">WIN</span>
            <span className="text-white font-black text-xl tracking-tight">LAB</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-8">
            {["login", "register"].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all capitalize
                  ${mode === m
                    ? "bg-slate-700 text-white"
                    : "text-slate-500 hover:text-slate-300"}`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 rounded-lg border border-red-600/30 bg-red-600/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Microsoft SSO */}
          <a
            href="/api/auth/microsoft"
            className="flex items-center justify-center gap-3 w-full py-3 bg-[#2f2f2f] hover:bg-[#3a3a3a] border border-slate-700 rounded-lg text-sm font-medium text-white transition-colors mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
              <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </a>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={80}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                maxLength={200}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={128}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
              />
              {mode === "register" && <StrengthMeter password={password} />}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Sign In →"
                  : "Create Account →"}
            </button>
          </form>

          {/* Footer text */}
          <p className="text-xs text-slate-600 text-center mt-6">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Register for free
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Trust line */}
        <p className="text-center text-slate-700 text-xs mt-6">
          Free Starter plan · No credit card required · Cancel anytime
        </p>
      </div>
    </div>
  );
}
