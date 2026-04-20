// LaunchLanding.jsx — Jobs-Dark redesign
// OLED black · JetBrains Mono · Terminal as hero · No emoji · No bouncy animations
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import TrialGate from "./components/TrialGate";
import { trackEvent, initPosthog } from "./services/posthog";

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ onLogin, onNavigate }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5">
      <span
        className="font-mono text-sm tracking-[0.3em] text-gray-500 uppercase cursor-pointer hover:text-white transition-colors duration-300"
        onClick={() => onNavigate?.("landing")}
      >
        WINLAB
      </span>
      <div className="flex items-center gap-8 font-mono text-xs tracking-widest text-gray-700 uppercase">
        <span className="cursor-pointer hover:text-gray-300 transition-colors duration-300" onClick={() => onNavigate?.("pricing")}>Pricing</span>
        <span className="cursor-pointer hover:text-gray-300 transition-colors duration-300" onClick={() => onNavigate?.("about")}>About</span>
        <span className="cursor-pointer hover:text-white transition-colors duration-300" onClick={onLogin}>Login</span>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onCTA, seatsClaimed, totalSeats }) {
  const remaining = totalSeats - seatsClaimed;

  return (
    <section className="min-h-screen flex flex-col justify-center px-8 md:px-16 pt-28 pb-16 max-w-5xl mx-auto">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-700 uppercase mb-10">
        // SYSTEM: TRAINING_ENVIRONMENT_v7
      </p>

      <h1 className="font-mono text-5xl md:text-7xl lg:text-8xl font-black text-white leading-none mb-6 tracking-tight">
        BECOME THE<br />
        <span className="text-[#FF3B30]">EXPERT.</span>
      </h1>

      <p className="font-mono text-sm md:text-base text-gray-600 mb-16 max-w-lg leading-relaxed">
        Real servers. No theory. Pure incidents.
      </p>

      {/* Terminal — the only lit thing in the dark */}
      <div className="bg-[#050505] border border-[#1a1a1a] p-6 font-mono text-sm max-w-2xl mb-16">
        <div className="text-gray-700 mb-5 text-[10px] tracking-widest uppercase">
          // LIVE INCIDENT — PRIORITY: CRITICAL
        </div>
        <div className="text-gray-500 mb-1">
          <span className="text-green-600">winlab@prod-db-01:~$</span>{" "}
          <span className="text-gray-300">systemctl status mysql</span>
        </div>
        <div className="text-gray-600 mt-3 ml-2">● mysql.service - MySQL Community Server</div>
        <div className="text-[#FF3B30] font-semibold ml-6">
          Active: failed (Result: exit-code)
        </div>
        <div className="mt-5 border-l-2 border-[#1a1a1a] pl-4 text-gray-700 text-xs leading-relaxed">
          # [SYSTEM_ADVISOR]: Database is unresponsive.<br />
          # Verify /var/log/mysql/error.log before escalating.
        </div>
        <div className="mt-5 text-gray-500">
          <span className="text-green-600">winlab@prod-db-01:~$</span>{" "}
          <span className="inline-block w-[7px] h-[14px] bg-[#00ff41] align-middle animate-pulse" />
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div
          className="font-mono text-xs tracking-[0.2em] text-black bg-white px-8 py-3 cursor-pointer hover:bg-gray-200 transition-colors duration-200 uppercase"
          onClick={onCTA}
        >
          [ JOIN THE FIRST 500 ]
        </div>
        <span className="font-mono text-[11px] text-gray-700">
          {remaining} seats remaining · Launch access: $5
        </span>
      </div>

      <p className="font-mono text-[10px] text-gray-800 mt-6 tracking-wider">
        The launch window closes Thursday, April 24.
      </p>
    </section>
  );
}

