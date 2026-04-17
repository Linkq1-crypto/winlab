// LandingPage.jsx – WINLAB v7 · Cyber-Ops Dark Mode
// CRO-optimised single-page landing · React + Tailwind + Framer Motion
import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// ─── Countdown helpers ────────────────────────────────────────────────────────
function useCountdown(deadline) {
  const calc = () => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s, expired: false };
  };
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}

function Pad({ n }) {
  return <span>{String(n).padStart(2, "0")}</span>;
}

// Compact digit block used inside both banner and card
function TimeBlock({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-[44px]">
      <span className="text-2xl sm:text-3xl font-black text-white tabular-nums leading-none">
        <Pad n={value} />
      </span>
      <span className="text-[9px] uppercase tracking-widest text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

// Sticky top banner – always visible above hero
function CountdownBanner({ deadline }) {
  const left = useCountdown(deadline);
  if (!left || left.expired) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 border-b border-blue-500/40 shadow-lg shadow-blue-900/40">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span className="text-xs font-bold text-blue-100 uppercase tracking-wider whitespace-nowrap">
          ⚡ Early Access $5 — offer ends in
        </span>
        <div className="flex items-center gap-1">
          {left.d > 0 && (
            <>
              <span className="text-white font-black text-sm tabular-nums">{left.d}d</span>
              <span className="text-blue-300 mx-0.5">:</span>
            </>
          )}
          <span className="text-white font-black text-sm tabular-nums"><Pad n={left.h} />h</span>
          <span className="text-blue-300 mx-0.5">:</span>
          <span className="text-white font-black text-sm tabular-nums"><Pad n={left.m} />m</span>
          <span className="text-blue-300 mx-0.5">:</span>
          <span className="text-white font-black text-sm tabular-nums"><Pad n={left.s} />s</span>
        </div>
        <a href="#early-access" className="text-xs font-bold bg-white text-blue-700 px-3 py-1 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap">
          Lock $5 →
        </a>
      </div>
    </div>
  );
}

// Large countdown card — embedded inside EarlyAccessSignup
function CountdownCard({ deadline }) {
  const left = useCountdown(deadline);
  if (!left) return null;
  if (left.expired) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-center mb-6">
        <p className="text-sm font-bold text-slate-400">Early access period has ended.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 mb-6">
      <p className="text-center text-xs font-bold text-orange-400 uppercase tracking-widest mb-3">
        Offerta scade tra
      </p>
      <div className="flex items-center justify-center gap-3">
        {left.d > 0 && <TimeBlock value={left.d} label="giorni" />}
        {left.d > 0 && <span className="text-2xl font-black text-slate-600 mb-3">:</span>}
        <TimeBlock value={left.h} label="ore" />
        <span className="text-2xl font-black text-slate-600 mb-3">:</span>
        <TimeBlock value={left.m} label="min" />
        <span className="text-2xl font-black text-slate-600 mb-3">:</span>
        <TimeBlock value={left.s} label="sec" />
      </div>
    </div>
  );
}

