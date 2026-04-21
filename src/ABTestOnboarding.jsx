// ABTestOnboarding.jsx — B vs C landing page A/B test
// B: Hard Entry (terminal immediato) | C: Hybrid (hero 1.5s → terminal)
import { useState, useEffect, useRef } from "react";

// ── Variant assignment ────────────────────────────────────────────────────────
export function getVariant() {
  if (typeof window === "undefined") return "B";
  const forced = new URLSearchParams(window.location.search).get("v");
  if (forced === "B" || forced === "C") {
    localStorage.setItem("ab_variant", forced);
    return forced;
  }
  const stored = localStorage.getItem("ab_variant");
  if (stored === "B" || stored === "C") return stored;
  const v = Math.random() < 0.5 ? "B" : "C";
  localStorage.setItem("ab_variant", v);
  return v;
}

function track(event, props = {}) {
  try {
    if (window.posthog) window.posthog.capture(event, props);
  } catch {}
}

// ── Terminal engine ───────────────────────────────────────────────────────────
const VALID_CMDS = [
  "sudo systemctl restart nginx",
  "systemctl restart nginx",
  "sudo service nginx restart",
  "service nginx restart",
];

function evalCmd(cmd) {
  const c = cmd.trim().toLowerCase();
  if (VALID_CMDS.includes(c)) return "success";
  if (c.includes("status") && c.includes("nginx")) return "status";
  if (c.includes("journalctl") || c.includes("log")) return "log";
  return "fail";
}

