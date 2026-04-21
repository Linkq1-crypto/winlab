// NewLandingPage.jsx — terminal in cima (A/B), signup +3s dal fix, sezioni sotto
import { useState, useEffect, useRef } from "react";
import { getVariant } from "./ABTestOnboarding";
import CookieBanner from "./CookieBanner";
import { initPosthog } from "./services/posthog";

function track(event, props = {}) {
  try { if (window.posthog) window.posthog.capture(event, props); } catch {}
}

// ── Scenarios for each free lab ───────────────────────────────────────────────
const SCENARIOS = {
  nginx: {
    alert: "nginx is down.\nusers are failing.\n\nyou have access.\n\nfix it.",
    init: [
      "[prod-eu-west-1] — connected", "",
      "$ systemctl status nginx",
      "✖ nginx.service — failed (Result: exit-code)",
      "  Main PID: 1823 (code=exited, status=1/FAILURE)", "",
      "$ curl -I http://localhost",
      "curl: (7) Failed to connect to localhost port 80", "",
    ],
    hint: "try: sudo systemctl restart nginx",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if (["sudo systemctl restart nginx","systemctl restart nginx","sudo service nginx restart","service nginx restart"].includes(c)) return "success";
      if (c.includes("status") && c.includes("nginx")) return { out: ["✖ nginx.service — failed (see journalctl -xe)"] };
      if (c.includes("journalctl") || c.includes("log")) return { out: ["Apr 21 nginx[1823]: bind() to 0.0.0.0:80 failed (98: Address in use)"] };
      return "fail";
    },
    success: ["✔ nginx running (pid: 2847)", "", "$ curl -I http://localhost", "HTTP/1.1 200 OK", "Server: nginx/1.24.0", "", "Service restored."],
  },
  disk: {
    alert: "disk at 100%.\nwrites failing.\n\nyou have access.\n\nclear space.",
    init: [
      "[prod-eu-west-1] — connected", "",
      "$ df -h /",
      "Filesystem  Size  Used Avail Use% Mounted",
      "/dev/sda1    20G   20G     0 100% /", "",
      "$ tail /var/log/nginx/access.log",
      "tail: cannot open: No space left on device", "",
    ],
    hint: "try: truncate -s 0 /var/log/nginx/access.log",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if (c.includes("truncate") || c.includes("rm /var/log") || c.includes("find /var/log") || c.includes("> /var/log")) return "success";
      if (c.includes("df")) return { out: ["/dev/sda1    20G   20G     0 100% /"] };
      if (c.includes("du")) return { out: [" 18G\t/var/log/nginx/access.log", "  1G\t/var/log/syslog"] };
      if (c.includes("ls") && c.includes("log")) return { out: ["-rw-r--r-- 1 root root 18G Apr 21 access.log"] };
      return "fail";
    },
    success: ["✔ truncated /var/log/nginx/access.log", "", "$ df -h /", "/dev/sda1  20G  2.1G  18G  11% /", "", "Space restored."],
  },
  ssh: {
    alert: "ssh is refusing connections.\nteam is locked out.\n\nyou have console access.\n\nfix it.",
    init: [
      "[prod-eu-west-1] — console access", "",
      "$ systemctl status ssh",
      "✖ ssh.service — failed",
      "  Process: sshd -D (code=exited, status=255)", "",
      "$ journalctl -u ssh -n 5",
      "Apr 21 sshd[921]: /etc/ssh/sshd_config line 14: Bad configuration option",
      "Apr 21 sshd[921]: bad configuration options; terminating", "",
    ],
    hint: "try: sed -i '14d' /etc/ssh/sshd_config && systemctl restart ssh",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if ((c.includes("sed") || c.includes("vi") || c.includes("nano")) && c.includes("sshd_config") && c.includes("restart")) return "success";
      if (c.includes("systemctl restart ssh") && !c.includes("sshd_config")) return { out: ["Job for ssh.service failed. Check journalctl -xe for details."] };
      if (c.includes("sshd_config")) return { out: ["line 14: PermitRootLogin bad_value  ← syntax error"] };
      return "fail";
    },
    success: ["✔ sshd config fixed", "✔ ssh.service running (pid: 1042)", "", "$ ssh admin@prod-server", "Welcome to Ubuntu 22.04", "", "Access restored."],
  },
};

