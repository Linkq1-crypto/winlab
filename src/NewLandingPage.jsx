// NewLandingPage.jsx — Premium + Hacker landing (spec from leggu.txt)
// Design: #0B0D10 bg · Inter + JetBrains Mono · minimal CTAs · mobile-first
import { useState, useEffect, useRef } from "react";
import { getVariant } from "./ABTestOnboarding";

// ── Static terminal demo (non-interactive, for hero section) ─────────────────
const HERO_LINES = [
  { t: "dim",     s: "[prod-eu-west-1] — connected" },
  { t: "empty",   s: "" },
  { t: "cmd",     s: "$ systemctl status nginx" },
  { t: "error",   s: "✖ nginx.service — failed (exit-code)" },
  { t: "dim",     s: "  Main PID: 1823 (status=1/FAILURE)" },
  { t: "empty",   s: "" },
  { t: "cmd",     s: "$ sudo systemctl restart nginx" },
  { t: "success", s: "✔ nginx running (pid: 2847)" },
  { t: "empty",   s: "" },
  { t: "cmd",     s: "$ curl -I http://localhost" },
  { t: "success", s: "HTTP/1.1 200 OK" },
  { t: "dim",     s: "Server: nginx/1.24.0" },
];

function lineColor(t) {
  if (t === "error")   return "text-[#EF4444]";
  if (t === "success") return "text-[#22C55E]";
  if (t === "cmd")     return "text-[#E6EDF3]";
  if (t === "dim")     return "text-[#9AA4AF]";
  return "";
}