// ── Terminal component ────────────────────────────────────────────────────────
function Terminal({ variant, onSuccess }) {
  const INIT_LINES = [
    "[prod-eu-west-1] — connected",
    "",
    "$ systemctl status nginx",
    "✖ nginx.service — failed (Result: exit-code)",
    "  Main PID: 1823 (code=exited, status=1/FAILURE)",
    "",
    "$ curl -I http://localhost",
    "curl: (7) Failed to connect to localhost port 80",
    "",
  ];

  const [lines, setLines] = useState(INIT_LINES);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [firstKey, setFirstKey] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!firstKey) setLines(l => [...l, "// the system is still down."]);
    }, 5000);
    return () => clearTimeout(t);
  }, [firstKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim() || done) return;
    if (!firstKey) { setFirstKey(true); track("first_keypress", { variant }); }

    const result = evalCmd(input);

    if (result === "success") {
      setLines(l => [...l,
        `$ ${input}`,
        "✔ nginx running (pid: 2847)",
        "",
        "$ curl -I http://localhost",
        "HTTP/1.1 200 OK",
        "Server: nginx/1.24.0",
        "",
        "Service restored.",
      ]);
      setDone(true);
      track("command_success", { variant });
      setTimeout(() => onSuccess?.(), 900);
    } else if (result === "status") {
      setLines(l => [...l, `$ ${input}`, "✖ nginx.service — failed (see journalctl -xe)"]);
    } else if (result === "log") {
      setLines(l => [...l, `$ ${input}`, "Apr 21 nginx[1823]: bind() to 0.0.0.0:80 failed (98: Address in use)"]);
    } else {
      track("command_fail", { variant, cmd: input.split(" ")[0] });
      setLines(l => [...l, `$ ${input}`, `bash: ${input.split(" ")[0]}: command not found`]);
    }
    setInput("");
  }

  function lineColor(l) {
    if (l.startsWith("✖") || l.includes("failed") || l.includes("Failed")) return "text-[#EF4444]";
    if (l.startsWith("✔") || l.startsWith("HTTP/1.1 200") || l === "Service restored.") return "text-[#22C55E]";
    if (l.startsWith("$")) return "text-[#E6EDF3]";
    if (l.startsWith("//")) return "text-[#4F8CFF] opacity-60";
    if (l.startsWith("[prod")) return "text-[#4F8CFF] opacity-80";
    return "text-[#9AA4AF]";
  }

  return (
    <div
      className="bg-black border border-[#1F2933] rounded-xl overflow-hidden font-mono text-sm w-full max-w-2xl cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1F2933] bg-[#080808]">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[#9AA4AF] text-xs">ubuntu@prod-server — bash</span>
      </div>

      <div className="p-4 space-y-0.5 max-h-72 overflow-y-auto">
        {lines.map((l, i) => (
          <div key={i} className={`leading-5 ${lineColor(l)}`}>{l || "\u00A0"}</div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!done && (
        <div className="px-4 pb-3 border-t border-[#0d0d0d]">
          <form onSubmit={submit} className="flex items-center gap-2 pt-2">
            <span className="text-[#22C55E]">$</span>
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              className="bg-transparent outline-none flex-1 text-[#E6EDF3] caret-[#22C55E] placeholder-[#374151]"
              placeholder="type a command…"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      )}

      {showHint && !done && (
        <div className="px-4 pb-3">
          {!hintOpen
            ? <button onClick={() => { setHintOpen(true); track("hint_open", { variant }); }} className="text-[#22C55E] text-xs opacity-50 hover:opacity-100 transition-opacity">hint available →</button>
            : <div className="text-[#22C55E] text-xs opacity-70">try: sudo systemctl restart nginx</div>
          }
        </div>
      )}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ variant, onContinue }) {
  useEffect(() => { track("success_screen", { variant }); }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center animate-fade-in">
      <div className="font-mono">
        <div className="text-[#22C55E] text-lg mb-1">You fixed a production issue.</div>
        <div className="text-[#9AA4AF] text-sm">Most people can't.</div>
      </div>
      <button
        onClick={onContinue}
        className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-10 py-3 hover:bg-gray-100 transition-colors"
      >
        Continue training →
      </button>
      <div className="text-[#374151] text-xs font-mono">
        Next: Docker container crash · Disk full · TLS broken
      </div>
    </div>
  );
}

// ── Signup modal ──────────────────────────────────────────────────────────────
async function startCheckout(plan = "early") {
  try {
    const r = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  } catch { window.location.href = "/?pricing=1"; }
}

function SignupModal({ variant, onLogin, onRegister, onSkip }) {
  useEffect(() => { track("signup_open", { variant }); }, []);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#11151A] border border-[#1F2933] rounded-xl p-8 w-full max-w-sm">
        <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest mb-6">
          WINLAB — ACCESS CONTROL
        </div>

        <h2 className="text-[#E6EDF3] text-xl font-semibold mb-1">Save your progress.</h2>
        <p className="text-[#9AA4AF] text-sm mb-7">Unlock more incidents. Track your skill level.</p>

        <div className="space-y-3">
          <button
            onClick={() => { track("signup_free_click", { variant }); onRegister(); }}
            className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-3 hover:bg-gray-100 transition-colors"
          >
            Start free — 6 labs
          </button>

          <button
            onClick={() => { track("checkout_click", { variant }); startCheckout("early"); }}
            className="w-full border border-[#22C55E] text-[#22C55E] font-mono text-xs tracking-widest uppercase py-3 hover:bg-[#22C55E]/10 transition-colors"
          >
            Unlock all 24 labs — $5/mo →
          </button>

          <button
            onClick={() => { track("signin_click", { variant }); onLogin(); }}
            className="w-full text-[#9AA4AF] font-mono text-xs py-2 hover:text-white transition-colors"
          >
            Already have an account? Sign in
          </button>
        </div>

        <button
          onClick={() => { track("signup_skip", { variant }); onSkip(); }}
          className="w-full text-[#1F2933] font-mono text-[10px] py-3 mt-1 hover:text-[#374151] transition-colors"
        >
          skip for now
        </button>
      </div>
    </div>
  );
}

// ── Variant B: Hard Entry ─────────────────────────────────────────────────────
function VariantB({ onLogin, onRegister }) {
  const [phase, setPhase] = useState("terminal"); // terminal | success | signup

  useEffect(() => { track("view_landing", { variant: "B" }); }, []);

  return (
    <div className="min-h-screen bg-[#0B0D10] flex flex-col items-center justify-center gap-10 p-6">
      {phase === "terminal" && (
        <>
          <div className="font-mono text-[#9AA4AF] text-sm text-center leading-8 whitespace-pre-line">
            {`Production alert:\n\nnginx is down.\nusers are failing.\n\nyou have access.\n\nfix it.`}
          </div>
          <Terminal variant="B" onSuccess={() => setPhase("success")} />
        </>
      )}

      {phase === "success" && (
        <SuccessScreen variant="B" onContinue={() => setPhase("signup")} />
      )}

      {phase === "signup" && (
        <>
          <SuccessScreen variant="B" onContinue={() => {}} />
          <SignupModal variant="B" onLogin={onLogin} onRegister={onRegister} onSkip={onRegister} />
        </>
      )}

      <div className="text-[#1F2933] font-mono text-[10px] tracking-widest">WINLAB</div>
    </div>
  );
}

// ── Variant C: Hybrid ─────────────────────────────────────────────────────────
function VariantC({ onLogin, onRegister }) {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState("terminal");

  useEffect(() => {
    track("view_landing", { variant: "C" });
    const t = setTimeout(() => setStarted(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!started) {
    return (
      <div className="min-h-screen bg-[#0B0D10] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="font-mono text-[10px] text-[#374151] uppercase tracking-widest">WINLAB</div>
        <h1 className="text-[#E6EDF3] text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
          Break real servers.<br />Get hired.
        </h1>
        <p className="text-[#9AA4AF] text-lg max-w-md">
          Fix real incidents in a live terminal. No videos. No theory.
        </p>
        <div className="h-px w-12 bg-[#1F2933]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D10] flex flex-col items-center justify-center gap-10 p-6">
      {phase === "terminal" && (
        <>
          <div className="font-mono text-[#9AA4AF] text-sm text-center leading-7">
            nginx is down. fix it.
          </div>
          <Terminal variant="C" onSuccess={() => setPhase("success")} />
        </>
      )}

      {phase === "success" && (
        <SuccessScreen variant="C" onContinue={() => setPhase("signup")} />
      )}

      {phase === "signup" && (
        <>
          <SuccessScreen variant="C" onContinue={() => {}} />
          <SignupModal variant="C" onLogin={onLogin} onRegister={onRegister} onSkip={onRegister} />
        </>
      )}

      <div className="text-[#1F2933] font-mono text-[10px] tracking-widest">WINLAB</div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ABTestOnboarding({ onLogin, onRegister }) {
  const [variant] = useState(() => getVariant());

  return variant === "B"
    ? <VariantB onLogin={onLogin} onRegister={onRegister} />
    : <VariantC onLogin={onLogin} onRegister={onRegister} />;
}
