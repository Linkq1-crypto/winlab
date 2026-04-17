// EarlyAccessSuccess.jsx — Magic login after Stripe early access payment
// Shown at /early-access/success?session_id=cs_xxx
import { useEffect, useState } from "react";

export default function EarlyAccessSuccess({ onDone }) {
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    if (!sessionId) {
      setStatus("error");
      setError("No session ID found. Please contact support.");
      return;
    }

    fetch(`/api/stripe/early-access/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.token && data.user) {
          setStatus("success");
          // Brief pause so user sees success message before redirect
          setTimeout(() => onDone(data.token, data.user), 1800);
        } else {
          setStatus("error");
          setError(data.error || "Verification failed. Please contact support@winlab.cloud");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Network error. Please try again or contact support@winlab.cloud");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-4">
      <div className="mb-10">
        <span className="text-blue-500 font-black text-2xl tracking-tight">WIN</span>
        <span className="text-white font-black text-2xl tracking-tight">LAB</span>
      </div>

      <div className="max-w-md w-full text-center">
        {status === "verifying" && (
          <div>
            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white font-semibold text-lg">Activating your access…</p>
            <p className="text-slate-400 text-sm mt-2">This takes just a second.</p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div className="w-16 h-16 rounded-full bg-green-600/20 border border-green-600/40 flex items-center justify-center text-3xl mx-auto mb-6">
              🎉
            </div>
            <p className="text-white font-bold text-2xl mb-2">You're in!</p>
            <p className="text-slate-400 text-sm">
              Early access activated. Logging you in…
            </p>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-600/40 flex items-center justify-center text-3xl mx-auto mb-6">
              ⚠️
            </div>
            <p className="text-white font-bold text-xl mb-2">Something went wrong</p>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <a
              href="/"
              className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2"
            >
              ← Back to WinLab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