// ── Generic Terminal (accepts any scenario) ───────────────────────────────────
function Terminal({ variant, scenarioKey = "nginx", onSuccess }) {
  const sc = SCENARIOS[scenarioKey];
  const [lines, setLines]       = useState(sc.init);
  const [input, setInput]       = useState("");
  const [done, setDone]         = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [firstKey, setFirstKey] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { const t = setTimeout(() => setShowHint(true), 2500); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (!firstKey) setLines(l => [...l, "// the system is still down."]); }, 5000);
    return () => clearTimeout(t);
  }, [firstKey]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim() || done) return;
    if (!firstKey) { setFirstKey(true); track("first_keypress", { variant, lab: scenarioKey }); }
    const result = sc.eval(input);
    if (result === "success") {
      setLines(l => [...l, `$ ${input}`, ...sc.success]);
      setDone(true);
      track("command_success", { variant, lab: scenarioKey });
      setTimeout(() => onSuccess?.(), 3000);
    } else if (result === "fail") {
      track("command_fail", { variant, lab: scenarioKey, cmd: input.split(" ")[0] });
      setLines(l => [...l, `$ ${input}`, `bash: ${input.split(" ")[0]}: command not found`]);
    } else {
      setLines(l => [...l, `$ ${input}`, ...result.out]);
    }
    setInput("");
  }

  function lc(l) {
    if (l.startsWith("✖") || l.includes("failed") || l.includes("Failed") || l.includes("error") || l.includes("100%")) return "text-[#EF4444]";
    if (l.startsWith("✔") || l.startsWith("HTTP/1.1 200") || l.endsWith("restored.") || l.includes("11%")) return "text-[#22C55E]";
    if (l.startsWith("$")) return "text-[#E6EDF3]";
    if (l.startsWith("//")) return "text-[#4F8CFF] opacity-60";
    if (l.startsWith("[prod")) return "text-[#4F8CFF] opacity-80";
    return "text-[#9AA4AF]";
  }

  return (
    <div className="bg-black border border-[#1F2933] rounded-xl overflow-hidden font-mono text-sm w-full cursor-text"
      onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1F2933] bg-[#080808]">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[#9AA4AF] text-xs">ubuntu@prod-server — bash</span>
      </div>
      <div className="p-4 space-y-0.5 max-h-80 overflow-y-auto">
        {lines.map((l, i) => <div key={i} className={`leading-5 ${lc(l)}`}>{l || "\u00A0"}</div>)}
        <div ref={bottomRef} />
      </div>
      {!done && (
        <div className="px-4 pb-3 border-t border-[#0d0d0d]">
          <form onSubmit={submit} className="flex items-center gap-2 pt-2">
            <span className="text-[#22C55E]">$</span>
            <input ref={inputRef} autoFocus value={input} onChange={e => setInput(e.target.value)}
              className="bg-transparent outline-none flex-1 text-[#E6EDF3] caret-[#22C55E] placeholder-[#374151]"
              placeholder="type a command…" autoComplete="off" spellCheck={false} />
          </form>
        </div>
      )}
      {showHint && !done && (
        <div className="px-4 pb-3">
          {!hintOpen
            ? <button onClick={() => { setHintOpen(true); track("hint_open", { variant, lab: scenarioKey }); }}
                className="text-[#22C55E] text-xs opacity-50 hover:opacity-100 transition-opacity">hint available →</button>
            : <div className="text-[#22C55E] text-xs opacity-70">{sc.hint}</div>}
        </div>
      )}
    </div>
  );
}

// ── Lab modal (free labs from grid) ──────────────────────────────────────────
function LabModal({ scenarioKey, title, onSuccess, onClose }) {
  const sc = SCENARIOS[scenarioKey];
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-[#9AA4AF] text-sm whitespace-pre-line leading-7">{sc.alert}</div>
          <button onClick={onClose} className="text-[#374151] hover:text-[#9AA4AF] font-mono text-xs ml-6 shrink-0">esc ×</button>
        </div>
        <Terminal variant="lab" scenarioKey={scenarioKey} onSuccess={onSuccess} />
      </div>
    </div>
  );
}

// ── Signup modal ──────────────────────────────────────────────────────────────
async function startCheckout(plan = "early") {
  try {
    const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else window.location.href = "/?pricing=1";
  } catch { window.location.href = "/?pricing=1"; }
}

