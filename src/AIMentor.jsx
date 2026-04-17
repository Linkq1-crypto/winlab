// AIMentor.jsx – Floating AI Mentor that reads live lab state
// Appears after 20s inactivity. Reads activeLabState from LabContext.
// Cost: ~$0 for repeated questions (DB cache), ~$0.0003 on cache miss.
import { useState, useEffect, useRef, useCallback } from "react";
import { useLab } from "./LabContext";

const INACTIVITY_MS = 20_000; // show after 20s of no user input

export default function AIMentor({ labId, labState = {} }) {
  const { useHint, hintCount, maxHints, plan } = useLab();

  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [nudge, setNudge]             = useState(false);
  // null = not yet fetched, true = consented, false = declined
  const [aiConsent, setAiConsent]     = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);

  const inactivityRef = useRef(null);
  const bottomRef     = useRef(null);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fetch AI Mentor consent status on mount ──────────────────────────────
  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setAiConsent(data.aiMentorConsent === true);
      })
      .catch(() => {});
  }, []);

  async function saveAiConsent(consented) {
    setConsentSaving(true);
    try {
      const res = await fetch("/api/consent/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ aiMentorConsent: consented, timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Failed");
      setAiConsent(consented);
      setShowConsent(false);
      if (consented) setOpen(true);
    } catch {
      // Keep modal open on failure so user can retry
    } finally {
      setConsentSaving(false);
    }
  }

  function openWithConsentCheck() {
    if (aiConsent === true) {
      setOpen(true);
    } else {
      // null (not fetched yet) or false (declined previously) → show modal
      setShowConsent(true);
    }
  }

  // ── Inactivity timer: show nudge after 20s ───────────────────────────────
  const resetTimer = useCallback(() => {
    clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      if (!open) setNudge(true);
    }, INACTIVITY_MS);
  }, [open]);

  useEffect(() => {
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click",   resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click",   resetTimer);
      clearTimeout(inactivityRef.current);
    };
  }, [resetTimer]);

  // ── Send question to backend ─────────────────────────────────────────────
  async function ask(question) {
    if (!question.trim()) return;

    // Check hint quota (starter: 3 max)
    if (!useHint()) return; // triggers paywall if over limit

    setMessages(m => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          labState: {
            labId,
            // Pass key state variables so AI knows context
            // Each simulator exposes relevant state via LabContext.activeLabState
            ...labState,
          }
        })
      });
      const data = await res.json();
      setMessages(m => [
        ...m,
        { role: "ai", text: data.reply, cached: data.cached }
      ]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "What is the first service you would check in this situation?" }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); }
  }

  const hintsLeft = maxHints === Infinity ? "∞" : Math.max(0, maxHints - hintCount);

  // ── Nudge bubble (shown after inactivity) ─────────────────────────────────
  if (!open && nudge) {
    return (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-br-sm px-4 py-3 max-w-[220px] shadow-xl">
          <p className="text-sm text-white font-medium">Need a hint? 🤔</p>
          <p className="text-xs text-slate-400 mt-0.5">I can guide you without giving away the answer.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setNudge(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
          >
            No thanks
          </button>
          <button
            onClick={() => { setNudge(false); openWithConsentCheck(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            Ask mentor
          </button>
        </div>
      </div>
    );
  }

  // ── Collapsed button ──────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={openWithConsentCheck}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-2xl shadow-lg shadow-blue-600/40 flex items-center justify-center transition-transform hover:scale-105"
        title="AI Mentor"
      >
        🤖
        {hintCount > 0 && plan === "starter" && (
          <span className="absolute -top-1 -right-1 text-xs bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
            {hintsLeft}
          </span>
        )}
      </button>
    );
  }

  // ── AI Mentor consent modal ───────────────────────────────────────────────
  if (showConsent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl max-w-[480px] w-[90%] p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl mb-4">🤖</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">AI Mentor uses a third-party service</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            WinLab's AI Mentor is powered by Anthropic's Claude API. Your lab commands and questions are sent to Anthropic's servers for processing.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mb-4 text-sm text-slate-600">
            <div className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs mt-0.5">↑</span>
              <span><strong>What is sent:</strong> your lab commands, questions, and error messages — in the context of the current lab session only</span>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs mt-0.5">✓</span>
              <span><strong>Not used for training:</strong> Anthropic does not use API data to train their models</span>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs mt-0.5">⇄</span>
              <span><strong>Where:</strong> Anthropic is based in the United States. Transfer is covered by Standard Contractual Clauses (SCCs)</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            You can use all labs without the AI Mentor. If you decline, every lab scenario remains fully accessible.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={() => saveAiConsent(false)}
              disabled={consentSaving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              No thanks
            </button>
            <button
              onClick={() => saveAiConsent(true)}
              disabled={consentSaving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {consentSaving ? "Saving…" : "Enable AI Mentor"}
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            You can change this anytime in <a href="/settings" className="text-blue-600 underline">Settings</a>. Read our <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 flex flex-col rounded-2xl border border-slate-700 bg-[#0d0d0f] shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div>
            <p className="text-sm font-semibold text-white">AI Mentor</p>
            <p className="text-xs text-slate-500">
              {hintsLeft === "∞" ? "Unlimited hints" : `${hintsLeft} hint${hintsLeft !== 1 ? "s" : ""} left`}
            </p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-80 min-h-[120px]">
        {messages.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">
            Ask me anything about this lab.<br/>I'll guide you — never spoil the answer.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`
              max-w-[85%] text-sm px-3 py-2 rounded-xl leading-relaxed
              ${m.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-slate-800 text-slate-200 rounded-bl-sm"}
            `}>
              {m.text}
              {m.cached && (
                <span className="block text-xs text-slate-500 mt-1">⚡ instant</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 text-sm px-3 py-2 rounded-xl rounded-bl-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms"   }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="Ask a question…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <button
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
          >
            →
          </button>
        </div>
        {plan === "starter" && hintCount >= 2 && (
          <p className="text-xs text-orange-400 mt-2 text-center">
            {hintsLeft === 0
              ? "Hints exhausted — upgrade for unlimited"
              : `${hintsLeft} hint${hintsLeft !== 1 ? "s" : ""} remaining on free plan`}
          </p>
        )}
      </div>
    </div>
  );
}
