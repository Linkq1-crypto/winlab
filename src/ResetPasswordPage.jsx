// ResetPasswordPage.jsx — handles /reset-password?token=xxx
import { useState } from "react";
import { t } from "./theme";

function evaluatePassword(pw) {
  const score = [pw.length >= 8, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
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

export default function ResetPasswordPage({ onDone }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);

  if (!token) {
    return (
      <div className={`${t.page} flex items-center justify-center p-6`}>
        <div className="w-full max-w-sm">
          <p className={`${t.section} mb-8`}>// PASSWORD_RESET</p>
          <p className={`${t.error}`}>Invalid or missing reset token.</p>
          <button onClick={() => onDone?.()} className={`${t.btnGhost} mt-6`}>← Back to login</button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed. The link may have expired."); return; }
      setDone(true);
      setTimeout(() => {
        window.history.replaceState({}, "", "/");
        onDone?.();
      }, 2500);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${t.page} flex items-center justify-center p-6`}>
      <div className="w-full max-w-sm">
        <p className={`${t.section} mb-8`}>// PASSWORD_RESET</p>

        {done ? (
          <div className="font-mono text-sm text-gray-400 leading-relaxed">
            <span className="text-green-500">// OK</span> — Password updated.<br />
            Redirecting to login…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <p className={t.error}>{error}</p>}

            <div>
              <label className={t.label}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={128}
                className={t.input}
              />
              <StrengthMeter password={password} />
            </div>

            <div>
              <label className={t.label}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={128}
                className={t.input}
              />
            </div>

            <button type="submit" disabled={loading} className={t.btnPrimary}>
              {loading ? "// Updating…" : "[ Set New Password ]"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
