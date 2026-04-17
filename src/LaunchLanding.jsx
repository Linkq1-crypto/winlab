// LaunchLanding.jsx - 72H launch landing page with countdown, terminal demo, and aggressive CTA
import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import TerminalDemo from "./components/TerminalDemo";
import PressureMode from "./components/PressureMode";
import { trackEvent, initPosthog } from "./services/posthog";
import { saveDemoProgress } from "./utils/demoProgress";

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

// ─── Sticky countdown banner ──────────────────────────────────────────────────
function CountdownBanner({ deadline }) {
  const left = useCountdown(deadline);
  if (!left || left.expired) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-gradient-to-r from-red-700 via-red-600 to-red-700 border-b border-red-500/40 shadow-lg shadow-red-900/40">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span className="text-xs font-bold text-red-100 uppercase tracking-wider whitespace-nowrap">
          🔥 72H Launch — $5 offer ends in
        </span>
        <div className="flex items-center gap-1">
          {left.d > 0 && (
            <>
              <span className="text-white font-black text-sm tabular-nums">{left.d}d</span>
              <span className="text-red-300 mx-0.5">:</span>
            </>
          )}
          <span className="text-white font-black text-sm tabular-nums">
            <Pad n={left.h} />
          </span>
          <span className="text-red-300 mx-0.5">:</span>
          <span className="text-white font-black text-sm tabular-nums">
            <Pad n={left.m} />
          </span>
          <span className="text-red-300 mx-0.5">:</span>
          <span className="text-white font-black text-sm tabular-nums">
            <Pad n={left.s} />
          </span>
        </div>
        <a
          href="#cta"
          className="text-xs font-bold bg-white text-red-700 px-3 py-1 rounded-full hover:bg-red-50 transition-colors whitespace-nowrap"
        >
          Lock $5 →
        </a>
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ hasBanner }) {
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
          <span className="text-green-500 font-black text-xl tracking-tight">WIN</span>
          <span className="text-white font-black text-xl tracking-tight">LAB</span>
          <span className="text-[10px] text-red-400 border border-red-700 px-1.5 py-0.5 rounded ml-1">
            72H
          </span>
        </div>
        <a
          href="#terminal"
          className="text-sm px-4 py-2.5 min-h-[44px] bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
        >
          Try Demo →
        </a>
      </div>
    </motion.nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onCTA, seatsClaimed, totalSeats }) {
  const claimedPct = Math.round((seatsClaimed / totalSeats) * 100);

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-green-600/[0.08] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-green-800/[0.06] rounded-full blur-3xl" />
      </div>

      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-red-600/30 bg-red-600/10 text-red-400 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            ⚠️ Only {totalSeats - seatsClaimed} spots remaining
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] mb-6"
          >
            Break real servers.
            <br />
            <span className="text-green-500">Become job-ready.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-slate-400 leading-relaxed mb-6 max-w-lg"
          >
            Train on real sysadmin incidents with an AI mentor. No videos. No theory. Just real
            problems.
          </motion.p>

          {/* Countdown card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <LaunchCountdownCard />
          </motion.div>

          {/* Scarcity bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">
                <span className="text-white font-bold">{seatsClaimed}</span> / {totalSeats} seats
                claimed
              </span>
              <span className="text-red-400 font-bold">{claimedPct}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-orange-600 rounded-full transition-all duration-1000"
                style={{ width: `${claimedPct}%` }}
              />
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col gap-4"
          >
            <button
              onClick={onCTA}
              className="relative group px-8 py-5 bg-green-600 text-white font-bold rounded-xl text-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute inset-0 bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute -inset-1 bg-green-600/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              <span className="relative">Start your first lab → $5</span>
            </button>

            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              <span>✓ Instant access</span>
              <span>✓ AI mentor included</span>
              <span>✓ Cancel anytime</span>
            </div>
          </motion.div>
        </div>

        {/* Terminal preview */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <TerminalPreview />
        </motion.div>
      </div>
    </section>
  );
}

