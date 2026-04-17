// IndiaHinglishLanding.jsx – India-focused Hinglish landing page
// Target: Indian IT/DevOps learners · Hinglish copy · ₹ pricing
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useLab } from "./LabContext";

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
function Nav({ onCTA }) {
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#0a0a0b]/90 backdrop-blur-md border-b border-slate-800/60" : ""
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500 font-black text-xl tracking-tight">WIN</span>
          <span className="text-white font-black text-xl tracking-tight">LAB</span>
          <span className="text-[10px] text-orange-400 border border-orange-700/40 px-1.5 py-0.5 rounded ml-1">🇮🇳</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#labs"    className="hover:text-white transition-colors">Labs</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#kaise"   className="hover:text-white transition-colors">Kaise Kaam Karta</a>
          <a href="#refer"   className="hover:text-white transition-colors">Refer & Earn</a>
        </div>
        <button
          onClick={onCTA}
          className="text-sm px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Free Lab Start Karo →
        </button>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ──────────────────────────────────────────────────────────────
function Hero({ onCTA }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/[0.08] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-orange-600/[0.05] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
        <motion.div {...fadeUp(0.1)} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-blue-600/30 bg-blue-600/10 text-blue-400 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Linux · Cloud · Network · Intune · Jamf · AI Mentor
        </motion.div>

        <motion.h1 {...fadeUp(0.2)} className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
          Build real IT & DevOps<br />
          <span className="text-blue-500">environments in minutes.</span>
        </motion.h1>

        <motion.p {...fadeUp(0.3)} className="text-lg md:text-xl text-slate-400 leading-relaxed mb-4 max-w-2xl mx-auto">
          No setup. No theory. <span className="text-white font-medium">Real labs with AI Mentor.</span>
        </motion.p>

        <motion.p {...fadeUp(0.35)} className="text-base text-slate-500 mb-10 max-w-xl mx-auto">
          Tutorials dekhna band karo. Ab real systems build karo — adaptive difficulty ke saath.
        </motion.p>

        <motion.div {...fadeUp(0.4)} className="flex flex-wrap justify-center gap-4">
          <button
            onClick={onCTA}
            className="relative group px-8 py-4 bg-blue-600 text-white font-bold rounded-xl text-sm overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute -inset-1 bg-blue-600/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            <span className="relative">🎯 Guided Lab Challenge (Free)</span>
          </button>

          <a
            href="#pricing"
            className="px-8 py-4 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold rounded-xl text-sm transition-all"
          >
            Pricing Dekho →
          </a>
        </motion.div>

        <motion.div {...fadeUp(0.5)} className="flex flex-wrap justify-center gap-6 mt-10 text-xs text-slate-600">
          <span>✓ Credit card nahi chahiye</span>
          <span>✓ Kabhi bhi cancel karo</span>
          <span>✓ AI-powered adaptive difficulty</span>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Problem Section ──────────────────────────────────────────────────────────
function ProblemSection() {
  return (
    <section className="py-24 bg-red-600/5">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <Reveal>
          <span className="text-xs text-red-400 uppercase tracking-widest">Problem</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-6">
            Zyadatar learners kabhi real infrastructure touch nahi karte.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Sirf tutorials dekhte ho. Videos dekhte ho. Notes banate ho.<br />
            <span className="text-red-400 font-semibold">Par kabhi actual servers build nahi karte.</span>
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { emoji: "📺", text: "Sirf video tutorials" },
              { emoji: "📝", text: "Theory-only learning" },
              { emoji: "🚫", text: "Zero hands-on practice" },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900/60 border border-red-600/20 rounded-xl p-6">
                <span className="text-3xl block mb-3">{item.emoji}</span>
                <p className="text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Solution Section ─────────────────────────────────────────────────────────
function SolutionSection({ onCTA }) {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <Reveal>
          <span className="text-xs text-green-400 uppercase tracking-widest">Solution</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-6">
            WinLab gives you real environments — instantly.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Browser mein directly. Koi setup nahi. Koi download nahi.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12">
            {[
              { icon: "🐧", title: "Linux Servers", desc: "Real SSH access" },
              { icon: "☁️", title: "Cloud Infrastructure", desc: "AWS/GCP labs" },
              { icon: "🌐", title: "Network Labs", desc: "Routing, switching, firewalls" },
              { icon: "🔐", title: "Intune MDM", desc: "Device management practice" },
              { icon: "📦", title: "Jamf Pro", desc: "macOS enterprise management" },
              { icon: "⚙️", title: "Automation", desc: "Ansible, Terraform, scripts" },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900/80 border border-green-600/20 rounded-xl p-5 hover:border-green-600/40 transition-all">
                <span className="text-2xl block mb-2">{item.icon}</span>
                <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.25}>
          <button
            onClick={onCTA}
            className="mt-10 px-8 py-3.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Start Your First Lab →
          </button>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Adaptive Difficulty Preview Section ─────────────────────────────────────
function AdaptiveDifficultyPreview({ onCTA }) {
  const [activeLevel, setActiveLevel] = useState(0);
  const [typedCommands, setTypedCommands] = useState([]);

  const levels = [
    {
      name: "EASY",
      color: "text-green-400",
      bg: "bg-green-600/20",
      border: "border-green-600/40",
      hint: "💡 Hint after 5s: 'Try systemctl status httpd'",
      latency: "600ms",
      description: "Beginner-friendly with guided hints",
      commands: ["systemctl status httpd", "systemctl start httpd"],
    },
    {
      name: "MEDIUM",
      color: "text-yellow-400",
      bg: "bg-yellow-600/20",
      border: "border-yellow-600/40",
      hint: "💡 Hint after 10s: 'Check disk usage'",
      latency: "800ms",
      description: "Balanced challenge with fewer hints",
      commands: ["df -h", "journalctl --vacuum-size=100M"],
    },
    {
      name: "HARD",
      color: "text-orange-400",
      bg: "bg-orange-600/20",
      border: "border-orange-600/40",
      hint: "💡 Hint after 15s: Single hint only",
      latency: "1000ms",
      description: "Expert-level with minimal guidance",
      commands: ["systemctl status firewalld", "systemctl start firewalld"],
    },
    {
      name: "EXPERT",
      color: "text-red-400",
      bg: "bg-red-600/20",
      border: "border-red-600/40",
      hint: "❌ No hints — solve it yourself",
      latency: "1200ms",
      description: "Zero hand-holding. Pure skill.",
      commands: ["diagnose", "fix", "verify"],
    },
  ];

  const currentLevel = levels[activeLevel];

  useEffect(() => {
    setTypedCommands([]);
    let i = 0;
    const interval = setInterval(() => {
      if (i < currentLevel.commands.length) {
        setTypedCommands(prev => [...prev, currentLevel.commands[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeLevel]);

  return (
    <section className="py-24 bg-gradient-to-b from-slate-900/50 to-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-purple-400 uppercase tracking-widest">Adaptive AI System</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              Difficulty tumhare skill ke hisaab se adjust hoti hai 🧠
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Jitna better perform karoge, utna challenging ho jaayega. AI real-time mein adapt karta hai.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Difficulty Selector */}
          <Reveal>
            <div className="space-y-3">
              {levels.map((level, i) => (
                <button
                  key={level.name}
                  onClick={() => setActiveLevel(i)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    activeLevel === i
                      ? `${level.bg} ${level.border} scale-[1.02]`
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-sm font-black ${level.color}`}>{level.name}</span>
                      <p className="text-xs text-slate-500 mt-1">{level.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600">Latency: {level.latency}</p>
                      <p className="text-[10px] text-slate-600">{level.hint.split(":")[0]}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Reveal>

          {/* Right: Mini Terminal Preview */}
          <Reveal delay={0.15}>
            <div className="bg-black rounded-lg overflow-hidden border border-slate-800 font-mono text-sm">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${currentLevel.color}`}>
                    🎯 Difficulty: {currentLevel.name}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    Lab 1 of 3
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700`}
                    style={{ width: `${(activeLevel / levels.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-4 min-h-[200px]">
                <div className="text-green-400 mb-2">
                  <div>Connecting to lab server...</div>
                  <div className="text-blue-400">Connected to oracle-linux-8.lab.local</div>
                  <div className="text-yellow-400 mt-2">⚠️  Apache is Down</div>
                  <div className="text-red-400 text-xs">Your server has a critical issue.</div>
                </div>

                {currentLevel.hint && (
                  <div className="text-slate-500 italic mt-2 text-xs">{currentLevel.hint}</div>
                )}

                <div className="mt-4 space-y-1">
                  {typedCommands.map((cmd, i) => (
                    <div key={i} className="text-white">
                      <span className="text-green-400">$</span> {cmd}
                    </div>
                  ))}
                  {typedCommands.length > 0 && (
                    <div className="text-emerald-300 font-bold text-xs mt-2">
                      🎉 Server fixed! +1 Skill Unlocked
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">$</span>
                  <span className="text-slate-600 animate-pulse">_</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="text-center mt-12">
            <button
              onClick={onCTA}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition-all hover:scale-[1.02]"
            >
              Try Adaptive Difficulty →
            </button>
            <p className="text-xs text-slate-600 mt-3">
              AI automatically adjusts based on your performance
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── AI Mentor Preview Section ────────────────────────────────────────────────
function AIMentorPreview({ onCTA }) {
  const [activeQuestion, setActiveQuestion] = useState(0);

  const questions = [
    {
      q: "ai help",
      a: "💡 AI Mentor: The web server is down. Try checking the service status first → systemctl status httpd",
    },
    {
      q: "ai how to check disk space?",
      a: "💡 AI Mentor: Use 'df -h' to see disk usage. If logs are consuming too much space, try 'journalctl --vacuum-size=100M'.",
    },
    {
      q: "ai firewall kaise enable karein?",
      a: "💡 AI Mentor: Firewalld check karo → 'systemctl status firewalld'. Enable karo → 'systemctl start firewalld'.",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveQuestion(prev => (prev + 1) % questions.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-blue-400 uppercase tracking-widest">AI-Powered</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              AI Mentor tumhe guide karega — bina answer directly diye 🤖
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Stuck ho? AI hint dega. Galti karoge? AI explain karega. Real learning, real growth.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="bg-slate-900/80 border border-blue-600/20 rounded-2xl p-6 max-w-2xl mx-auto">
            <div className="space-y-4">
              {questions.map((qa, i) => (
                <div
                  key={i}
                  className={`transition-all duration-500 ${
                    i === activeQuestion ? "opacity-100 scale-[1.02]" : "opacity-40 scale-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 font-mono text-sm shrink-0">$</span>
                    <span className="text-white font-mono text-sm">{qa.q}</span>
                  </div>
                  <div className="ml-6 mt-2 text-sm text-slate-400 bg-slate-800/60 rounded-lg p-3">
                    {qa.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="grid grid-cols-3 gap-6 mt-12 max-w-2xl mx-auto text-center">
            <div>
              <div className="text-2xl font-black text-blue-400">∞</div>
              <p className="text-xs text-slate-500 mt-1">AI Hints (Pro+)</p>
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">15s</div>
              <p className="text-xs text-slate-500 mt-1">Auto Nudge</p>
            </div>
            <div>
              <div className="text-2xl font-black text-purple-400">4</div>
              <p className="text-xs text-slate-500 mt-1">Difficulty Levels</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { num: "1", title: "Sign up (Free)", desc: "30 seconds mein account banao" },
    { num: "2", title: "Guided Lab Challenge", desc: "AI ke saath pehla lab solve karo" },
    { num: "3", title: "Adaptive difficulty", desc: "Jitna seekhoge, utna challenging hoga" },
    { num: "4", title: "Unlock skills", desc: "Real IT skills, real job readiness" },
  ];

  return (
    <section id="kaise" className="py-24 bg-slate-900/30">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-blue-400 uppercase tracking-widest">Kaise Kaam Karta Hai</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              4 steps. Bas.
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="relative flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-blue-600/20 border-2 border-blue-600/40 flex items-center justify-center text-xl font-black text-blue-400 mb-4">
                  {step.num}
                </div>
                <h4 className="text-sm font-bold text-white mb-2">{step.title}</h4>
                <p className="text-xs text-slate-500">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-full w-full h-px bg-gradient-to-r from-blue-600/30 to-transparent" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Value Loop ───────────────────────────────────────────────────────────────
function ValueLoop() {
  return (
    <section className="py-16">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-3 md:gap-6 bg-slate-900/80 border border-blue-600/20 rounded-2xl px-8 py-6">
            {["📚 Learn", "🔨 Build", "💪 Practice", "💼 Job-Ready"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 md:gap-6">
                <span className="text-sm md:text-base font-semibold text-white whitespace-nowrap">{item}</span>
                {i < 3 && <span className="text-blue-500 text-lg">→</span>}
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Yeh loop tumhe enterprise engineer banata hai.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing Table (India – ₹) ────────────────────────────────────────────────
const PLANS_IN = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "₹",
    label: "forever free",
    color: "border-slate-700",
    accent: "text-slate-300",
    bg: "",
    btnClass: "bg-slate-700 hover:bg-slate-600 text-white",
    highlight: false,
    features: [
      "✓ 5 Labs included",
      "✓ Linux Terminal access",
      "✓ Basic AI hints (3/day)",
      "✓ Progress tracking",
      "✗ Cloud & Network labs",
      "✗ Intune & Jamf access",
      "✗ Snapshot & rollback",
    ],
    cta: "Free Start Karo",
    ctaActive: true,
  },
  {
    id: "starter",
    name: "Starter",
    price: 199,
    currency: "₹",
    label: "/month",
    color: "border-blue-500",
    accent: "text-blue-400",
    bg: "bg-blue-600/5",
    btnClass: "bg-blue-600 hover:bg-blue-500 text-white",
    highlight: false,
    features: [
      "✓ 10+ Labs unlocked",
      "✓ Linux + Cloud basics",
      "✓ Beginner Intune access",
      "✓ Unlimited AI hints",
      "✓ Progress saved in cloud",
      "✗ All 24 labs",
      "✗ Snapshot & rollback",
    ],
    cta: "Start Learning →",
  },
  {
    id: "pro",
    name: "Pro",
    price: 999,
    currency: "₹",
    label: "/month",
    color: "border-orange-500",
    accent: "text-orange-400",
    bg: "bg-orange-600/5",
    btnClass: "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30",
    highlight: true,
    badge: "🔥 MOST POPULAR",
    features: [
      "✓ ALL 24 LABS UNLOCKED",
      "✓ Linux + Cloud + Network + Automation",
      "✓ Full Intune + Jamf access",
      "✓ Real enterprise scenarios",
      "✓ Snapshot & rollback",
      "✓ Unlimited AI Mentor hints",
      "✓ Certification of Excellence",
    ],
    cta: "Unlock Full Access 🔥",
  },
  {
    id: "elite",
    name: "Elite",
    price: 1499,
    currency: "₹",
    label: "/month",
    color: "border-red-500",
    accent: "text-red-400",
    bg: "bg-red-600/5",
    btnClass: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30",
    highlight: false,
    badge: "B2B / MSP",
    features: [
      "✓ Everything in Pro",
      "✓ Multi environments",
      "✓ API access",
      "✓ Advanced automation labs",
      "✓ Team / MSP mode",
      "✓ Bulk seat management",
      "✓ Priority support + SLA",
    ],
    cta: "Contact Sales →",
  },
];

function PricingSection({ onCTA, plan, token }) {
  // Map India plan IDs to LabContext plan values for correct comparison
  const planMap = { free: "starter", starter: "starter", pro: "pro", elite: "business" };

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-orange-400 uppercase tracking-widest">🇮🇳 India Pricing</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              Apne plan choose karo
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Free start karo. Jab ready ho, upgrade karo.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS_IN.map((p, i) => {
            const isCurrentPlan = planMap[p.id] === plan;
            return (
            <Reveal key={p.id} delay={i * 0.08}>
              <div
                className={`
                  relative flex flex-col rounded-2xl border p-7 h-full
                  ${p.highlight
                    ? `${p.bg} ${p.color} scale-[1.02] lg:scale-105 shadow-xl`
                    : `bg-slate-900/80 ${p.color}`}
                `}
              >
                {/* Badge */}
                {p.badge && (
                  <span className={`
                    absolute -top-3 left-1/2 -translate-x-1/2
                    text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap
                    ${p.highlight ? "bg-orange-600 text-white" : "bg-red-600 text-white"}
                  `}>
                    {p.badge}
                  </span>
                )}

                {/* Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <div className="flex items-end gap-1 mt-2">
                    <span className={`text-4xl font-black ${p.accent}`}>
                      {p.price === 0 ? "Free" : `${p.currency}${p.price}`}
                    </span>
                    {p.price > 0 && (
                      <span className="text-slate-500 text-sm mb-1">{p.label}</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-2.5 mb-8">
                  {p.features.map((f, fi) => (
                    <li
                      key={fi}
                      className={`text-sm ${f.startsWith("✓") ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => onCTA(p.id)}
                  disabled={isCurrentPlan && token}
                  className={`
                    w-full py-3 rounded-lg font-semibold text-sm transition-all
                    ${isCurrentPlan && token
                      ? "bg-slate-800 text-slate-500 cursor-default"
                      : p.btnClass}
                  `}
                >
                  {isCurrentPlan && token ? "Current plan ✓" : p.cta}
                </button>
              </div>
            </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="text-center text-slate-600 text-xs mt-8">
            Secure payments via Razorpay · Cancel anytime · No hidden fees
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Viral Loop / Referral Section ────────────────────────────────────────────
function ViralLoopSection() {
  return (
    <section id="refer" className="py-24 bg-green-600/5">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs text-green-400 uppercase tracking-widest">Refer & Earn</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
              Doston ko bhejo, free labs kamao 🎁
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Share karo. Clone karo. Earn karo.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          <Reveal delay={0}>
            <div className="bg-slate-900/80 border border-green-600/20 rounded-xl p-6 text-center">
              <span className="text-3xl block mb-3">🔗</span>
              <h4 className="text-sm font-bold text-white mb-2">Share Lab</h4>
              <p className="text-xs text-slate-500">
                Public link share karo — "Yeh lab dekh!"
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-slate-900/80 border border-blue-600/20 rounded-xl p-6 text-center">
              <span className="text-3xl block mb-3">📦</span>
              <h4 className="text-sm font-bold text-white mb-2">Clone Lab</h4>
              <p className="text-xs text-slate-500">
                Apna environment duplicate karo aur customize karo
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="bg-slate-900/80 border border-purple-600/20 rounded-xl p-6 text-center">
              <span className="text-3xl block mb-3">🎁</span>
              <h4 className="text-sm font-bold text-white mb-2">Invite Friends</h4>
              <div className="text-xs text-slate-400 space-y-1 mt-2">
                <p>1 friend = <span className="text-green-400 font-semibold">2 extra labs free</span></p>
                <p>3 friends = <span className="text-purple-400 font-semibold">7 days Pro free</span></p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-10 bg-slate-900 border border-yellow-600/20 rounded-xl p-5 text-center">
            <p className="text-sm text-yellow-400 font-semibold mb-1">💣 Viral Loop</p>
            <p className="text-xs text-slate-500 font-mono">
              User → Lab → Share → New User → Lab → Share → 🚀
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA({ onCTA }) {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-600/5 to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Tutorials dekhna band karo.<br />
            <span className="text-blue-500">Real infrastructure build karo.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Ready ho? Pehla lab free hai. Abhi start karo.
          </p>
          <button
            onClick={onCTA}
            className="relative group px-10 py-5 bg-blue-600 text-white font-bold rounded-xl text-base overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="absolute -inset-1 bg-blue-600/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
            <span className="relative">🚀 Free Lab Start Karo</span>
          </button>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-slate-800/60 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500 font-black text-lg tracking-tight">WIN</span>
          <span className="text-white font-black text-lg tracking-tight">LAB</span>
          <span className="text-slate-600 text-xs ml-2">© 2026</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-600">
          <span className="hover:text-slate-400 cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-slate-400 cursor-pointer transition-colors">Terms</span>
          <span className="hover:text-slate-400 cursor-pointer transition-colors">Contact</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function IndiaHinglishLanding({ onNavigate, onStartLab }) {
  const { plan, token, canAccessLab } = useLab();

  // Analytics tracking for landing page interactions
  useEffect(() => {
    const trackEvent = (eventName, data = {}) => {
      try {
        navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
          event: eventName,
          data: { ...data, page: "india_landing" },
          timestamp: new Date().toISOString(),
          sessionId: localStorage.getItem("winlab_session") || `anon_${Date.now()}`,
        }));
      } catch {
        // Analytics should never break UX
      }
    };

    // Track page view
    trackEvent("page_view", { region: "india" });
  }, []);

  function handlePricingCTA(planId) {
    // Track conversion attempt
    try {
      navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
        event: "landing_pricing_click",
        data: { planId, region: "india" },
        timestamp: new Date().toISOString(),
      }));
    } catch {}

    if (planId === "free") {
      onStartLab("enhanced-terminal"); // Route to enhanced terminal
      if (canAccessLab("enhanced-terminal")) onNavigate("lab");
    } else {
      // Paid plans: always go to PricingTable (handles login + checkout)
      onNavigate("pricing");
    }
  }

  function handleStartLab() {
    // Track lab start from landing
    try {
      navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
        event: "landing_lab_start",
        data: { labId: "enhanced-terminal", region: "india", source: "hero_cta" },
        timestamp: new Date().toISOString(),
      }));
    } catch {}

    onStartLab("enhanced-terminal"); // Route to enhanced terminal
    onNavigate("lab");
  }

  function handleSectionCTA(source) {
    // Track which section CTA was clicked
    try {
      navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
        event: "landing_section_cta",
        data: { source, region: "india" },
        timestamp: new Date().toISOString(),
      }));
    } catch {}

    handleStartLab();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <Nav onCTA={handleStartLab} />
      <Hero onCTA={handleStartLab} />
      <ProblemSection />
      <SolutionSection onCTA={handleStartLab} />
      <AdaptiveDifficultyPreview onCTA={() => handleSectionCTA("adaptive_difficulty")} />
      <AIMentorPreview />
      <HowItWorks />
      <ValueLoop />
      <PricingSection
        onCTA={handlePricingCTA}
        plan={plan}
        token={token}
      />
      <ViralLoopSection />
      <FinalCTA onCTA={handleStartLab} />
      <Footer />
    </div>
  );
}