function SignupModal({ variant, onLogin, onRegister, onSkip }) {
  useEffect(() => { track("signup_open", { variant }); }, []);
  return (
    <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#11151A] border border-[#1F2933] rounded-xl p-8 w-full max-w-sm">
        <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest mb-6">WINLAB — ACCESS CONTROL</div>
        <div className="font-mono text-[#22C55E] text-sm mb-1">You fixed a production issue.</div>
        <div className="text-[#9AA4AF] text-sm mb-6">Most people can't. Save your progress and unlock more.</div>
        <div className="space-y-3">
          <button onClick={() => { track("signup_free_click", { variant }); onRegister(); }}
            className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-3 hover:bg-gray-100 transition-colors">
            Start free — 6 labs
          </button>
          <button onClick={() => { track("checkout_click", { variant }); startCheckout("early"); }}
            className="w-full border border-[#22C55E] text-[#22C55E] font-mono text-xs tracking-widest uppercase py-3 hover:bg-[#22C55E]/10 transition-colors">
            Unlock all 24 labs — $5/mo →
          </button>
          <button onClick={() => { track("signin_click", { variant }); onLogin(); }}
            className="w-full text-[#9AA4AF] font-mono text-xs py-2 hover:text-white transition-colors">
            Already have an account? Sign in
          </button>
        </div>
        <button onClick={() => { track("signup_skip", { variant }); onSkip(); }}
          className="w-full text-[#1F2933] font-mono text-[10px] py-3 mt-1 hover:text-[#374151] transition-colors">
          skip for now
        </button>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "Do I need Linux experience?",        a: "No. The labs start simple and escalate. You learn by doing, not by reading prerequisites." },
  { q: "What do the labs cover?",            a: "Real sysadmin incidents: nginx/Apache down, disk full, Docker crashes, TLS errors, SSH lockouts, and more." },
  { q: "Is this different from a tutorial?", a: "Yes. You get a broken terminal. No step-by-step guide. You fix it — or you don't." },
  { q: "Can I cancel anytime?",              a: "Yes. Cancel in 30 seconds from your account. No calls, no forms." },
  { q: "What's included in free?",           a: "6 labs, no time limit, no credit card required. Start now." },
];
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1F2933]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="text-[#E6EDF3] text-sm font-medium pr-4">{q}</span>
        <span className="text-[#4b5563] font-mono text-xs shrink-0">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="text-[#9AA4AF] text-sm pb-5 leading-relaxed">{a}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NewLandingPage({ onLogin, onRegister }) {
  const [variant]     = useState(() => getVariant());
  const [heroStarted, setHeroStarted] = useState(variant === "B");
  const [showSignup,  setShowSignup]  = useState(false);
  const [mobileMenu,  setMobileMenu]  = useState(false);
  const [activeLab,   setActiveLab]   = useState(null); // { key, title }

  useEffect(() => {
    initPosthog();
    track("view_landing", { variant });
    if (variant === "C") {
      const t = setTimeout(() => setHeroStarted(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function handleSuccess() { setActiveLab(null); setShowSignup(true); }
  function handleSkip()    { setShowSignup(false); }

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#E6EDF3]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 border-b border-[#1F2933] bg-[#0B0D10]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-mono font-black text-sm tracking-widest">WIN<span className="text-[#22C55E]">LAB</span></span>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how"     className="text-[#9AA4AF] text-sm hover:text-white transition-colors">How it works</a>
            <a href="#labs"    className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Labs</a>
            <a href="#pricing" className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Pricing</a>
            <button onClick={onLogin}    className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Sign in</button>
            <button onClick={onRegister} className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-5 py-2 hover:bg-gray-100 transition-colors">Start free</button>
          </div>
          <button onClick={() => setMobileMenu(o => !o)} className="md:hidden text-[#9AA4AF] font-mono text-xs">{mobileMenu ? "close" : "menu"}</button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-[#1F2933] bg-[#0B0D10] px-6 py-4 space-y-3">
            <a href="#how"     onClick={() => setMobileMenu(false)} className="block text-[#9AA4AF] text-sm py-1">How it works</a>
            <a href="#labs"    onClick={() => setMobileMenu(false)} className="block text-[#9AA4AF] text-sm py-1">Labs</a>
            <a href="#pricing" onClick={() => setMobileMenu(false)} className="block text-[#9AA4AF] text-sm py-1">Pricing</a>
            <button onClick={() => { setMobileMenu(false); onLogin?.(); }}    className="block text-[#9AA4AF] text-sm py-1 w-full text-left">Sign in</button>
            <button onClick={() => { setMobileMenu(false); onRegister?.(); }} className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-2.5 mt-2">Start free</button>
          </div>
        )}
      </nav>

      {/* ── HERO: A/B terminal section ── */}
      <section className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center gap-8 px-6 py-12">
        {/* Variant C: show hero text first, then transition to terminal */}
        {variant === "C" && !heroStarted && (
          <div className="text-center animate-fade-in">
            <p className="font-mono text-[10px] text-[#374151] uppercase tracking-widest mb-6">WINLAB</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
              Break real servers.<br />Get hired.
            </h1>
            <p className="text-[#9AA4AF] text-lg max-w-md mx-auto">
              Fix real incidents in a live terminal. No videos. No theory.
            </p>
          </div>
        )}

        {/* Terminal — shown immediately (B) or after 1.5s (C) */}
        {heroStarted && (
          <>
            <div className="font-mono text-[#9AA4AF] text-sm text-center leading-8 whitespace-pre-line">
              {variant === "B"
                ? `Production alert:\n\nnginx is down.\nusers are failing.\n\nyou have access.\n\nfix it.`
                : `nginx is down. fix it.`}
            </div>
            <Terminal variant={variant} scenarioKey="nginx" onSuccess={handleSuccess} />
          </>
        )}

        {/* Scroll indicator */}
        {heroStarted && (
          <a href="#how" className="font-mono text-[#1F2933] text-[10px] uppercase tracking-widest hover:text-[#374151] transition-colors mt-4">
            scroll to learn more ↓
          </a>
        )}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="max-w-6xl mx-auto px-6 md:px-12 py-20 border-t border-[#1F2933]">
        <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-4 text-center">How it works</p>
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">Three steps. No fluff.</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { n: "01", title: "Incident appears",  body: "A real production failure drops in your terminal. nginx down. Disk full. Container crash. No context, no hints." },
            { n: "02", title: "You investigate",   body: "Use real commands to diagnose. Read logs. Check processes. No IDE. No autocomplete. Just bash." },
            { n: "03", title: "You fix it",         body: "Execute the right commands. Service comes back up. Incident closed. You know what you're doing now." },
          ].map(s => (
            <div key={s.n} className="bg-[#11151A] border border-[#1F2933] rounded-xl p-6">
              <div className="font-mono text-[#1F2933] text-4xl font-black mb-4 select-none">{s.n}</div>
              <h3 className="text-[#E6EDF3] font-semibold mb-2">{s.title}</h3>
              <p className="text-[#9AA4AF] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROOF ── */}
      <section className="max-w-6xl mx-auto px-6 md:px-12 py-16 border-t border-[#1F2933]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: "12,000+", l: "incidents solved" },
            { n: "6 min",   l: "avg resolution time" },
            { n: "87%",     l: "complete first lab" },
            { n: "24",      l: "labs available" },
          ].map(m => (
            <div key={m.l}>
              <div className="text-3xl md:text-4xl font-semibold mb-1">{m.n}</div>
              <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LABS ── */}
      <section id="labs" className="max-w-6xl mx-auto px-6 md:px-12 py-20 border-t border-[#1F2933]">
        <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-4 text-center">Incident catalog</p>
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-3">Real problems. Real terminals.</h2>
        <p className="text-[#9AA4AF] text-center mb-12 max-w-lg mx-auto">Every lab is based on an incident that has taken down production systems at real companies.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Nginx down",        tag: "free", key: "nginx", desc: "Service fails on boot. Port conflict. Fix it before users notice." },
            { title: "Disk full",         tag: "free", key: "disk",  desc: "Server hits 100%. Everything stops. Find what's eating space and clear it." },
            { title: "Docker crash",      tag: "pro",  key: null,    desc: "Container exits with code 1. No logs. Trace the failure." },
            { title: "TLS broken",        tag: "pro",  key: null,    desc: "Certificate expired. HTTPS down. Renew and restore in under 10 minutes." },
            { title: "SSH refused",       tag: "free", key: "ssh",   desc: "Locked out of your own server. Get back in without a reboot." },
            { title: "Apache 502",        tag: "pro",  key: null,    desc: "Reverse proxy fails. Upstream unreachable. Find and fix the chain." },
            { title: "RAID degraded",     tag: "pro",  key: null,    desc: "One disk is dead. Array is running degraded. Replace and rebuild." },
            { title: "LDAP auth failure", tag: "pro",  key: null,    desc: "Users can't login. SSSD is broken. Fix the identity pipeline." },
          ].map(lab => (
            <button
              key={lab.title}
              onClick={() => {
                if (lab.tag === "free" && lab.key) {
                  track("lab_open", { lab: lab.key });
                  setActiveLab({ key: lab.key, title: lab.title });
                } else {
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="bg-[#11151A] border border-[#1F2933] rounded-xl p-5 text-left hover:border-[#374151] transition-colors group w-full"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded inline-block ${
                  lab.tag === "free"
                    ? "text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20"
                    : "text-[#4F8CFF] bg-[#4F8CFF]/10 border border-[#4F8CFF]/20"
                }`}>{lab.tag}</span>
                <span className="font-mono text-[9px] text-[#1F2933] group-hover:text-[#374151] transition-colors">
                  {lab.tag === "free" ? "start →" : "unlock →"}
                </span>
              </div>
              <h3 className="text-[#E6EDF3] font-medium text-sm mb-1.5">{lab.title}</h3>
              <p className="text-[#4b5563] text-xs leading-relaxed">{lab.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 md:px-12 py-20 border-t border-[#1F2933]">
        <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-4 text-center">Pricing</p>
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">Simple. No tricks.</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="bg-[#11151A] border border-[#1F2933] rounded-xl p-8">
            <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest mb-2">Free</div>
            <div className="text-4xl font-semibold mb-1">$0</div>
            <div className="text-[#9AA4AF] text-sm mb-6">No credit card. No expiry.</div>
            <ul className="space-y-2.5 mb-8">
              {["6 free labs", "Real terminal environment", "Incident history", "Community access"].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#9AA4AF]">
                  <span className="text-[#22C55E] font-mono">✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={onRegister} className="w-full border border-[#1F2933] text-[#E6EDF3] font-mono text-xs tracking-widest uppercase py-3 hover:border-[#374151] transition-colors">
              Start free
            </button>
          </div>
          <div className="bg-[#11151A] border border-[#22C55E]/30 rounded-xl p-8 relative">
            <div className="absolute top-4 right-4 font-mono text-[9px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2 py-0.5 rounded uppercase tracking-widest">early price</div>
            <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest mb-2">Pro</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-semibold">$5</span>
              <span className="text-[#9AA4AF] text-sm">/mo</span>
            </div>
            <div className="text-[#9AA4AF] text-sm mb-6">Locked forever at this price.</div>
            <ul className="space-y-2.5 mb-8">
              {["All 24 labs", "AI Mentor — debug with AI", "Certificates + proof of skill", "New incidents every month", "Everything in free"].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#9AA4AF]">
                  <span className="text-[#22C55E] font-mono">✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => startCheckout("early")} className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-3 hover:bg-gray-100 transition-colors">
              Unlock all 24 labs — $5/mo
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-2xl mx-auto px-6 py-20 border-t border-[#1F2933]">
        <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-4 text-center">FAQ</p>
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-10">Questions</h2>
        {FAQ_ITEMS.map(item => <FAQItem key={item.q} {...item} />)}
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#1F2933] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-mono font-black text-sm tracking-widest">WIN<span className="text-[#22C55E]">LAB</span></span>
          <div className="flex gap-6">
            <button onClick={onLogin} className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Sign in</button>
            <a href="/privacy"        className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Privacy</a>
            <a href="mailto:support@winlab.cloud" className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Support</a>
          </div>
          <span className="font-mono text-[#1F2933] text-[10px]">© 2025 WinLab</span>
        </div>
      </footer>

      {/* ── LAB MODAL (free labs from grid) ── */}
      {activeLab && !showSignup && (
        <LabModal
          scenarioKey={activeLab.key}
          title={activeLab.title}
          onSuccess={handleSuccess}
          onClose={() => setActiveLab(null)}
        />
      )}

      {/* ── SIGNUP MODAL (overlay dopo fix) ── */}
      {showSignup && (
        <SignupModal variant={variant} onLogin={onLogin} onRegister={onRegister} onSkip={handleSkip} />
      )}

      <CookieBanner />
    </div>
  );
}