// ─── Launch countdown card ────────────────────────────────────────────────────
function LaunchCountdownCard() {
  // Launch ends April 20, 2026 at 18:00 (Monday)
  const deadline = "2026-04-20T18:00:00";
  const left = useCountdown(deadline);

  if (!left || left.expired) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
        <p className="text-sm font-bold text-red-400">Launch period has ended.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
      <p className="text-center text-xs font-bold text-orange-400 uppercase tracking-widest mb-3">
        Launch offer ends in
      </p>
      <div className="flex items-center justify-center gap-3">
        <TimeBlock value={left.d} label="days" />
        {left.d > 0 && <span className="text-2xl font-black text-slate-600 mb-3">:</span>}
        <TimeBlock value={left.h} label="hours" />
        <span className="text-2xl font-black text-slate-600 mb-3">:</span>
        <TimeBlock value={left.m} label="min" />
        <span className="text-2xl font-black text-slate-600 mb-3">:</span>
        <TimeBlock value={left.s} label="sec" />
      </div>
    </div>
  );
}

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

// ─── Terminal preview (static hero visual) ────────────────────────────────────
function TerminalPreview() {
  return (
    <div className="rounded-xl border border-green-500/30 bg-[#050505] overflow-hidden shadow-2xl shadow-green-500/10">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20 bg-[#050505]">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-3 text-xs text-green-400/60 font-mono">
          winlab@prod-server:~ — Incident #001
        </span>
      </div>
      <div className="p-5 font-mono text-sm leading-6 min-h-[320px] text-green-400">
        <div className="text-white">winlab@prod-server:~$</div>
        <div className="text-white mt-2">{"> "}systemctl status ldap</div>
        <div className="text-red-400 mt-2">
          ● ldap.service - LDAP Authentication
          <br />
          &nbsp;&nbsp;&nbsp;Active: ❌ failed (Result: exit-code)
        </div>
        <div className="text-blue-300 mt-3">
          🤖 AI Mentor: Check the logs. What error do you see?
        </div>
        <div className="text-white mt-3">
          winlab@prod-server:~$
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-2 h-4 bg-green-400 ml-1 align-middle"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Interactive Terminal Demo Section ────────────────────────────────────────
function TerminalDemoSection({ onCTA }) {
  const [demoStep, setDemoStep] = useState(0);

  const handleStepComplete = (event) => {
    trackEvent(event, { step: demoStep });
  };

  const handleRun = (step) => {
    setDemoStep(step);
    saveDemoProgress(step);
    trackEvent("terminal_run", { step });

    if (step >= 6) {
      trackEvent("terminal_demo_completed");
    }
  };

  return (
    <section id="terminal" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-600/3 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs text-green-400 uppercase tracking-widest">Try It Now</span>
          <h2 className="text-4xl font-black text-white mt-3 mb-4">
            Break a real system. Right now.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            This isn't a video. Run commands, see real errors, get AI guidance. Experience what
            WINLAB feels like.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <TerminalDemo onRun={handleRun} onStepComplete={handleStepComplete} />

          {/* Pressure mode */}
          <div className="mt-8">
            <PressureMode
              initialTime={90}
              onComplete={() => trackEvent("pressure_mode_completed")}
            />
          </div>

          {/* CTA after demo */}
          <div className="mt-10 text-center">
            <p className="text-slate-300 mb-4">
              You just experienced a real incident.
              <br />
              <span className="text-green-400 font-semibold">Now train for real → $5</span>
            </p>
            <button
              onClick={onCTA}
              className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-green-600/20"
            >
              Start your first lab → $5
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    icon: "🖥️",
    title: "Break a real system",
    desc: "Production servers, failed services, broken configs — all simulated realistically.",
  },
  {
    icon: "🔍",
    title: "Debug under pressure",
    desc: "Timer active, users reporting issues. Feel what real incident response is like.",
  },
  {
    icon: "🤖",
    title: "Get guided by AI",
    desc: "AI Mentor reads your lab state and asks targeted questions. Never gives the answer.",
  },
  {
    icon: "💪",
    title: "Become job-ready",
    desc: "After 10+ incidents, you'll have real troubleshooting skills. Not just theory.",
  },
];

function HowItWorks() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs text-green-400 uppercase tracking-widest">How It Works</span>
          <h2 className="text-4xl font-black text-white mt-3 mb-4">
            From zero to job-ready in 72 hours
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-xl bg-green-600/10 border border-green-600/20 flex items-center justify-center text-3xl mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Urgency section ──────────────────────────────────────────────────────────
function UrgencySection() {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-orange-600/10 to-red-600/10 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative">
        <div className="rounded-2xl border border-red-600/30 bg-slate-900/80 backdrop-blur-sm p-8 sm:p-10">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-bold text-red-400 uppercase tracking-widest bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20 mb-3">
              🚨 Limited Launch Offer
            </span>
            <h2 className="text-3xl font-black text-white mb-4">
              Launch price disappears in 72h
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: "⏱️", text: "Only 72 hours available" },
              { icon: "👥", text: "Only 500 early users" },
              { icon: "💰", text: "Next price: $29/month" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg"
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm text-red-300 font-medium">{item.text}</p>
              </div>
            ))}
          </div>

          <div id="cta" className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              Start your first lab now → $5
            </h3>
            <p className="text-slate-400 mb-6">
              Offer ends Monday. No second chance.
            </p>
            <StripeCTA />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stripe CTA ───────────────────────────────────────────────────────────────
function StripeCTA() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    trackEvent("cta_clicked");

    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        trackEvent("checkout_started");
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full sm:w-auto px-10 py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-green-600/20"
      >
        {loading ? "Redirecting to Stripe..." : "Start your first lab → $5"}
      </button>
      <p className="text-xs text-slate-500 mt-3">
        Secure checkout via Stripe · SSL encrypted · Cancel anytime
      </p>
    </div>
  );
}

