// TrialGate.jsx — Free trial challenge: incident → fix → victory → signup conversion
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { runBashLayer } from "../hooks/bashEngine";

const CHALLENGE = {
  title: "Apache is down",
  subtitle: "Production site returning 502 — users are reporting errors",
  initialLines: [
    { text: "Last login: Mon Apr 20 09:41:02 2026 from 10.0.2.10", dim: true },
    { text: "" },
    { text: "🚨  ALERT  ─  Apache web server is DOWN", error: true },
    { text: "    HTTP 502 · 1,200 users affected · SLA breach in 4 min", error: true },
    { text: "" },
    { text: "root@prod-server:~#", prompt: true },
  ],
  // any of these commands → win
  winPatterns: [
    /systemctl\s+(start|restart)\s+apache2/,
    /service\s+apache2\s+(start|restart)/,
    /apachectl\s+(start|restart)/,
  ],
  winOutput: [
    { text: "" },
    { text: "✅  apache2.service started successfully", ok: true },
    { text: "✅  HTTP 200 OK — site is back online", ok: true },
    { text: "✅  SLA breach avoided — 0 users affected", ok: true },
    { text: "" },
  ],
  hint: "Check the service, then bring it back up.",
};

const TIMER_SECS = 90;

function lineClass(line) {
  if (line.error)  return "text-red-400";
  if (line.ok)     return "text-green-300 font-semibold";
  if (line.prompt) return "text-green-400";
  if (line.cmd)    return "text-white";
  if (line.dim)    return "text-slate-500";
  return "text-green-400";
}

// ── Conversion overlay shown after victory ────────────────────────────────────
function ConversionOverlay({ elapsed, onSignup, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0b]/95 backdrop-blur-sm rounded-2xl"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
        className="max-w-md w-full mx-6 text-center"
      >
        {/* Trophy */}
        <div className="text-6xl mb-4">🏆</div>

        {/* Hook */}
        <h2 className="text-3xl font-black text-white mb-3 leading-tight">
          You just fixed a production incident.
        </h2>
        <p className="text-slate-400 mb-2">
          In <span className="text-green-400 font-bold">{elapsed}s</span> — that's faster than most juniors on day one.
        </p>
        <p className="text-slate-300 font-semibold mb-6">
          That's exactly what companies pay <span className="text-green-400">$80k+</span> for.
        </p>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm text-slate-400">
          <div className="flex -space-x-2">
            {["🧑‍💻","👩‍💻","🧑‍🔧","👨‍💻","🧑‍💻"].map((e, i) => (
              <span key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-base">{e}</span>
            ))}
          </div>
          <span>500+ sysadmins already training</span>
        </div>

        {/* CTA */}
        <button
          onClick={onSignup}
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black text-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-green-600/30 mb-3"
        >
          Save progress & continue training →
        </button>
        <p className="text-xs text-slate-500 mb-4">
          Launch offer: $5 first month · then $19 · cancel anytime
        </p>

        <button onClick={onClose} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
          Maybe later
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Main TrialGate ─────────────────────────────────────────────────────────────
export default function TrialGate({ onSignup, onClose }) {
  const [lines, setLines]     = useState(CHALLENGE.initialLines);
  const [input, setInput]     = useState("");
  const [cwd, setCwd]         = useState("/root");
  const [time, setTime]       = useState(TIMER_SECS);
  const [won, setWon]         = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showConv, setShowConv] = useState(false);
  const [started, setStarted] = useState(false);

  const inputRef  = useRef(null);
  const scrollRef = useRef(null);
  const startedAt = useRef(null);

  // Focus input when opened
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  // Timer
  useEffect(() => {
    if (!started || won) return;
    const id = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [started, won]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const pct        = (time / TIMER_SECS) * 100;
  const isCritical = time < 20;
  const isUrgent   = time < 10;

  const handleKey = (e) => {
    if (e.key !== "Enter") return;
    const cmd = input.trim();
    if (!cmd) return;

    if (!started) { setStarted(true); startedAt.current = Date.now(); }

    const prompt = `root@prod-server:${cwd === "/root" ? "~" : cwd}#`;
    const isWin  = CHALLENGE.winPatterns.some(p => p.test(cmd));

    if (isWin) {
      const secs = Math.round((Date.now() - (startedAt.current || Date.now())) / 1000);
      setElapsed(secs);
      setLines(prev => [
        ...prev.slice(0, -1),
        { text: `${prompt} ${cmd}`, cmd: true },
        ...CHALLENGE.winOutput,
        { text: `root@prod-server:~#`, prompt: true },
      ]);
      setInput("");
      setWon(true);
      setTimeout(() => setShowConv(true), 3500);
      return;
    }

    const { out, newCwd } = runBashLayer(cmd, cwd, "trial", () => {});
    setCwd(newCwd || cwd);
    const newPrompt = `root@prod-server:${(newCwd || cwd) === "/root" ? "~" : newCwd || cwd}#`;
    setLines(prev => [
      ...prev.slice(0, -1),
      { text: `${prompt} ${cmd}`, cmd: true },
      ...out.map(o => ({ text: o.text })),
      { text: newPrompt, prompt: true },
    ]);
    setInput("");
  };

  const timerColor = isUrgent ? "text-red-400" : isCritical ? "text-orange-400" : "text-yellow-400";
  const barColor   = isUrgent ? "bg-red-500"   : isCritical ? "bg-orange-500"   : "bg-yellow-500";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="relative w-full max-w-2xl bg-[#0a0a0b] rounded-2xl border border-green-500/20 shadow-2xl shadow-green-500/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-bold text-white">{CHALLENGE.title}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{CHALLENGE.subtitle}</p>
          </div>

          {/* Timer */}
          <div className={`font-mono font-black text-2xl ${timerColor}`}>
            {formatTime(time)}
          </div>

          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-xl leading-none ml-3">×</button>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-slate-900">
          <motion.div
            className={`h-full ${barColor} transition-colors`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1 }}
          />
        </div>

        {/* Terminal */}
        <div
          ref={scrollRef}
          className="px-5 py-4 font-mono text-sm leading-6 min-h-[260px] max-h-[320px] overflow-y-auto"
        >
          {lines.map((line, i) => (
            <div key={i} className={lineClass(line)}>{line.text}</div>
          ))}
        </div>

        {/* Input */}
        <div className={`px-5 py-3 border-t border-slate-800 flex items-center gap-2 font-mono text-sm ${won ? "opacity-40 pointer-events-none" : ""}`}>
          <span className="text-green-500 shrink-0">#</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={won ? "incident resolved" : "type a command…"}
            className="flex-1 bg-transparent outline-none text-green-300 placeholder-slate-700 caret-green-400"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Hint */}
        {!won && (
          <div className="px-5 py-3 border-t border-slate-800/50 bg-blue-500/5">
            <p className="text-xs text-blue-400">
              🤖 <strong>AI Mentor:</strong> {CHALLENGE.hint}
            </p>
          </div>
        )}

        {/* Conversion overlay */}
        <AnimatePresence>
          {showConv && (
            <ConversionOverlay
              elapsed={elapsed}
              onSignup={onSignup}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