// ─── Motion helpers ────────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
});

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onCTA, hasBanner }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed inset-x-0 z-50 transition-all duration-300 ${
        hasBanner ? "top-9" : "top-0"
      } ${scrolled ? "bg-[#0a0a0b]/90 backdrop-blur-md border-b border-slate-800/60" : ""}`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500 font-black text-xl tracking-tight">WIN</span>
          <span className="text-white font-black text-xl tracking-tight">LAB</span>
          <span className="text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded ml-1">v7</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#labs"    className="hover:text-white transition-colors">Labs</a>
          <a href="#mentor"  className="hover:text-white transition-colors">AI Mentor</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#cert"    className="hover:text-white transition-colors">Certification</a>
        </div>
        <button
          onClick={onCTA}
          className="text-sm px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Start Free Lab →
        </button>
      </div>
    </motion.nav>
  );
}

// ─── Terminal mockup ───────────────────────────────────────────────────────────
const TERMINAL_LINES = [
  { text: "$ terraform apply -auto-approve", type: "cmd",  delay: 0    },
  { text: "", type: "blank", delay: 400 },
  { text: "Terraform will perform the following actions:", type: "out", delay: 600 },
  { text: "", type: "blank", delay: 800 },
  { text: '  + resource "vsphere_virtual_machine" "web_srv_01" {', type: "add", delay: 900 },
  { text: '      + name             = "web-srv-01"',               type: "add", delay: 1050 },
  { text: '      + num_cpus         = 4',                          type: "add", delay: 1150 },
  { text: '      + memory           = 8192',                       type: "add", delay: 1250 },
  { text: '      + datastore_id     = data.vsphere_datastore.ds01', type: "add", delay: 1350 },
  { text: '    }',                                                 type: "add", delay: 1450 },
  { text: "", type: "blank", delay: 1600 },
  { text: "Plan: 1 to add, 0 to change, 0 to destroy.", type: "warn", delay: 1700 },
  { text: "", type: "blank", delay: 1900 },
  { text: "vsphere_virtual_machine.web_srv_01: Creating...", type: "out", delay: 2000 },
  { text: "vsphere_virtual_machine.web_srv_01: Still creating... [10s elapsed]", type: "out", delay: 2400 },
  { text: "vsphere_virtual_machine.web_srv_01: Creation complete after 18s", type: "ok",  delay: 2900 },
  { text: "", type: "blank", delay: 3100 },
  { text: "Apply complete! Resources: 1 added, 0 changed, 0 destroyed.", type: "ok", delay: 3200 },
];

function TerminalMockup() {
  const [visible, setVisible] = useState(0);
  const [cursor, setCursor]   = useState(true);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    TERMINAL_LINES.forEach((line, i) => {
      setTimeout(() => setVisible(i + 1), line.delay);
    });
  }, [inView]);

  useEffect(() => {
    const t = setInterval(() => setCursor(c => !c), 500);
    return () => clearInterval(t);
  }, []);

  const colorMap = {
    cmd:   "text-white",
    out:   "text-slate-400",
    add:   "text-green-400",
    warn:  "text-yellow-400",
    ok:    "text-green-400 font-semibold",
    blank: "",
  };

  return (
    <div ref={ref} className="rounded-xl border border-slate-700/60 bg-[#050507] overflow-hidden shadow-2xl shadow-black/60">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-slate-500 font-mono">winlab — terraform@vsphere-lab:~</span>
      </div>
      {/* Body */}
      <div className="p-5 font-mono text-xs md:text-sm leading-6 min-h-[320px]">
        {TERMINAL_LINES.slice(0, visible).map((line, i) => (
          <div key={i} className={colorMap[line.type] || "text-slate-400"}>
            {line.text}
            {i === visible - 1 && visible < TERMINAL_LINES.length && (
              <span className={`inline-block w-2 h-4 bg-green-400 ml-0.5 align-middle ${cursor ? "opacity-100" : "opacity-0"}`} />
            )}
          </div>
        ))}
        {visible >= TERMINAL_LINES.length && (
          <div className="text-white mt-1">
            $ <span className={`inline-block w-2 h-4 bg-green-400 ml-0.5 align-middle ${cursor ? "opacity-100" : "opacity-0"}`} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onCTA }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/[0.08] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-blue-800/[0.06] rounded-full blur-3xl" />
      </div>

      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div>
          <motion.div {...fadeUp(0.1)} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-blue-600/30 bg-blue-600/10 text-blue-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            10 interactive labs · AI Mentor · Verified Certification
          </motion.div>

          <motion.h1 {...fadeUp(0.2)} className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] mb-6">
            Break the servers.<br />
            <span className="text-blue-500">Save your career.</span>
          </motion.h1>

          <motion.p {...fadeUp(0.3)} className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
            The only hands-on sysadmin simulator where you can fail safely —
            without taking down production. Master vSphere, RAID, Linux, SSSD
            and Terraform in a realistic sandbox.
          </motion.p>

          <motion.div {...fadeUp(0.4)} className="flex flex-wrap gap-4">
            {/* Primary CTA – neon glow effect */}
            <button
              onClick={onCTA}
              className="relative group px-7 py-4 bg-blue-600 text-white font-bold rounded-xl text-sm overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute -inset-1 bg-blue-600/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <span className="relative">Start First Lab — Free →</span>
            </button>

            <a
              href="#pricing"
              className="px-7 py-4 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold rounded-xl text-sm transition-all"
            >
              B2B Team Plans
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div {...fadeUp(0.5)} className="flex items-center gap-6 mt-10 text-xs text-slate-600">
            <span>✓ No credit card required</span>
            <span>✓ Cancel anytime</span>
            <span>✓ Linux & Windows scenarios</span>
          </motion.div>
        </div>

        {/* Terminal */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <TerminalMockup />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-700"
      >
        <span className="text-xs">scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-px h-8 bg-gradient-to-b from-slate-700 to-transparent"
        />
      </motion.div>
    </section>
  );
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────
const STATS = [
  { value: "10",   label: "Interactive Labs"     },
  { value: "60+",  label: "Real-world Scenarios" },
  { value: "100%", label: "Browser-based"        },
  { value: "∞",    label: "Times you can fail"   },
];

function StatsBar() {
  return (
    <Reveal>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 rounded-2xl overflow-hidden border border-slate-800">
          {STATS.map((s, i) => (
            <div key={i} className="bg-[#0d0d0f] px-8 py-6 text-center">
              <p className="text-3xl font-black text-blue-400 mb-1">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ─── Labs grid ─────────────────────────────────────────────────────────────────
// First 5 labs are open (Free), the rest are locked
const LABS_OPEN = [
  { icon: "🔴", title: "Apache down",        desc: "Il sito non risponde — trova e risolvi",            diff: "Base",   tier: "Free"  },
  { icon: "💾", title: "Disco pieno",         desc: "Il server è bloccato — spazio esaurito",            diff: "Base",   tier: "Free"  },
  { icon: "🔒", title: "SELinux denial",      desc: "httpd dà 403 — contesto file sbagliato",            diff: "Base",   tier: "Free"  },
  { icon: "🔥", title: "CPU al 100%",         desc: "Qualcosa sta martellando il server",                diff: "Base",   tier: "Free"  },
  { icon: "🚫", title: "SSH rifiutato",       desc: "Cannot connect — diagnosi firewall",                diff: "Base",   tier: "Free"  },
];

const LABS_LOCKED = [
  { icon: "🗄",  title: "MySQL down",           desc: "Il database è down dopo un aggiornamento",          diff: "Adv",   tier: "Pro"   },
  { icon: "🧠",  title: "RAM / Swap esaurita",  desc: "OOM killer attivo — sistema instabile",           diff: "Adv",   tier: "Pro"   },
  { icon: "⏰",  title: "Cron non esegue",      desc: "Il backup notturno non parte da settimane",        diff: "Adv",   tier: "Pro"   },
  { icon: "💀",  title: "Processi zombie",       desc: "Decine di processi Z — sistema degradato",        diff: "Adv",   tier: "Pro"   },
  { icon: "📋",  title: "Journald pieno",        desc: "I log di sistema occupano 40G",                   diff: "Adv",   tier: "Pro"   },
  { icon: "📂",  title: "NFS mount hang",        desc: "Il client è bloccato — mount NFS non risponde",   diff: "Expert", tier: "Pro"   },
  { icon: "🗂",  title: "LVM volume pieno",      desc: "Il volume /data è al 100% — estendi LVM",         diff: "Expert", tier: "Pro"   },
  { icon: "🔍",  title: "DNS non risolve",       desc: "I nomi host non risolvono — servizi ko",          diff: "Expert", tier: "Pro"   },
  { icon: "⚔",  title: "Brute force SSH",        desc: "Attacco in corso — migliaia di tentativi login",  diff: "Expert", tier: "Pro"   },
  { icon: "💥",  title: "Kernel panic boot",      desc: "Il server non boota dopo un aggiornamento",      diff: "Expert", tier: "Pro"   },
  { icon: "🔐",  title: "Certificato SSL scaduto", desc: "HTTPS down — cert scaduto, rinnovo urgente",   diff: "Nightmare", tier: "Pro" },
  { icon: "🔢",  title: "Inode esauriti",         desc: "Disco 'libero' ma non si crea nessun file",     diff: "Nightmare", tier: "Pro" },
  { icon: "🔌",  title: "Porta già occupata",     desc: "Apache non parte — porta 80 in conflitto",      diff: "Nightmare", tier: "Pro" },
  { icon: "🔑",  title: "Sudoers corrotto",       desc: "sudo è rotto — accesso privilegiato perduto",   diff: "Nightmare", tier: "Pro" },
  { icon: "💣",  title: "RAID degradato",         desc: "Un disco è fallito — array in stato degraded",  diff: "Nightmare", tier: "Pro" },
  { icon: "📦",  title: "Logrotate rotto",        desc: "I log non ruotano — errore configurazione",     diff: "Nightmare", tier: "Pro" },
];

const DIFF_STYLE = {
  Free:       "text-green-400  border-green-500/30  bg-green-500/10",
  Base:       "text-green-400  border-green-500/30  bg-green-500/10",
  Adv:        "text-sky-300    border-sky-500/40    bg-sky-500/10",
  Expert:     "text-orange-300 border-orange-500/40 bg-orange-500/10",
  Nightmare:  "text-red-300    border-red-500/40    bg-red-500/10",
  Medium:     "text-sky-300    border-sky-500/40    bg-sky-500/10",
  Hard:       "text-orange-300 border-orange-500/40 bg-orange-500/10",
};

const TIER_STYLE = {
  Free: "text-slate-300",
  Pro:  "text-blue-300",
  Biz:  "text-purple-300",
};

function LabsGrid({ onCTA }) {
  return (
    <section id="labs" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-blue-400 uppercase tracking-widest">Curriculum</span>
            <h2 className="text-4xl font-black text-white mt-3 mb-4">
              Linux Terminal — 24 Scenari
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              5 scenari gratuiti subito disponibili. Gli altri 19 si sbloccano con Pro.
            </p>
          </div>
        </Reveal>

        {/* Linux Terminal — Center Hero */}
        <Reveal delay={0}>
          <button
            onClick={onCTA}
            className="mx-auto mb-12 block group relative rounded-2xl border-2 border-blue-600/40 bg-blue-600/5 hover:bg-blue-600/10 transition-all overflow-hidden max-w-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/5 to-blue-600/0 group-hover:via-blue-600/10 transition-all" />
            <div className="relative flex items-center gap-6 p-8 text-left">
              <div className="w-20 h-20 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-4xl shrink-0">
                🖥️
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-green-400 border-green-500/30 bg-green-500/10">
                    FREE
                  </span>
                  <span className="text-[10px] text-slate-500">24 scenari</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Linux Terminal</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Dalla free shell al kernel panic. 24 scenari reali — Apache down, disco pieno, SELinux, CPU 100%, SSH bloccato, e molti altri.
                </p>
              </div>
              <span className="text-2xl text-blue-400 group-hover:translate-x-1 transition-transform shrink-0">→</span>
            </div>
          </button>
        </Reveal>

        {/* 5 Open Labs */}
        <Reveal delay={0.1}>
          <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Disponibili ora — 5 scenari
          </h3>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          {LABS_OPEN.map((lab, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <button
                onClick={onCTA}
                className="group w-full flex flex-col gap-2 p-5 rounded-xl border border-green-600/20 bg-green-600/5 hover:border-green-600/40 hover:bg-green-600/10 transition-all text-left"
              >
                <span className="text-2xl">{lab.icon}</span>
                <h4 className="text-sm font-bold text-white leading-snug">{lab.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed flex-1">{lab.desc}</p>
                <span className="text-xs text-green-400 font-medium mt-1 group-hover:translate-x-0.5 transition-transform">
                  Start →
                </span>
              </button>
            </Reveal>
          ))}
        </div>

        {/* 19 Locked Labs */}
        <Reveal delay={0.1}>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            Sblocca con Pro — 19 scenari
          </h3>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          {LABS_LOCKED.map((lab, i) => (
            <Reveal key={i} delay={i * 0.03}>
              <div
                onClick={onCTA}
                className="w-full flex flex-col gap-2 p-5 rounded-xl border border-slate-800/40 bg-slate-900/20 opacity-50 cursor-pointer hover:opacity-70 hover:border-slate-700 transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{lab.icon}</span>
                  <span className="text-xs text-slate-700">🔒</span>
                </div>
                <h4 className="text-sm font-bold text-slate-500 leading-snug">{lab.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">{lab.desc}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DIFF_STYLE[lab.diff]}`}>
                  {lab.diff}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="text-center">
            <button
              onClick={onCTA}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Start Free — Linux Terminal Lab →
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── AI Mentor section ─────────────────────────────────────────────────────────
const CHAT_DEMO = [
  { role: "user", text: "I typed systemctl restart nginx but it still fails. What's wrong?" },
  { role: "ai",   text: "Good instinct checking the service. What does `journalctl -u nginx --no-pager -n 20` tell you about why it's failing?" },
  { role: "user", text: "It says: bind() to 0.0.0.0:80 failed (98: Address already in use)" },
  { role: "ai",   text: "Port 80 is already occupied. Which process do you think is holding it? There's a command that maps open ports to their owner processes..." },
];