// ─── Final CTA banner ─────────────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="relative rounded-2xl border border-green-600/20 bg-green-600/5 px-6 py-10 sm:p-14 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-600/10 via-transparent to-transparent pointer-events-none" />
          <h2 className="text-4xl font-black text-white mb-5 relative">
            Start breaking things.
            <br />
            Start learning for real.
          </h2>
          <p className="text-slate-300 mb-8 relative">
            Launch offer: $5 for your first month (then $29).
            <br />
            Only available for 72 hours.
          </p>
          <button
            onClick={onCTA}
            className="relative px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-green-600/20"
          >
            Start your first lab → $5
          </button>
          <p className="text-xs text-slate-400 mt-4 relative">
            Launch offer ends Monday · No second chance
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-slate-800 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} WINLAB. All rights reserved.</p>
          <div className="flex gap-4 sm:gap-6 flex-wrap items-center justify-center">
            <a href="/privacy" className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">
              Privacy
            </a>
            <a href="/terms" className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">
              Terms
            </a>
            <a href="mailto:support@winlab.cloud" className="hover:text-slate-300 transition-colors px-3 py-2 min-h-[44px]">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function LaunchLanding({ onCTA }) {
  const [seatsClaimed, setSeatsClaimed] = useState(347);
  const totalSeats = 500;

  // Initialize PostHog
  useEffect(() => {
    initPosthog();
    trackEvent("launch_landing_viewed");

    // Fetch seat count
    fetch("/api/early-access/seats")
      .then((r) => r.json())
      .then((data) => setSeatsClaimed(data.claimedSeats || 347))
      .catch(() => {});
  }, []);

  const handleCTA = () => {
    if (onCTA) {
      onCTA();
    } else {
      // Default: redirect to Stripe checkout
      window.location.href = "/api/checkout";
    }
  };

  // Launch deadline: April 20, 2026 at 18:00
  const deadline = "2026-04-20T18:00:00";

  return (
    <div className="bg-[#0a0a0b] text-white min-h-screen overflow-x-hidden">
      <CountdownBanner deadline={deadline} />
      <Nav hasBanner />
      <Hero onCTA={handleCTA} seatsClaimed={seatsClaimed} totalSeats={totalSeats} />
      <TerminalDemoSection onCTA={handleCTA} />
      <HowItWorks />
      <UrgencySection />
      <FinalCTA onCTA={handleCTA} />
      <Footer />
    </div>
  );
}
