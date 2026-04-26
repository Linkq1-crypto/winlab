import { useState, useEffect, useRef, useCallback } from "react";
import { useFreeLab } from "../hooks/useFreeLab.js";

const CONVERSION_TRIGGER_COMMANDS = 5;

const LINE_COLORS = {
  system:  "text-slate-400",
  input:   "text-blue-300",
  output:  "text-green-300",
  error:   "text-red-400",
};

export default function FreeLabTerminal({ labId = "nginx-port-conflict", onConvert, onSuccess }) {
  const { started, booting, lines, commandCount, addLine, sendCommand, verify } = useFreeLab(labId);

  const [input, setInput]               = useState("");
  const [history, setHistory]           = useState([]);
  const [historyIdx, setHistoryIdx]     = useState(-1);
  const [showModal, setShowModal]       = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const bottomRef                       = useRef(null);
  const inputRef                        = useRef(null);
  const modalShownRef                   = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Show conversion modal at engagement peak, or call onSuccess
  useEffect(() => {
    if (modalShownRef.current) return;
    
    if (verifyResult?.ok && onSuccess) {
      modalShownRef.current = true;
      onSuccess();
      return;
    }

    if (commandCount >= CONVERSION_TRIGGER_COMMANDS || verifyResult?.ok) {
      modalShownRef.current = true;
      setShowModal(true);
    }
  }, [commandCount, verifyResult, onSuccess]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    setInput("");
    setHistory(h => [cmd, ...h].slice(0, 50));
    setHistoryIdx(-1);

    if (cmd === "verify" || cmd.endsWith("verify.sh")) {
      addLine(`$ ${cmd}`, "input");
      const result = await verify();
      setVerifyResult(result);
      const out = result.stdout || (result.ok ? "VERIFY_OK" : "VERIFY_FAIL");
      addLine(out.trimEnd(), result.ok ? "output" : "error");
      return;
    }

    await sendCommand(cmd);
  }, [input, addLine, sendCommand, verify]);

  function handleKeyDown(e) {
    if (e.key === "Enter") { handleSubmit(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? "" : history[next] ?? "");
    }
  }

  return (
    <>
      {/* macOS-style terminal window */}
      <div
        className="w-full max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl shadow-black/60 border border-slate-700 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e1e] border-b border-slate-700">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <span className="ml-3 text-xs text-slate-400 flex-1 text-center">
            {booting ? "Connecting…" : started ? `winlab — nginx-port-conflict` : "Disconnected"}
          </span>
        </div>

        {/* Output */}
        <div className="bg-[#0d0d0f] px-4 py-3 h-80 overflow-y-auto">
          {lines.map((line, i) => (
            <div key={i} className={`leading-6 whitespace-pre-wrap break-all ${LINE_COLORS[line.type] ?? "text-slate-300"}`}>
              {line.text}
            </div>
          ))}

          {booting && (
            <span className="inline-flex gap-1 text-slate-500">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
            </span>
          )}

          {started && (
            <form onSubmit={handleSubmit} className="flex items-center gap-1 mt-1">
              <span className="text-green-400 shrink-0">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                spellCheck={false}
                className="flex-1 bg-transparent text-white outline-none caret-green-400 placeholder-slate-600"
                placeholder="type a command…"
              />
            </form>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Conversion modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-slate-700 rounded-2xl p-8 max-w-md w-[90%] shadow-2xl text-center">
            {verifyResult?.ok ? (
              <>
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-white mb-2">Incident resolved!</h2>
                <p className="text-slate-400 text-sm mb-6">
                  You fixed nginx in a live environment. Create a free account to keep your progress and unlock 30+ more labs.
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🚀</div>
                <h2 className="text-xl font-bold text-white mb-2">Ready to go deeper?</h2>
                <p className="text-slate-400 text-sm mb-6">
                  You're already troubleshooting a real incident. Sign up free to save your work and access the full lab catalog.
                </p>
              </>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl text-sm text-slate-400 hover:text-white border border-slate-700 transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={() => onConvert?.()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Create free account →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