// ─── Labs grid ────────────────────────────────────────────────────────────────
const LABS = [
  { id: "ERR_702", title: "Kernel Panic Recovery",    severity: "CRITICAL", log: "kernel: BUG: unable to handle kernel NULL pointer dereference at 0000000000000010" },
  { id: "ERR_405", title: "Nginx Upstream Timeout",   severity: "HIGH",     log: "upstream timed out (110: Connection timed out) while reading response header from upstream" },
  { id: "ERR_109", title: "BGP Routing Leak",         severity: "HARDCORE", log: "BGP session with 10.0.0.1 went down — prefixes withdrawn from routing table" },
  { id: "ERR_501", title: "Apache2 Service Down",     severity: "CRITICAL", log: "AH00016: Configuration Failed — server unable to re-open errorlog, exiting" },
  { id: "ERR_334", title: "Disk Full — InnoDB Crash", severity: "HIGH",     log: "InnoDB: Operating system error number 28 in a file operation (No space left on device)" },
  { id: "ERR_218", title: "Memory Leak — OOM Killer", severity: "HIGH",     log: "Out of memory: Kill process 1842 (node) score 847 or sacrifice child" },
  { id: "ERR_677", title: "SSH Lockout Recovery",     severity: "MEDIUM",   log: "error: maximum authentication attempts exceeded for user root from 203.0.113.5" },
  { id: "ERR_091", title: "RAID Array Degraded",      severity: "CRITICAL", log: "md/raid1:md0: Disk failure on sdb, disabling device — write error corrected" },
  { id: "ERR_445", title: "Certificate Expired",      severity: "HIGH",     log: "SSL_ERROR_RX_RECORD_TOO_LONG — certificate expired 2026-04-01T00:00:00Z" },
];

const SEV = {
  CRITICAL: "text-[#FF3B30]",
  HIGH:     "text-orange-700",
  HARDCORE: "text-purple-700",
  MEDIUM:   "text-yellow-800",
};

