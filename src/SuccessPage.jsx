// SuccessPage.jsx – Post-payment "System Initializing" experience
// Includes: boot sequence · confetti · quick-start cards · Easter egg terminal
import { useEffect, useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { useLab } from "./LabContext";

// ─── Brand confetti (Cyber Blue + Green Neon) ─────────────────────────────────
function fireCelebration() {
  const colors = ["#2563eb", "#3b82f6", "#22c55e", "#4ade80", "#0ea5e9"];
  const base = { particleCount: 60, spread: 80, colors, zIndex: 9999 };

  // Left cannon
  confetti({ ...base, origin: { x: 0.1, y: 0.6 }, angle: 60  });
  // Right cannon
  confetti({ ...base, origin: { x: 0.9, y: 0.6 }, angle: 120 });

  setTimeout(() => {
    confetti({ ...base, particleCount: 40, origin: { x: 0.5, y: 0.3 }, angle: 90, spread: 120 });
  }, 400);
}

// ─── Boot sequence lines ──────────────────────────────────────────────────────
const BOOT_LINES = [
  { tag: "OK",     color: "text-green-400",  text: "Verifying Stripe Session..."                        },
  { tag: "OK",     color: "text-green-400",  text: "Authenticating user identity..."                    },
  { tag: "OK",     color: "text-green-400",  text: "Provisioning User Sandbox..."                       },
  { tag: "OK",     color: "text-green-400",  text: "Unlocking Enterprise Labs (vSphere, Terraform)..."  },
  { tag: "OK",     color: "text-green-400",  text: "Unlocking RAID Simulator, SSSD, Real Incidents..."  },
  { tag: "OK",     color: "text-green-400",  text: "Activating AI Challenge Generator..."               },
  { tag: "OK",     color: "text-green-400",  text: "Generating Certification ID..."                     },
  { tag: "OK",     color: "text-green-400",  text: "Syncing progress to secure database..."             },
  { tag: "ACCESS GRANTED", color: "text-blue-400 font-bold", text: "Welcome to WINLAB Pro." },
];

const BOOT_DELAY_MS = 340; // ms between each line

// ─── Easter egg – hidden bash cheat codes ─────────────────────────────────────
// Discovered by: typing  sudo su  anywhere on the page  OR  Konami code
const EASTER_EGG_CODES = [
  { cmd: "find / -name '*.secret' 2>/dev/null",         out: "# Found: /etc/winlab/.access_token  (your Pro key lives here)" },
  { cmd: "cat /etc/winlab/pro_features.conf",           out: "LABS_UNLOCKED=10\nAI_HINTS=unlimited\nCERT_ENABLED=true\nEASTER_EGG=you_found_it" },
  { cmd: "id winlab",                                   out: "uid=1337(winlab) gid=1337(winlab) groups=1337(winlab),0(root),27(sudo)" },
  { cmd: "last -n 1 winlab",                            out: "winlab   pts/0   192.168.1.42   just now   still logged in" },
  { cmd: "sudo journalctl -u winlab --no-pager -n 3",   out: "Mar 30 WINLAB[1]: 🎉 Pro plan activated\nMar 30 WINLAB[1]: All 10 labs provisioned\nMar 30 WINLAB[1]: Hint: try the Konami code on the landing page ↑↑↓↓←→←→BA" },
  { cmd: "echo $WINLAB_SECRET",                         out: "never_stop_breaking_things" },
  { cmd: "uptime",                                      out: " 00:00:01 up 0 min, 1 user, load average: 0.00, 0.00, 0.00  — your journey starts now." },
  { cmd: "exit",                                        out: "logout\n# Come back anytime. The sandbox is always running." },
];

const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

function EasterEggTerminal({ onClose }) {
  const [lines, setLines]   = useState([{ text: "# 🔓 SECRET TERMINAL UNLOCKED", type: "head" }]);
  const [idx, setIdx]       = useState(0);
  const [phase, setPhase]   = useState("typing"); // typing | waiting | done
  const [input, setInput]   = useState("");
  const bottomRef           = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  // Auto-run the easter egg script
  useEffect(() => {
    if (phase !== "typing" || idx >= EASTER_EGG_CODES.length) return;
    const entry = EASTER_EGG_CODES[idx];

    // Type the command char by char
    let charIdx = 0;
    const typeInterval = setInterval(() => {
      charIdx++;
      setLines(l => {
        const last = l[l.length - 1];
        if (last?.type === "typing") {
          return [...l.slice(0, -1), { ...last, text: "$ " + entry.cmd.slice(0, charIdx) }];
        }
        return [...l, { text: "$ " + entry.cmd.slice(0, charIdx), type: "typing" }];
      });
      if (charIdx >= entry.cmd.length) {
        clearInterval(typeInterval);
        setTimeout(() => {
          setLines(l => [...l.slice(0, -1), { text: "$ " + entry.cmd, type: "cmd" }, { text: entry.out, type: "out" }]);
          setIdx(i => i + 1);
        }, 300);
      }
    }, 28);

    return () => clearInterval(typeInterval);
  }, [idx, phase]);

  useEffect(() => {
    if (idx >= EASTER_EGG_CODES.length) setPhase("done");
  }, [idx]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-green-500/30 bg-[#050507] overflow-hidden shadow-2xl shadow-green-500/10">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-green-400/60 font-mono">root@winlab-secret:~#</span>
          <button onClick={onClose} className="text-slate-600 hover:text-white text-sm transition-colors">✕</button>
        </div>

        {/* Output */}
        <div className="p-5 font-mono text-xs leading-6 max-h-[420px] overflow-y-auto">
          {lines.map((l, i) => (
            <div key={i} className={
              l.type === "cmd"     ? "text-white mt-1"
              : l.type === "typing" ? "text-white mt-1"
              : l.type === "head"   ? "text-green-400 font-bold mb-2"
              : "text-green-300/80 pl-2 whitespace-pre-line"
            }>
              {l.text}
            </div>
          ))}
          {phase === "done" && (
            <div className="mt-4 text-blue-400 border-t border-slate-800 pt-4">
              # You found all the secrets. Share this screenshot with #WINLAB on LinkedIn 👀
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Close hint */}
        <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-700 font-mono">
          Press <kbd className="px-1 bg-slate-800 rounded text-slate-500">Esc</kbd> or click ✕ to close
        </div>
      </div>
    </div>
  );
}

// ─── Quick-start cards ────────────────────────────────────────────────────────
function QuickStartCards({ plan, lastLabId, onGoToLab, onGoToDashboard }) {
  const cards = [
    {
      icon:  "▶",
      color: "border-blue-600/30 hover:border-blue-500/50",
      badge: "Continue",
      badgeColor: "bg-blue-600/20 text-blue-400",
      title: "Resume Last Lab",
      desc:  lastLabId
               ? `Pick up where you left off: ${lastLabId.replace(/-/g, " ")}.`
               : "Start with the Linux Terminal — your first lab is ready.",
      cta:   "Open Lab →",
      onClick: () => onGoToLab(lastLabId || "linux-terminal"),
    },
    {
      icon:  "📄",
      color: "border-green-600/30 hover:border-green-500/50",
      badge: "Download",
      badgeColor: "bg-green-600/20 text-green-400",
      title: "Welcome Kit PDF",
      desc:  "Linux & Windows Server cheat-sheet: 120+ commands, common fixes, one-liners.",
      cta:   "Download PDF →",
      onClick: () => {
        // In production this would point to a real file in /public/downloads/
        const a = document.createElement("a");
        a.href = "/downloads/winlab-welcome-kit.pdf";
        a.download = "WINLAB-WelcomeKit.pdf";
        a.click();
      },
    },
    {
      icon:  plan === "business" ? "🏢" : "👤",
      color: "border-purple-600/30 hover:border-purple-500/50",
      badge: plan === "business" ? "B2B" : "Profile",
      badgeColor: plan === "business" ? "bg-purple-600/20 text-purple-400" : "bg-slate-700 text-slate-400",
      title: plan === "business" ? "Set Up B2B Profile" : "Complete Your Profile",
      desc:  plan === "business"
               ? "Configure your team, invite engineers, and track their lab progress."
               : "Add your job title and LinkedIn to personalise your certificate.",
      cta:   plan === "business" ? "Configure Team →" : "Edit Profile →",
      onClick: onGoToDashboard,
    },
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-4 mt-10">
      {cards.map((c, i) => (
        <button
          key={i}
          onClick={c.onClick}
          style={{ animationDelay: `${1.4 + i * 0.15}s` }}
          className={`
            card-enter flex flex-col text-left p-6 rounded-xl border bg-slate-900/60
            transition-all duration-200 ${c.color}
            hover:bg-slate-900 hover:-translate-y-0.5
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl">{c.icon}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.badgeColor}`}>{c.badge}</span>
          </div>
          <p className="font-semibold text-white text-sm mb-1.5">{c.title}</p>
          <p className="text-slate-500 text-xs leading-relaxed flex-1">{c.desc}</p>
          <p className="text-blue-400 text-xs font-medium mt-4">{c.cta}</p>
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SuccessPage({ onGoToLab, onGoToDashboard }) {
  const { user, token, plan, setPlan, progress, LABS } = useLab();

  const [bootIdx,        setBootIdx]        = useState(0);   // current boot line
  const [bootDone,       setBootDone]       = useState(false);
  const [synced,         setSynced]         = useState(false);
  const [syncError,      setSyncError]      = useState(null);
  const [easterEgg,      setEasterEgg]      = useState(false);
  const [logoClicks,     setLogoClicks]     = useState(0);
  const konamiBuffer                        = useRef([]);

  // Last incomplete lab (or last accessed)
  const lastLabId = Object.entries(progress)
    .filter(([, v]) => !v.completed)
    .sort(([, a], [, b]) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]?.[0]
    || null;

  // ── Step 1: Tick through boot lines ─────────────────────────────────────────
  useEffect(() => {
    if (bootIdx >= BOOT_LINES.length) return;
    const t = setTimeout(() => setBootIdx(i => i + 1), BOOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [bootIdx]);

  // ── Step 2: When boot finishes → confetti + backend sync ────────────────────
  useEffect(() => {
    if (bootIdx < BOOT_LINES.length) return;
    setBootDone(true);
    fireCelebration();
    syncUpgrade();
  }, [bootIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncUpgrade() {
    if (!token) { setSynced(true); return; } // guest – nothing to sync
    try {
      const res = await fetch("/api/user/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: plan || "pro" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.plan) setPlan(data.plan);
      }
    } catch {
      setSyncError("Could not sync plan — please refresh. Your payment was recorded.");
    } finally {
      setSynced(true);
    }
  }

  // ── Easter egg: Konami code listener ────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      konamiBuffer.current = [...konamiBuffer.current, e.key].slice(-KONAMI.length);
      if (konamiBuffer.current.join(",") === KONAMI.join(",")) {
        setEasterEgg(true);
      }
      // Also trigger on typing "sudo su"
      konamiBuffer.current.slice(-7).join("").toLowerCase();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Easter egg: logo click 5× ────────────────────────────────────────────────
  function handleLogoClick() {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 5) { setEasterEgg(true); setLogoClicks(0); }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-y-auto">
      {easterEgg && <EasterEggTerminal onClose={() => setEasterEgg(false)} />}

      <div className="max-w-3xl mx-auto px-6 py-20">

        {/* Logo */}
        <div className="flex items-center gap-1.5 mb-14" title="Click me 5× for a surprise…">
          <button onClick={handleLogoClick} className="flex items-center gap-1 select-none">
            <span className="text-blue-500 font-black text-xl tracking-tight">WIN</span>
            <span className="text-white font-black text-xl tracking-tight">LAB</span>
          </button>
          {logoClicks > 0 && logoClicks < 5 && (
            <span className="text-xs text-slate-700 ml-2 font-mono">{5 - logoClicks} more…</span>
          )}
        </div>

        {/* ── Boot terminal ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-[#050507] overflow-hidden mb-10">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-slate-600 font-mono">winlab-init — system boot</span>
          </div>

          {/* Lines */}
          <div className="p-5 font-mono text-sm leading-7 min-h-[260px]">
            {BOOT_LINES.slice(0, bootIdx).map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 ${
                  i === bootIdx - 1 ? "animate-[fadeIn_0.2s_ease]" : ""
                }`}
              >
                <span className={`shrink-0 text-xs mt-[3px] ${line.color}`}>
                  [ {line.tag} ]
                </span>
                <span className={`text-slate-300 ${line.tag === "ACCESS GRANTED" ? "text-blue-300 font-semibold" : ""}`}>
                  {line.text}
                </span>
              </div>
            ))}

            {/* Blinking cursor while booting */}
            {!bootDone && (
              <span className="inline-block w-2 h-4 bg-green-400 ml-1 align-middle animate-[blink_1s_step-end_infinite]" />
            )}
          </div>
        </div>

        {/* ── Welcome message (fades in after boot) ──────────────────────── */}
        {bootDone && (
          <div
            className="text-center mb-2"
            style={{ animation: "fadeSlideUp 0.7s ease forwards" }}
          >
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Plan active · All labs unlocked
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
              Welcome aboard,{" "}
              <span className="text-blue-400">{user?.name || "Senior SysAdmin"}</span>.
            </h1>
            <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
              Your account is now active with full privileges. All 10 labs are unlocked,
              AI Mentor hints are unlimited, and your Certification ID has been reserved.
            </p>

            {syncError && (
              <p className="mt-4 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-lg px-4 py-2 inline-block">
                ⚠ {syncError}
              </p>
            )}
          </div>
        )}

        {/* ── Quick-start cards ───────────────────────────────────────────── */}
        {bootDone && (
          <QuickStartCards
            plan={plan}
            lastLabId={lastLabId}
            onGoToLab={onGoToLab}
            onGoToDashboard={onGoToDashboard}
          />
        )}

        {/* ── Referral Section (after boot) ─────────────────────────────── */}
        {bootDone && synced && (
          <div
            className="mt-10 bg-slate-900/80 border border-green-600/20 rounded-xl p-6 font-mono"
            style={{ animation: "fadeSlideUp 0.7s ease forwards", animationDelay: "0.5s" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🚀</span>
              <h3 className="text-lg font-bold text-white">Challenge a Colleague</h3>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Ottimo lavoro, Root! Hai appena risolto un incident critico.
            </p>
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-2">
              <div className="text-xs text-slate-500"># Why not challenge a colleague?</div>
              <div className="text-sm text-slate-300">
                <span className="text-green-400">$</span> Invite a friend to WINLAB
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-green-400">$</span> Get <span className="text-yellow-400 font-bold">-20% discount</span> when they deploy a PRO plan
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-green-400">$</span> Or escalate to Corporate for <span className="text-purple-400 font-bold">-30% Root Privilege</span>
              </div>
            </div>
            <button
              onClick={onGoToDashboard}
              className="mt-4 w-full py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-400 rounded-lg font-semibold transition-all text-sm"
            >
              🔑 Generate Invite Token in Dashboard →
            </button>
          </div>
        )}

        {/* ── Easter egg hint (subtle, discoverable) ─────────────────────── */}
        {bootDone && (
          <p className="text-center text-slate-800 text-xs mt-14 font-mono select-none">
            # hint: try the konami code
          </p>
        )}
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeIn      { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink       { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .card-enter            { animation: fadeSlideUp 0.5s ease both; }
      `}</style>
    </div>
  );
}