function TerminalDemo() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible >= HERO_LINES.length) return;
    const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 400 : 180);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="bg-black border border-[#1F2933] rounded-xl overflow-hidden font-mono text-sm w-full max-w-lg">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#1F2933] bg-[#080808]">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[#9AA4AF] text-xs">ubuntu@prod-server — bash</span>
      </div>
      <div className="p-4 space-y-0.5 min-h-[180px]">
        {HERO_LINES.slice(0, visible).map((l, i) => (
          <div key={i} className={`leading-5 ${lineColor(l.t)}`}>{l.s || "\u00A0"}</div>
        ))}
        {visible < HERO_LINES.length && (
          <span className="inline-block w-2 h-4 bg-[#22C55E] animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, children, className = "" }) {
  return (
    <section id={id} className={`px-6 md:px-12 lg:px-24 py-20 md:py-28 ${className}`}>
      {children}
    </section>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-4">{children}</p>
  );
}

// ── Pricing checkout ──────────────────────────────────────────────────────────
async function checkout(plan = "early") {
  try {
    const r = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else window.location.href = "/?pricing=1";
  } catch { window.location.href = "/?pricing=1"; }
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "Do I need Linux experience?",       a: "No. The labs start simple and escalate. You learn by doing, not by reading prerequisites." },
  { q: "What do the labs cover?",           a: "Real sysadmin incidents: nginx/Apache down, disk full, Docker crashes, TLS errors, permission issues, and more." },
  { q: "Is this different from a tutorial?", a: "Yes. You get a broken terminal. No step-by-step guide. You fix it — or you don't." },
  { q: "Can I cancel anytime?",             a: "Yes. Cancel in 30 seconds from your account. No calls, no forms." },
  { q: "What's included in free?",          a: "6 labs, no time limit, no credit card required. Start now." },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1F2933]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-[#E6EDF3] text-sm font-medium pr-4">{q}</span>
        <span className="text-[#4b5563] font-mono text-xs shrink-0">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="text-[#9AA4AF] text-sm pb-5 leading-relaxed">{a}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewLandingPage({ onStartLab, onLogin, onRegister }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const variant = getVariant();

  function handleStart() {
    // Triggers the A/B test onboarding flow
    onStartLab?.();
  }

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#E6EDF3]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-40 border-b border-[#1F2933] bg-[#0B0D10]/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-mono font-black text-sm tracking-widest">
            WIN<span className="text-[#22C55E]">LAB</span>
          </span>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how" className="text-[#9AA4AF] text-sm hover:text-white transition-colors">How it works</a>
            <a href="#labs" className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Labs</a>
            <a href="#pricing" className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Pricing</a>
            <button onClick={onLogin} className="text-[#9AA4AF] text-sm hover:text-white transition-colors">Sign in</button>
            <button
              onClick={handleStart}
              className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-5 py-2 hover:bg-gray-100 transition-colors"
            >
              Start free
            </button>
          </div>
          <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden text-[#9AA4AF] font-mono text-xs">
            {mobileMenuOpen ? "close" : "menu"}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#1F2933] bg-[#0B0D10] px-6 py-4 space-y-3">
            <a href="#how"     onClick={() => setMobileMenuOpen(false)} className="block text-[#9AA4AF] text-sm py-1">How it works</a>
            <a href="#labs"    onClick={() => setMobileMenuOpen(false)} className="block text-[#9AA4AF] text-sm py-1">Labs</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-[#9AA4AF] text-sm py-1">Pricing</a>
            <button onClick={() => { setMobileMenuOpen(false); onLogin?.(); }} className="block text-[#9AA4AF] text-sm py-1 w-full text-left">Sign in</button>
            <button onClick={() => { setMobileMenuOpen(false); handleStart(); }} className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-2.5 mt-2">
              Start free
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <Section id="hero" className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-6">
              {variant === "B" ? "production incident · live terminal" : "sysadmin training · real incidents"}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight mb-6">
              Break real servers.<br />Get hired.
            </h1>
            <p className="text-[#9AA4AF] text-lg leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
              Fix real incidents in a live terminal. No videos. No theory. Just you and a broken server.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={handleStart}
                className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-gray-100 transition-colors"
              >
                Start first incident — free
              </button>
              <button
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-[#1F2933] text-[#9AA4AF] font-mono text-xs tracking-widest uppercase px-8 py-4 hover:border-[#374151] hover:text-white transition-colors"
              >
                How it works
              </button>
            </div>
            <p className="text-[#374151] font-mono text-[10px] mt-5 tracking-wider">
              free · no credit card · 6 labs included
            </p>
          </div>

          {/* Terminal preview */}
          <div className="flex-1 w-full flex justify-center lg:justify-end">
            <TerminalDemo />
          </div>
        </div>
      </Section>

      {/* ── HOW IT WORKS ── */}
      <Section id="how" className="max-w-6xl mx-auto border-t border-[#1F2933]">
        <div className="text-center mb-12">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight">Three steps. No fluff.</h2>
        </div>
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
      </Section>

      {/* ── PROOF ── */}
      <Section id="proof" className="max-w-6xl mx-auto border-t border-[#1F2933]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: "12,000+",  l: "incidents solved" },
            { n: "6 min",    l: "avg resolution time" },
            { n: "87%",      l: "complete first lab" },
            { n: "24",       l: "labs available" },
          ].map(m => (
            <div key={m.l}>
              <div className="text-3xl md:text-4xl font-semibold text-[#E6EDF3] mb-1">{m.n}</div>
              <div className="font-mono text-[10px] text-[#4b5563] uppercase tracking-widest">{m.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── LAB GRID ── */}
      <Section id="labs" className="max-w-6xl mx-auto border-t border-[#1F2933]">
        <div className="text-center mb-12">
          <SectionLabel>Incident catalog</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight">Real problems. Real terminals.</h2>
          <p className="text-[#9AA4AF] mt-3 max-w-lg mx-auto">Every lab is based on an incident that has taken down production systems at real companies.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Nginx down",         tag: "free",  desc: "Service fails on boot. Port conflict. Fix it before users notice." },
            { title: "Disk full",          tag: "free",  desc: "Server hits 100%. Everything stops. Find what's eating space and clear it." },
            { title: "Docker crash",       tag: "pro",   desc: "Container exits with code 1. No logs. Trace the failure." },
            { title: "TLS broken",         tag: "pro",   desc: "Certificate expired. HTTPS down. Renew and restore in under 10 minutes." },
            { title: "SSH refused",        tag: "free",  desc: "Locked out of your own server. Get back in without a reboot." },
            { title: "Apache 502",         tag: "pro",   desc: "Reverse proxy fails. Upstream unreachable. Find and fix the chain." },
            { title: "RAID degraded",      tag: "pro",   desc: "One disk is dead. Array is running degraded. Replace and rebuild." },
            { title: "LDAP auth failure",  tag: "pro",   desc: "Users can't login. SSSD is broken. Fix the identity pipeline." },
          ].map(lab => (
            <div key={lab.title} className="bg-[#11151A] border border-[#1F2933] rounded-xl p-5 hover:border-[#374151] transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <span className={`font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${
                  lab.tag === "free"
                    ? "text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20"
                    : "text-[#4F8CFF] bg-[#4F8CFF]/10 border border-[#4F8CFF]/20"
                }`}>{lab.tag}</span>
              </div>
              <h3 className="text-[#E6EDF3] font-medium text-sm mb-1.5">{lab.title}</h3>
              <p className="text-[#4b5563] text-xs leading-relaxed">{lab.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={handleStart}
            className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-8 py-4 hover:bg-gray-100 transition-colors"
          >
            Start first incident — free
          </button>
        </div>
      </Section>

      {/* ── PRICING ── */}
      <Section id="pricing" className="max-w-6xl mx-auto border-t border-[#1F2933]">
        <div className="text-center mb-12">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight">Simple. No tricks.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
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
            <button
              onClick={onRegister}
              className="w-full border border-[#1F2933] text-[#E6EDF3] font-mono text-xs tracking-widest uppercase py-3 hover:border-[#374151] transition-colors"
            >
              Start free
            </button>
          </div>

          {/* Pro */}
          <div className="bg-[#11151A] border border-[#22C55E]/30 rounded-xl p-8 relative">
            <div className="absolute top-4 right-4 font-mono text-[9px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2 py-0.5 rounded uppercase tracking-widest">
              early price
            </div>
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
            <button
              onClick={() => checkout("early")}
              className="w-full bg-white text-black font-mono font-bold text-xs tracking-widest uppercase py-3 hover:bg-gray-100 transition-colors"
            >
              Unlock all 24 labs — $5/mo
            </button>
          </div>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" className="max-w-2xl mx-auto border-t border-[#1F2933]">
        <div className="text-center mb-10">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
        </div>
        <div>
          {FAQ_ITEMS.map(item => <FAQItem key={item.q} {...item} />)}
        </div>
      </Section>

      {/* ── FOOTER CTA ── */}
      <Section className="max-w-6xl mx-auto border-t border-[#1F2933] text-center">
        <p className="font-mono text-[10px] text-[#4b5563] uppercase tracking-[0.25em] mb-6">The server is down</p>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">Fix it or leave.</h2>
        <p className="text-[#9AA4AF] mb-8">No videos. No theory. Just you and a broken terminal.</p>
        <button
          onClick={handleStart}
          className="bg-white text-black font-mono font-bold text-xs tracking-widest uppercase px-10 py-4 hover:bg-gray-100 transition-colors"
        >
          Start first incident — free
        </button>
      </Section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#1F2933] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-mono font-black text-sm tracking-widest">WIN<span className="text-[#22C55E]">LAB</span></span>
          <div className="flex gap-6">
            <button onClick={onLogin}   className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Sign in</button>
            <a href="/privacy"           className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Privacy</a>
            <a href="mailto:support@winlab.cloud" className="text-[#4b5563] font-mono text-[10px] hover:text-[#9AA4AF] transition-colors uppercase tracking-widest">Support</a>
          </div>
          <span className="font-mono text-[#1F2933] text-[10px]">© 2025 WinLab</span>
        </div>
      </footer>

    </div>
  );
}