function AIMentorSection() {
  const [visible, setVisible] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    CHAT_DEMO.forEach((_, i) => setTimeout(() => setVisible(i + 1), i * 1200));
  }, [inView]);

  return (
    <section id="mentor" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-600/3 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Chat mockup */}
        <Reveal>
          <div ref={ref} className="rounded-2xl border border-slate-800 bg-[#0d0d0f] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/40">
              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-lg">🤖</div>
              <div>
                <p className="text-sm font-semibold text-white">AI Mentor</p>
                <p className="text-xs text-green-400">● Online</p>
              </div>
              <div className="ml-auto text-xs text-slate-600 font-mono">claude-haiku · cached</div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4 min-h-[280px]">
              <AnimatePresence>
                {CHAT_DEMO.slice(0, visible).map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`
                      max-w-[85%] text-sm px-4 py-2.5 rounded-2xl leading-relaxed
                      ${msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 rounded-bl-sm"}
                    `}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {visible > 0 && visible < CHAT_DEMO.length && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                    <span className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-500"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ repeat: Infinity, duration: 1, delay: d / 1000 }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-slate-800">
              <div className="flex gap-2 items-center bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500">
                Ask a question…
                <span className="ml-auto text-slate-700">↵</span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Copy */}
        <Reveal delay={0.1}>
          <div>
            <span className="text-xs text-blue-400 uppercase tracking-widest">AI-Powered Learning</span>
            <h2 className="text-4xl font-black text-white mt-3 mb-6">
              Your mentor guides.<br />Never gives the answer.
            </h2>
            <div className="space-y-5">
              {[
                { icon: "🧠", title: "Socratic method", desc: "The AI reads your lab state — broken disks, failed services, error logs — and asks targeted questions that lead you to the solution." },
                { icon: "⚡", title: "Near-zero cost via caching", desc: "Repeated questions are served from our DB cache instantly. Claude Haiku handles only new ones, keeping your subscription price low." },
                { icon: "📈", title: "Builds real skills", desc: "Unlike tutorials, you must diagnose and act. The AI never types the command for you. That's the difference between knowing and doing." },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0">{item.icon}</div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
const PRICING = [
  {
    name: "Individual",
    price: "$19",
    cycle: "/month",
    desc: "Everything you need to level up your sysadmin career.",
    color: "border-slate-700",
    accentText: "text-blue-400",
    btnClass: "bg-blue-600 hover:bg-blue-500 text-white",
    features: [
      "All 8 core labs unlocked",
      "Unlimited AI Mentor hints",
      "AI Challenge Generator",
      "Certificate of Excellence",
      "Cloud progress sync",
      "Cancel anytime",
    ],
  },
  {
    name: "Lifetime",
    price: "$149",
    cycle: "one-time",
    desc: "Pay once. Access forever. Best value for serious engineers.",
    color: "border-blue-600",
    accentText: "text-blue-400",
    btnClass: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30",
    badge: "Best Value",
    highlight: true,
    features: [
      "Everything in Individual",
      "Lifetime access — no renewals",
      "All future labs included",
      "Priority support",
      "Early access to new content",
      "One-time payment",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    cycle: "",
    desc: "For teams and companies training multiple engineers.",
    color: "border-purple-700/50",
    accentText: "text-purple-400",
    btnClass: "bg-purple-600 hover:bg-purple-500 text-white",
    features: [
      "Everything in Lifetime",
      "All 10 labs (Network + Security)",
      "Team Dashboard",
      "Track employee progress",
      "Dedicated onboarding",
      "SLA + invoice billing",
    ],
  },
];

// ─── Early Access Counter + Email Signup ────────────────────────────────────────
function EarlyAccessSignup({ deadline }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ remainingSeats: 500, totalSeats: 500, claimedSeats: 0 });

  // Fetch seat count on mount
  useEffect(() => {
    fetch("/api/early-access/seats")
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => setStats({ remainingSeats: 500, totalSeats: 500, claimedSeats: 0 }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/early-access/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
      setStats(prev => ({
        ...prev,
        claimedSeats: prev.claimedSeats + 1,
        remainingSeats: Math.max(0, prev.remainingSeats - 1),
      }));

      // Track conversion
      navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
        event: "early_access_signup",
        data: { email: email.slice(0, 3) + "***" },
        timestamp: new Date().toISOString(),
      }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const claimedPct = Math.round(((stats.totalSeats - stats.remainingSeats) / stats.totalSeats) * 100);

  return (
    <section id="early-access" className="py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 relative">
        <Reveal>
          <div className="rounded-2xl border border-blue-600/30 bg-slate-900/80 backdrop-blur-sm p-8 sm:p-10">
            {/* Header */}
            <div className="text-center mb-6">
              <span className="inline-block text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20 mb-3">
                🔒 Early Access — Limited Spots
              </span>
              <h2 className="text-3xl font-black text-white mb-2">
                Lock Your $5 Price Before Launch
              </h2>
              <p className="text-slate-400">
                Regular price: <span className="line-through text-slate-500">$19/mo</span>. 
                Early access: <span className="text-green-400 font-bold">$5 one-time</span>. 
                Save 74%.
              </p>
            </div>

            {/* Countdown */}
            <CountdownCard deadline={deadline} />

            {/* Counter */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">
                  <span className="text-white font-bold">{stats.claimedSeats}</span> of {stats.totalSeats} spots claimed
                </span>
                <span className="text-blue-400 font-bold">{claimedPct}%</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-1000"
                  style={{ width: `${claimedPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                {stats.remainingSeats} spots remaining — first come, first served
              </p>
            </div>

            {/* Success State */}
            {success ? (
              <div className="text-center py-6">
                <span className="text-4xl mb-3 block">🎉</span>
                <h3 className="text-xl font-bold text-green-400 mb-2">You're In!</h3>
                <p className="text-slate-300 text-sm">
                  Your $5 price is locked. Check your email for confirmation.
                </p>
              </div>
            ) : (
              /* Email Signup Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ea-name" className="block text-xs text-slate-400 mb-1">Name (optional)</label>
                    <input
                      id="ea-name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="ea-email" className="block text-xs text-slate-400 mb-1">Email *</label>
                    <input
                      id="ea-email"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-blue-600/20"
                >
                  {loading ? "Claiming your spot..." : "🔒 Claim My $5 Spot →"}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  No spam. No credit card. Unsubscribe anytime.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Pricing({ onCTA }) {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-blue-400 uppercase tracking-widest">Pricing</span>
            <h2 className="text-4xl font-black text-white mt-3 mb-4">
              Simple, honest pricing
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Start free with the Linux Terminal lab. Upgrade when you're ready to go deeper.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PRICING.map((plan, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className={`
                relative flex flex-col rounded-2xl border p-8
                ${plan.highlight ? "bg-blue-600/5 border-blue-600 sm:scale-[1.03]" : "bg-slate-900/60 " + plan.color}
              `}>
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white">
                    {plan.badge}
                  </span>
                )}

                <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400 mb-5">{plan.desc}</p>

                <div className="flex items-end gap-1.5 mb-7">
                  <span className={`text-4xl font-black ${plan.accentText}`}>{plan.price}</span>
                  {plan.cycle && <span className="text-slate-400 text-sm mb-1">{plan.cycle}</span>}
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={plan.name === "Enterprise"
                    ? () => window.location.href = "mailto:sales@winlab.cloud"
                    : onCTA}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${plan.btnClass}`}
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Get Started →"}
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <p className="text-center text-slate-500 text-xs mt-8">
            Secure checkout via Stripe · SSL encrypted · No hidden fees
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Certification ─────────────────────────────────────────────────────────────
function CertSection() {
  return (
    <section id="cert" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-600/3 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div>
            <span className="text-xs text-green-400 uppercase tracking-widest">Certification</span>
            <h2 className="text-4xl font-black text-white mt-3 mb-5">
              Earn a certificate you can actually show.
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              Complete all 10 labs and receive a WINLAB Certificate of Excellence with a unique,
              publicly verifiable ID. Post it on LinkedIn, add it to your CV, or share the
              verification link with your next employer.
            </p>
            <div className="space-y-3">
              {[
                "Issued instantly after completing 10 labs",
                "Unique ID — anyone can verify it at winlab.io/cert/verify",
                "Printable as PDF · shareable on LinkedIn",
                "Recognised by hiring managers in IT infrastructure",
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-green-500 shrink-0">✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Certificate preview */}
        <Reveal delay={0.1}>
          <motion.div
            whileHover={{ scale: 1.02, rotate: 0.5 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="relative mx-auto max-w-md rounded-2xl border-2 border-blue-600/30 bg-[#0d0d0f] p-10 text-center"
          >
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-blue-600/50 rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-blue-600/50 rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-blue-600/50 rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-blue-600/50 rounded-br-2xl" />

            <div className="mb-4">
              <span className="text-blue-500 font-black text-2xl tracking-tight">WIN</span>
              <span className="text-white font-black text-2xl tracking-tight">LAB</span>
            </div>
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-3">Certificate of Excellence</p>
            <p className="text-slate-300 text-xs mb-1">This certifies that</p>
            <h3 className="text-2xl font-bold text-white mb-5">Alex Johnson</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-6">
              has successfully completed all <strong className="text-white">10 professional sysadmin labs</strong>{" "}
              demonstrating mastery of Linux, RAID, vSphere, LDAP, and incident response.
            </p>
            <div className="w-16 h-16 rounded-full border-2 border-green-500/30 bg-green-500/10 flex items-center justify-center text-3xl mx-auto mb-5">🏆</div>
            <p className="text-slate-400 text-[10px] font-mono">ID: WINLAB-1748291000-A7F3C291</p>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Social proof / testimonials ───────────────────────────────────────────────
// Reviews section hidden until real reviews are collected
const TESTIMONIALS = [];

function Testimonials() {
  if (TESTIMONIALS.length === 0) return null; // Hidden until real reviews collected
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <h2 className="text-3xl font-black text-white text-center mb-12">
            Engineers who survived production by practicing here first
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <div className="flex flex-col p-6 rounded-xl border border-slate-800 bg-slate-900/40 h-full">
                <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">{t.avatar}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA banner ──────────────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  return (
    <Reveal>
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="relative rounded-2xl border border-blue-600/20 bg-blue-600/5 px-6 py-10 sm:p-14 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />
            <h2 className="text-4xl font-black text-white mb-5 relative">
              Start breaking things.<br />Start learning for real.
            </h2>
            <p className="text-slate-300 mb-8 relative">
              The Linux Terminal lab is free — no card, no catch.
              You'll be in a live scenario in under 30 seconds.
            </p>
            <button
              onClick={onCTA}
              className="relative px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-600/20"
            >
              Start Free Lab →
            </button>
            <p className="text-xs text-slate-400 mt-4 relative">Free forever · No signup required for the first lab</p>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer({ onNavigate }) {
  const handleLink = (id) => {
    if (onNavigate) {
      onNavigate(id);
    } else {
      // Fallback: scroll to section or open legal
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="border-t border-slate-800 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid sm:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-blue-500 font-black text-lg">WIN</span>
              <span className="text-white font-black text-lg">LAB</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">Built for SysAdmins by SysAdmins.<br />Master the terminal before it masters you.</p>
          </div>

          {[
            {
              title: "Labs",
              links: [
                { label: "Linux Terminal", action: () => handleLink("labs") },
                { label: "RAID Simulator", action: () => handleLink("pricing") },
                { label: "vSphere", action: () => handleLink("pricing") },
                { label: "SSSD / LDAP", action: () => handleLink("pricing") },
                { label: "Real Incidents", action: () => handleLink("pricing") },
              ],
            },
            {
              title: "Product",
              links: [
                { label: "Pricing", action: () => handleLink("pricing") },
                { label: "AI Mentor", action: () => handleLink("mentor") },
                { label: "Certification", action: () => handleLink("cert") },
                { label: "Enterprise", action: () => handleLink("pricing") },
                { label: "Changelog", action: () => handleLink("community") },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", action: () => handleLink("about") },
                { label: "Blog", action: () => handleLink("blog") },
                { label: "GitHub", url: "https://github.com/winlab-io" },
                { label: "LinkedIn", url: "https://linkedin.com/company/winlab" },
              ],
            },
            {
              title: "Contact",
              links: [
                { label: "support@winlab.cloud", url: "mailto:support@winlab.cloud" },
                { label: "hello@winlab.cloud", url: "mailto:hello@winlab.cloud" },
                { label: "sales@winlab.cloud", url: "mailto:sales@winlab.cloud" },
                { label: "billing@winlab.cloud", url: "mailto:billing@winlab.cloud" },
                { label: "security@winlab.cloud", url: "mailto:security@winlab.cloud" },
                { label: "Privacy", action: () => handleLink("legal") },
              ],
            },
          ].map(col => (
            <div key={col.title}>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.label}>
                    {link.url ? (
                      <a href={link.url} target={link.url.startsWith("http") ? "_blank" : undefined} rel={link.url.startsWith("http") ? "noreferrer" : undefined} className="text-xs text-slate-400 hover:text-slate-300 transition-colors">{link.label}</a>
                    ) : (
                      <button onClick={link.action} className="text-xs text-slate-400 hover:text-slate-300 transition-colors text-left">{link.label}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} WINLAB. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6 flex-wrap items-center justify-center">
            <button onClick={() => handleLink("legal")} className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">Privacy</button>
            <button onClick={() => handleLink("legal")} className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">Terms</button>
            <button onClick={() => handleLink("legal")} className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">Cookie Policy</button>
            <a href="mailto:security@winlab.cloud" className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">Security</a>
            <a href="mailto:abuse@winlab.cloud" className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">Report Abuse</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Root export ───────────────────────────────────────────────────────────────
export default function LandingPage({ onStartLab, onNavigate }) {
  const [launchDeadline, setLaunchDeadline] = useState(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then(r => r.json())
      .then(d => {
        if (d.launchTierActive && d.launchExpiresAt) setLaunchDeadline(d.launchExpiresAt);
      })
      .catch(() => {});
  }, []);

  function handleCTA() {
    if (onStartLab) {
      onStartLab("linux-terminal");
    } else {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="bg-[#0a0a0b] text-white min-h-screen overflow-x-hidden">
      {/* Sticky countdown banner — sits above nav */}
      <CountdownBanner deadline={launchDeadline} />
      <Nav onCTA={handleCTA} hasBanner={!!launchDeadline} />
      <Hero onCTA={handleCTA} />
      <StatsBar />
      <LabsGrid onCTA={handleCTA} />
      <AIMentorSection />
      <EarlyAccessSignup deadline={launchDeadline} />
      <Pricing onCTA={handleCTA} />
      <CertSection />
      <Testimonials />
      <FinalCTA onCTA={handleCTA} />
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