function LabsGrid({ onStartLab }) {
  return (
    <section className="px-8 md:px-16 py-24 max-w-5xl mx-auto">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-700 uppercase mb-12">
        // INCIDENT_DATABASE — 100+ SCENARIOS INDEXED
      </p>
      <div className="border-[0.5px] border-[#151515]">
        <div className="grid grid-cols-12 border-b border-[#151515] px-6 py-3 font-mono text-[9px] text-gray-800 tracking-widest uppercase">
          <span className="col-span-2">ID</span>
          <span className="col-span-5">Incident</span>
          <span className="col-span-3">Severity</span>
          <span className="col-span-2 text-right">Access</span>
        </div>
        {LABS.map((lab) => (
          <div
            key={lab.id}
            className="grid grid-cols-12 border-b border-[#0d0d0d] px-6 py-5 font-mono cursor-pointer hover:bg-[#050505] transition-colors duration-200 group"
            onClick={onStartLab}
          >
            <span className="col-span-2 text-[10px] text-gray-700 self-center">{lab.id}</span>
            <div className="col-span-5 self-center">
              <div className="text-sm text-gray-400 group-hover:text-white transition-colors duration-200 mb-1">
                {lab.title}
              </div>
              <div className="text-[10px] text-gray-800 leading-relaxed truncate pr-4">{lab.log}</div>
            </div>
            <span className={`col-span-3 text-[9px] tracking-widest uppercase self-center ${SEV[lab.severity] || "text-gray-700"}`}>
              {lab.severity}
            </span>
            <span className="col-span-2 text-[10px] text-gray-800 group-hover:text-gray-500 tracking-widest uppercase text-right self-center transition-colors duration-200">
              Enter →
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
const SPECS = [
  ["Active Labs",   "100+",                     "100+"],
  ["Environment",   "Linux · Bash · CLI",        "Full Infrastructure Track"],
  ["AI Support",    "Mentor Standard",           "Mentor Enterprise"],
  ["Dashboard",     "Individual",                "Team + Analytics"],
  ["SSO",           "—",                         "Azure AD / Okta"],
  ["Price",         "$19 / mo",                  "$199 / mo"],
];

function Pricing({ onCTA }) {
  return (
    <section className="px-8 md:px-16 py-24 max-w-5xl mx-auto">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-700 uppercase mb-12">
        // PRICING — SPECIFICATION_SHEET
      </p>
      <div className="border-[0.5px] border-[#151515] font-mono">
        <div className="grid grid-cols-3 border-b border-[#151515] px-6 py-3 text-[9px] text-gray-800 tracking-widest uppercase">
          <span>Feature</span>
          <span>Individual</span>
          <span>Business</span>
        </div>
        {SPECS.map(([feat, ind, biz], i) => (
          <div
            key={i}
            className={`grid grid-cols-3 px-6 py-4 text-xs border-b border-[#0a0a0a] ${feat === "Price" ? "text-white" : "text-gray-600"}`}
          >
            <span className="text-gray-800 uppercase tracking-wider text-[9px]">{feat}</span>
            <span>{ind}</span>
            <span>{biz}</span>
          </div>
        ))}
        <div className="grid grid-cols-3 px-6 py-6 gap-4">
          <span />
          <div
            className="text-[10px] tracking-widest uppercase text-black bg-white px-5 py-2 cursor-pointer hover:bg-gray-200 transition-colors duration-200 w-fit"
            onClick={onCTA}
          >
            [ ENTER THE LAB ]
          </div>
          <div
            className="text-[10px] tracking-widest uppercase border border-[#222] text-gray-600 px-5 py-2 cursor-pointer hover:border-gray-500 hover:text-white transition-colors duration-200 w-fit"
            onClick={onCTA}
          >
            [ PROVISION TEAM ]
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Rule line ────────────────────────────────────────────────────────────────
function Rule({ text }) {
  return (
    <div className="px-8 md:px-16 max-w-5xl mx-auto">
      <div className="border-t border-[#0f0f0f] pt-3 font-mono text-[9px] text-gray-900 tracking-[0.3em] uppercase">
        {text}
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ onNavigate }) {
  return (
    <footer className="px-8 md:px-16 py-16 max-w-5xl mx-auto">
      <div className="border-t border-[#0f0f0f] pt-12 flex flex-col md:flex-row justify-between items-start gap-6 font-mono text-[9px] text-gray-800 tracking-[0.3em] uppercase">
        <span>WINLAB © 2026</span>
        <div className="flex gap-8">
          <span className="cursor-pointer hover:text-gray-500 transition-colors" onClick={() => onNavigate?.("pricing")}>Pricing</span>
          <span className="cursor-pointer hover:text-gray-500 transition-colors" onClick={() => onNavigate?.("about")}>About</span>
          <span className="cursor-pointer hover:text-gray-500 transition-colors" onClick={() => onNavigate?.("legal")}>Legal</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function LaunchLanding({ onCTA, onLogin, onNavigate, onStartLab }) {
  const [seatsClaimed, setSeatsClaimed] = useState(347);
  const totalSeats = 500;
  const [trialOpen, setTrialOpen] = useState(false);

  useEffect(() => {
    initPosthog();
    trackEvent("launch_landing_viewed");
    fetch("/api/early-access/seats")
      .then((r) => r.json())
      .then((data) => setSeatsClaimed(data.claimedSeats || 347))
      .catch(() => {});
  }, []);

  const handleCTA = () => {
    if (onCTA) onCTA();
    else window.location.href = "/api/checkout";
  };

  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden">
      <Nav onLogin={onLogin} onNavigate={onNavigate} />

      <Hero onCTA={handleCTA} seatsClaimed={seatsClaimed} totalSeats={totalSeats} />

      <Rule text="// no videos. no theory. no cloud bills. just you and the terminal." />

      <LabsGrid onStartLab={() => setTrialOpen(true)} />

      <Rule text="// pricing" />

      <Pricing onCTA={handleCTA} />

      <Footer onNavigate={onNavigate} />

      <AnimatePresence>
        {trialOpen && (
          <TrialGate
            onSignup={() => { setTrialOpen(false); handleCTA(); }}
            onClose={() => setTrialOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
