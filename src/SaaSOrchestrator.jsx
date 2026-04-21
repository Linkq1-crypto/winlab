// SaaSOrchestrator.jsx – Core shell: routing, lazy loading, paywall gate
import { Suspense, lazy, useState, useEffect, Component } from "react";
import { useLab, CAREER_PATHS, getNextLab } from "./LabContext";
import PricingTable from "./PricingTable";
import AIMentor from "./AIMentor";
import CertificationSystem from "./CertificationSystem";
import CertPublicPage from "./CertPublicPage";
import EarlyAccessSuccess from "./EarlyAccessSuccess";
import LandingPage from "./LandingPage";
import SuccessPage from "./SuccessPage";
import CommunityHub from "./CommunityHub";
import LegalLayout from "./LegalLayout";
import AboutPage from "./AboutPage";
import AuthPage from "./AuthPage";
import AdminPage from "./AdminPage";
import CookieBanner from "./CookieBanner";
import OnboardingFlow from "./OnboardingFlow";
import ReferralSystem from "./ReferralSystem";
import IndiaHinglishLanding from "./IndiaHinglishLanding";
import WinLabHome from "./WinLabHome";
import PrivacyPolicy from "./PrivacyPolicy";
import OnboardingPage from "./OnboardingPage";
import FirstMission from "./FirstMission";
import LaunchLanding from "./LaunchLanding";
import AISettings from "./AISettings";
import ProgressToastManager from "./ProgressToast";
import CircuitBreakerBanner from "./components/CircuitBreakerBanner";
import ProfilePage from "./ProfilePage";
import TelemetryDashboard from "./TelemetryDashboard";
import MyRootHub from "./MyRootHub";
import HelpdeskDashboard from "./HelpdeskDashboard";
import MspDashboard from "./components/MspDashboard";
import SocialSidebar from "./SocialSidebar";
import { useSocialStorage } from "./hooks/useSocialStorage";
import FakeTerminal from "./FakeTerminal";
import ResetPasswordPage from "./ResetPasswordPage";

// ── Lazy simulators (one chunk per lab) ───────────────────────────────────────
// Defined at MODULE level so React always gets the same stable reference.
const LinuxTerminal    = lazy(() => import("../linux-terminal-sim"));
const RaidSimulator    = lazy(() => import("../raid-simulator"));
const OsInstall        = lazy(() => import("../os-install-raid"));
const VsphereSimulator = lazy(() => import("../vsphere-simulator"));
const SssdLdap         = lazy(() => import("../sysadmin-sssd-users-gone"));
const RealServer       = lazy(() => import("../linux-real-server-sim"));
const AdvancedScenarios= lazy(() => import("../sysadmin-6-scenari"));
const AIChallenges     = lazy(() => import("./AIChallengeSimulator"));
const NetworkLab       = lazy(() => import("./NetworkLabSimulator"));
const SecurityAudit    = lazy(() => import("./SecurityAuditSimulator"));
// New labs from lab.txt
const IntuneMDM        = lazy(() => import("./components/IntuneMDM"));
const JamfPro          = lazy(() => import("./components/JamfPro"));
const CompNetworkLab   = lazy(() => import("./components/NetworkLab"));
const CompSecurityAudit= lazy(() => import("./components/SecurityAudit"));
const EnterpriseArch   = lazy(() => import("./components/EnterpriseArch"));
const AutomationLab    = lazy(() => import("./components/AutomationLab"));
const CloudInfra       = lazy(() => import("./components/CloudInfra"));
const EnhancedTerminal = lazy(() => import("./EnhancedTerminalLab"));

const SIMULATORS = {
  "linux-terminal":     LinuxTerminal,
  "enhanced-terminal":  EnhancedTerminal,
  "raid-simulator":     RaidSimulator,
  "os-install":         OsInstall,
  "vsphere":            VsphereSimulator,
  "sssd-ldap":          SssdLdap,
  "real-server":        RealServer,
  "advanced-scenarios": AdvancedScenarios,
  "ai-challenges":      AIChallenges,
  "network-lab":        NetworkLab,
  "security-audit":     SecurityAudit,
  // New labs
  "intune-mdm":         IntuneMDM,
  "jamf-pro":           JamfPro,
  "enterprise-arch":    EnterpriseArch,
  "automation":         AutomationLab,
  "cloud-infrastructure": CloudInfra,
  "msp-multi-tenant":   MspDashboard,
};

// Stable wrapper: component type never changes, only labId prop changes.
// This prevents React from unmounting/remounting on every lab switch.
function LabRenderer({ labId }) {
  const Sim = SIMULATORS[labId];
  if (!Sim) return <p className="text-slate-500 p-8">Lab "{labId}" not found.</p>;
  return <Sim />;
}

// ── Error boundary (catches simulator crashes) ────────────────────────────────
class LabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-white font-semibold">Lab failed to load</p>
          <p className="text-slate-500 text-sm max-w-sm">{String(this.state.error)}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LabSkeleton() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading lab…</p>
      </div>
    </div>
  );
}

// ── Locked lab screen ─────────────────────────────────────────────────────────
function LockedLab({ lab, onUpgrade }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
      <span className="text-5xl">🔒</span>
      <div>
        <h2 className="text-xl font-bold text-white mb-2">{lab?.name}</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          This lab requires the{" "}
          <span className={lab?.tier === "business" ? "text-purple-400 font-semibold" : "text-blue-400 font-semibold"}>
            {lab?.tier === "business" ? "Business" : "Pro"} plan
          </span>.
        </p>
      </div>
      <button
        onClick={onUpgrade}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
      >
        Upgrade to unlock →
      </button>
    </div>
  );
}

// ── Global progress bar (always visible) ─────────────────────────────────────
function ProgressBar({ count }) {
  const pct = Math.round((count / 10) * 100);
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-[#1a1a1a] shrink-0">
      <span className="font-mono text-[9px] text-gray-700 uppercase tracking-widest shrink-0">Progress</span>
      <div className="flex-1 h-px bg-[#1a1a1a] relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gray-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[9px] text-gray-700 shrink-0">{pct}%</span>
    </div>
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Navigate to ${label}`}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left min-h-[40px] font-mono text-[10px] tracking-widest uppercase transition-colors duration-150
        ${active ? "text-white bg-[#111]" : "text-gray-600 hover:text-gray-300 hover:bg-[#0d0d0d]"}`}
    >
      <span className="shrink-0 text-[8px] text-gray-700">{active ? "▸" : " "}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Sidebar lab item ──────────────────────────────────────────────────────────
function LabItem({ lab, active, completed, locked, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={`${lab.name} lab - ${lab.tier}${locked ? " (locked)" : ""}${completed ? " (completed)" : ""}`}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 min-h-[44px]
        ${active   ? "bg-[#111] border-l border-white text-white"
                   : "text-gray-600 hover:text-gray-300 hover:bg-[#0d0d0d] border-l border-transparent"}
        ${locked   ? "opacity-40" : ""}`}
    >
      <span className="text-sm leading-none shrink-0" aria-hidden="true">{lab.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] tracking-wide truncate">{lab.name}</p>
        <p className={`font-mono text-[8px] mt-0.5 tracking-widest uppercase ${
          lab.tier === "starter" ? "text-gray-700"
          : lab.tier === "pro"   ? "text-gray-600"
                                  : "text-gray-600"
        }`}>
          {lab.tier === "starter" ? "Free" : lab.tier === "pro" ? "Pro" : "Business"}
          {locked ? " · locked" : ""}
        </p>
      </div>
      {completed && <span className="font-mono text-[10px] text-gray-500 shrink-0" aria-label="Completed">✓</span>}
    </button>
  );
}

// ── Dashboard home ────────────────────────────────────────────────────────────
const PLAN_RANK = { starter: 0, earlyAccess: 1, pro: 1, business: 2 };

function Dashboard({ labs, progress, plan, onOpenLab, onUpgrade, onReferral, onManageBilling, achievements = [] }) {
  const completedCount = Object.values(progress).filter(l => l.completed).length;
  const planRank = PLAN_RANK[plan] ?? 0;
  const hasBilling = plan === "pro" || plan === "business" || plan === "earlyAccess";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-700 uppercase mb-6">
        // SYSTEM_DASHBOARD
      </p>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-mono text-xl text-white tracking-tight">Dashboard</h1>
          <p className="font-mono text-xs text-gray-600 mt-1">Il tuo percorso sysadmin.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasBilling && (
            <button
              onClick={onManageBilling}
              className="font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-gray-300 border border-[#222] hover:border-[#444] px-3 py-2 transition-colors"
            >
              [ Manage Plan ]
            </button>
          )}
          {achievements.length > 0 && (
            <span className="font-mono text-[9px] tracking-widest uppercase text-gray-600 border border-[#222] px-2 py-1">
              {achievements.length} badge{achievements.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="border border-[#222] font-mono mb-10">
        <div className="grid grid-cols-3 border-b border-[#1a1a1a] px-5 py-2 text-[9px] text-gray-700 uppercase tracking-widest">
          <span>Labs</span>
          <span>Plan</span>
          <span>Status</span>
        </div>
        <div className="grid grid-cols-3 px-5 py-4">
          <span className="text-white text-sm">{completedCount}<span className="text-gray-600">/{labs.length}</span></span>
          <span className="text-white text-sm capitalize">{plan === "earlyAccess" ? "Early Access" : plan}</span>
          <span className={`text-sm ${completedCount >= 10 ? "text-green-500" : "text-gray-500"}`}>
            {completedCount >= 10 ? "Certified" : "In progress"}
          </span>
        </div>
      </div>

      {/* Career Paths */}
      <p className="font-mono text-[9px] text-gray-700 uppercase tracking-[0.4em] mb-4">// Career Paths</p>
      <div className="space-y-2 mb-10">
        {CAREER_PATHS.map(path => {
          const pathRank = PLAN_RANK[path.requiredPlan] ?? 0;
          const canAccess = planRank >= pathRank;
          const completedInPath = path.labs.filter(id => progress[id]?.completed).length;
          const total = path.labs.length;
          const pct = Math.round((completedInPath / total) * 100);
          const done = completedInPath === total;
          const nextLabId = getNextLab(path.id, progress);
          const nextLab = labs.find(l => l.id === nextLabId);

          return (
            <div
              key={path.id}
              className={`border border-[#222] p-5 transition-colors ${!canAccess ? "opacity-50" : "hover:border-[#333]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <p className="font-mono text-sm text-white">{path.title}</p>
                    <span className="font-mono text-[9px] tracking-widest uppercase text-gray-600 border border-[#333] px-2 py-0.5">
                      {path.subtitle}
                    </span>
                    {!canAccess && (
                      <span className="font-mono text-[9px] tracking-widest uppercase text-gray-700 border border-[#222] px-2 py-0.5 capitalize">
                        {path.requiredPlan} required
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-gray-600 mb-3">{path.description}</p>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-[#1a1a1a] relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-gray-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-[9px] text-gray-700 shrink-0">{completedInPath}/{total}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {path.labs.map(labId => {
                      const lab = labs.find(l => l.id === labId);
                      const isDone = progress[labId]?.completed;
                      return (
                        <span
                          key={labId}
                          className={`font-mono text-[9px] px-2 py-0.5 border tracking-wide ${
                            isDone ? "border-[#333] text-gray-400" : "border-[#1a1a1a] text-gray-700"
                          }`}
                        >
                          {isDone ? "✓ " : ""}{lab?.name || labId}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0">
                  {done ? (
                    <span className="font-mono text-[10px] text-gray-500 tracking-widest">DONE</span>
                  ) : canAccess && nextLab ? (
                    <button
                      onClick={() => onOpenLab(nextLab.id)}
                      className="font-mono text-[10px] tracking-widest uppercase text-white border border-[#333] hover:border-[#555] px-3 py-2 transition-colors whitespace-nowrap"
                    >
                      Continue →
                    </button>
                  ) : !canAccess ? (
                    <button
                      onClick={onUpgrade}
                      className="font-mono text-[10px] tracking-widest uppercase text-white bg-white/10 hover:bg-white/15 border border-[#333] px-3 py-2 transition-colors whitespace-nowrap"
                    >
                      Upgrade ↑
                    </button>
                  ) : null}
                </div>
              </div>

              {done && (
                <p className="font-mono text-[10px] text-gray-600 mt-4 pt-4 border-t border-[#1a1a1a] italic">
                  "{path.outcome}"
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Referral */}
      <div className="mb-10 border border-[#222] p-5 font-mono">
        <div className="text-[9px] text-gray-700 uppercase tracking-[0.4em] mb-4">// REFERRAL_SYSTEM</div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">
              <span className="text-green-500">▸ </span>Invite a peer — get <span className="text-white">-20%</span> on renewal
            </div>
            <div className="text-xs text-gray-400">
              <span className="text-green-500">▸ </span>Corporate referral — get <span className="text-white">-30%</span> Root Privilege
            </div>
          </div>
          <button
            onClick={onReferral}
            className="text-[10px] tracking-widest uppercase text-black bg-white hover:bg-gray-200 px-4 py-2 transition-colors whitespace-nowrap"
          >
            [ Generate Token ]
          </button>
        </div>
      </div>

      {/* Lab grid */}
      <p className="font-mono text-[9px] text-gray-700 uppercase tracking-[0.4em] mb-4">// ALL_LABS</p>
      <div className="border border-[#1a1a1a]">
        <div className="grid grid-cols-12 border-b border-[#1a1a1a] px-4 py-2 font-mono text-[9px] text-gray-700 uppercase tracking-widest">
          <span className="col-span-6">Lab</span>
          <span className="col-span-3">Tier</span>
          <span className="col-span-3 text-right">Status</span>
        </div>
        {labs.map(lab => {
          const canAccess = planRank >= (PLAN_RANK[lab.tier] ?? 0);
          const done = progress[lab.id]?.completed;
          return (
            <button
              key={lab.id}
              onClick={() => canAccess ? onOpenLab(lab.id) : onUpgrade()}
              className={`w-full grid grid-cols-12 px-4 py-3 border-b border-[#111] font-mono text-left transition-colors hover:bg-[#050505] group
                ${!canAccess ? "opacity-40" : ""}`}
            >
              <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                <span className="text-sm shrink-0">{lab.icon}</span>
                <span className="text-xs text-gray-300 group-hover:text-white transition-colors truncate">{lab.name}</span>
              </div>
              <span className="col-span-3 font-mono text-[9px] text-gray-600 uppercase tracking-wider self-center">
                {lab.tier === "starter" ? "Free" : lab.tier === "pro" ? "Pro" : "Business"}
              </span>
              <span className={`col-span-3 font-mono text-[10px] text-right self-center ${done ? "text-gray-400" : "text-gray-700"}`}>
                {done ? "✓ done" : canAccess ? "Enter →" : "locked"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="mt-10">
          <p className="font-mono text-[9px] text-gray-700 uppercase tracking-[0.4em] mb-4">// ACHIEVEMENTS</p>
          <div className="border border-[#1a1a1a]">
            {achievements.map((a, i) => (
              <div key={a.id} className={`flex items-center gap-4 px-5 py-3 font-mono ${i < achievements.length - 1 ? "border-b border-[#111]" : ""}`}>
                <span className="text-xl shrink-0">{a.icon}</span>
                <div>
                  <p className="text-xs text-white">{a.label}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paywall modal (overlay, does NOT replace app shell) ───────────────────────
function PaywallModal({ completedCount, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-black border border-[#222] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center font-mono text-gray-600 hover:text-white transition-colors border border-[#222] hover:border-[#444]"
        >
          ✕
        </button>
        <p className="font-mono text-center text-gray-500 text-xs mb-6 tracking-widest uppercase">
          {completedCount > 0
            ? `You've completed ${completedCount} lab${completedCount !== 1 ? "s" : ""}. Unlock everything to continue.`
            : "Unlock all 10 labs and unlimited AI hints."}
        </p>
        <PricingTable onClose={onClose} onNeedLogin={() => { setPaywallOpen(false); setAuthMode("login"); setView("auth"); }} />
      </div>
    </div>
  );
}

// Scenario → lab mapping for demo mode
const DEMO_SCENARIO_LABS = {
  apache:  RealServer,
  disk:    RealServer,
  selinux: RealServer,
  cpu:     RealServer,
  ssh:     RealServer,
};

const DEMO_SCENARIO_LABELS = {
  apache:  "🔴 Apache down",
  disk:    "💾 Disk full",
  selinux: "🔒 SELinux denial",
  cpu:     "🔥 CPU at 100%",
  ssh:     "🚫 SSH refused",
};

// ── Demo shell — public preview, no auth ──────────────────────────────────────
export function DemoShell() {
  const [showCTA, setShowCTA] = useState(false);

  const params   = new URLSearchParams(window.location.search);
  const scenario = params.get("scenario");
  const LabComponent = DEMO_SCENARIO_LABS[scenario] || LinuxTerminal;
  const labLabel = scenario
    ? (DEMO_SCENARIO_LABELS[scenario] || scenario)
    : "Lab 01 — Linux Terminal";

  useEffect(() => {
    const t = setTimeout(() => setShowCTA(true), 120_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width:"100%", height:"100vh", background:"#0a0a0a", display:"flex", flexDirection:"column", fontFamily:"Inter,sans-serif" }}>
      {/* Minimal header */}
      <div style={{ background:"#111", borderBottom:"1px solid #1f2937", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <span style={{ color:"#22c55e", fontWeight:900, fontSize:16, letterSpacing:"-0.5px" }}>
          WIN<span style={{color:"#fff"}}>LAB</span>
        </span>
        <span style={{ color:"#6b7280", fontSize:12 }}>
          {labLabel}
        </span>
        <a
          href="/#cta"
          style={{ background:"#22c55e", color:"#000", padding:"6px 14px", borderRadius:6, fontSize:12, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap" }}
        >
          Lock your seat $5/mo →
        </a>
      </div>

      {/* Lab */}
      <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
        <Suspense fallback={<LabSkeleton />}>
          <LabErrorBoundary>
            <LabComponent scenario={scenario} />
          </LabErrorBoundary>
        </Suspense>

        {/* CTA overlay — fades in after timeout */}
        {showCTA && (
          <div style={{
            position:"absolute", bottom:0, left:0, right:0,
            background:"linear-gradient(transparent, rgba(10,10,10,.97) 35%)",
            padding:"80px 24px 32px", display:"flex", flexDirection:"column",
            alignItems:"center", gap:10, zIndex:50,
          }}>
            <p style={{ color:"#f3f4f6", fontWeight:800, fontSize:18, margin:0 }}>Enjoying the lab?</p>
            <p style={{ color:"#6b7280", fontSize:14, margin:0 }}>All 24 labs · AI Mentor · Certificates · $5/mo locked forever.</p>
            <a
              href="/#cta"
              style={{ background:"#22c55e", color:"#000", padding:"13px 36px", borderRadius:8, fontWeight:800, fontSize:15, textDecoration:"none", marginTop:4 }}
            >
              Start for $5/mo →
            </a>
            <button
              onClick={() => setShowCTA(false)}
              style={{ background:"none", border:"none", color:"#374151", fontSize:12, cursor:"pointer", marginTop:2 }}
            >
              keep exploring
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export default function SaaSOrchestrator() {
  const {
    user, token, plan, progress, completedCount, allCompleted,
    canAccessLab, LABS: labs, activeLabState, logout, login, achievements,
  } = useLab();

  // Social links (global)
  const [socialLinks] = useSocialStorage();

  // Detect mobile on init
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" && window.innerWidth < 768;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Auto-detect region and set default landing ────────────────────────────────
  // Users from India get the Hinglish landing page automatically
  const [isIndia, setIsIndia] = useState(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Mumbai")) return true;
    } catch {}
    try {
      const lang = (navigator.language || navigator.languages?.[0] || "").toLowerCase();
      if (lang.includes("in") || lang.includes("hi")) return true;
    } catch {}
    return false;
  });

  // "landing" | "dashboard" | "lab" | "pricing" | "cert" | "success" | "community" | "about" | "legal" | "auth" | "india" | "deception"
  const [view,          setView]          = useState(isIndia ? "india" : "landing");
  const [activeLabId,   setActiveLabId]   = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= 768 : true;
  });
  const [paywallOpen,   setPaywallOpen]   = useState(false);
  const [aboutTab,      setAboutTab]      = useState("about");
  const [authMode,      setAuthMode]      = useState("login");
  const [pendingAction, setPendingAction] = useState(null); // callback after login
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Detect ?upgraded=1 from Stripe redirect
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
      setView("success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Detect /cert/:certId — public certificate verification page
  const [publicCertId, setPublicCertId] = useState(() => {
    if (typeof window === "undefined") return null;
    const m = window.location.pathname.match(/^\/cert\/(.+)$/);
    return m ? m[1] : null;
  });

  // Detect /early-access/success — magic login after Stripe payment
  const [isEarlyAccessSuccess, setIsEarlyAccessSuccess] = useState(() => {
    return typeof window !== "undefined" &&
      window.location.pathname === "/early-access/success";
  });

  // Detect /onboarding — post-Stripe onboarding flow
  const [isOnboarding, setIsOnboarding] = useState(() => {
    return typeof window !== "undefined" &&
      window.location.pathname === "/onboarding";
  });

  // Detect /first-mission or /lab/first-mission — immediate real experience
  const [isFirstMission, setIsFirstMission] = useState(() => {
    return typeof window !== "undefined" &&
      (window.location.pathname === "/first-mission" ||
       window.location.pathname === "/lab/first-mission");
  });

  // Detect /launch — 72h launch landing page
  const [isLaunchLanding, setIsLaunchLanding] = useState(() => {
    return typeof window !== "undefined" &&
      (window.location.pathname === "/launch" ||
       window.location.pathname === "/72h" ||
       window.location.search.includes("launch=1"));
  });

  // Launch tier: true during first 72h, false after → controls which landing to show
  const [launchTierActive, setLaunchTierActive] = useState(true); // optimistic: show launch page until API responds
  useEffect(() => {
    fetch("/api/pricing")
      .then(r => r.json())
      .then(d => setLaunchTierActive(!!d.launchTierActive))
      .catch(() => setLaunchTierActive(false));
  }, []);

  // ── Stripe Customer Portal ───────────────────────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false);
  async function handleManageBilling() {
    if (!token) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error("Portal error", e);
    } finally {
      setPortalLoading(false);
    }
  }

  // Detect hidden admin route: /myrooting
  const [isMyRootRoute, setIsMyRootRoute] = useState(() => {
    return typeof window !== "undefined" && window.location.pathname.startsWith("/myrooting");
  });
  // Detect specific dashboard routes
  const getMyRootPath = () => {
    if (typeof window === "undefined") return "";
    return window.location.pathname.startsWith("/myrooting") ? window.location.pathname : "";
  };
  const [myRootPath, setMyRootPath] = useState(getMyRootPath);
  const [isHoneypot, setIsHoneypot] = useState(() => {
    return typeof window !== "undefined" && window.location.pathname === "/dash_board";
  });
  const [isProfileRoute, setIsProfileRoute] = useState(() => {
    return typeof window !== "undefined" && window.location.pathname === "/profile";
  });

  useEffect(() => {
    const handlePop = () => {
      setIsMyRootRoute(window.location.pathname.startsWith("/myrooting"));
      setMyRootPath(getMyRootPath());
      setIsHoneypot(window.location.pathname === "/dash_board");
      const onProfile = window.location.pathname === "/profile";
      setIsProfileRoute(onProfile);
      if (onProfile) setView("profile");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // ── Keyboard navigation (accessibility) ───────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      // Alt+1-9: Navigate to different sections
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const shortcuts = {
          "1": "landing",
          "2": "dashboard",
          "3": "pricing",
          "4": "cert",
          "5": "referral",
          "6": "community",
          ...(isIndia ? { "7": "india" } : {}),
          "8": "deception",
        };
        if (shortcuts[e.key]) {
          e.preventDefault();
          navigate(shortcuts[e.key]);
        }
        // Alt+S: Toggle sidebar
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          setSidebarOpen(o => !o);
        }
      }
      
      // Escape: Close paywall/modal
      if (e.key === "Escape") {
        if (paywallOpen) {
          e.preventDefault();
          setPaywallOpen(false);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paywallOpen]);

  function openLab(labId) {
    if (!canAccessLab(labId)) {
      setPaywallOpen(true);
      return;
    }
    setActiveLabId(labId);
    setView("lab");
    // Auto-close sidebar on mobile
    if (isMobile) setSidebarOpen(false);
  }

  function navigate(v) {
    setView(v);
    if (v !== "lab") setActiveLabId(null);
    if (v === "profile") {
      window.history.pushState({}, "", "/profile");
      setIsProfileRoute(true);
    } else if (isProfileRoute) {
      window.history.pushState({}, "", "/");
      setIsProfileRoute(false);
    }
  }

  function requireAuth(action) {
    if (plan === "starter" && !token) {
      setAuthMode("login");
      setPendingAction(() => action);
      setView("auth");
    } else {
      action();
    }
  }

  // ── Full-page views (no app shell) ────────────────────────────────────────

  // Password reset: /reset-password?token=xxx
  if (typeof window !== "undefined" && window.location.pathname === "/reset-password") {
    return (
      <ResetPasswordPage
        onDone={() => {
          window.history.replaceState({}, "", "/");
          setAuthMode("login");
          setView("auth");
        }}
      />
    );
  }

  // Public certificate page: /cert/:certId
  if (publicCertId) {
    return <CertPublicPage certId={publicCertId} />;
  }

  // Early access success / magic login: /early-access/success?session_id=...
  if (isEarlyAccessSuccess) {
    return <EarlyAccessSuccess onDone={(token, user) => {
      login(token, user);
      window.history.replaceState({}, "", "/");
      setIsEarlyAccessSuccess(false);
      setView("dashboard");
    }} />;
  }

  // Onboarding flow: /onboarding (after Stripe payment)
  if (isOnboarding) {
    return <OnboardingPage onDone={() => {
      window.location.href = "/first-mission";
    }} />;
  }

  // First mission: /first-mission or /lab/first-mission
  if (isFirstMission) {
    return <FirstMission />;
  }

  // Launch landing page: /launch or /72h or ?launch=1 — same as default home
  if (isLaunchLanding) {
    return (
      <LaunchLanding
        onCTA={() => token ? (openLab("linux-terminal") || navigate("lab")) : navigate("auth")}
        onLogin={() => navigate("auth")}
        onNavigate={(section) => {
          if (section === "pricing")    navigate("pricing");
          else if (section === "about") navigate("about");
          else if (section === "india") navigate("india");
          else if (section === "dashboard") navigate("dashboard");
          else navigate("landing");
        }}
        onStartLab={(labId) => {
          if (token) { openLab(labId || "linux-terminal"); navigate("lab"); }
          else navigate("auth");
        }}
      />
    );
  }

  // Honeypot: fake admin dashboard at /dash_board
  if (isHoneypot) {
    return <FakeTerminal />;
  }

  // Direct URL: /profile
  if (isProfileRoute || view === "profile") {
    return (
      <ProfilePage
        onBack={() => navigate("dashboard")}
        onNavigate={(section) => navigate(section)}
      />
    );
  }

  // MyRoot dashboards
  if (isMyRootRoute) {
    // Route to specific dashboard or show hub
    if (myRootPath === "/myrooting" || myRootPath === "/myrooting/") {
      return <MyRootHub />;
    }
    if (myRootPath === "/myrooting/telemetry") {
      return <TelemetryDashboard />;
    }
    if (myRootPath === "/myrooting/helpdesk") {
      return <HelpdeskDashboard />;
    }
    if (myRootPath === "/myrooting/deception") {
      return (
        <DeceptionDashboard
          onBack={() => { window.location.href = "/myrooting"; }}
          token={token}
        />
      );
    }
    if (myRootPath === "/myrooting/msp") {
      return <MspDashboard />;
    }
    // Fallback to hub for unknown sub-routes
    return <MyRootHub />;
  }

  if (view === "landing") {
    return (
      <LaunchLanding
        onCTA={() => token ? (openLab("linux-terminal") || navigate("lab")) : navigate("auth")}
        onLogin={() => navigate("auth")}
        onNavigate={(section) => {
          if (section === "pricing")    navigate("pricing");
          else if (section === "about") navigate("about");
          else if (section === "india") navigate("india");
          else if (section === "dashboard") navigate("dashboard");
          else navigate("landing");
        }}
        onStartLab={(labId) => {
          if (token) { openLab(labId || "linux-terminal"); navigate("lab"); }
          else navigate("auth");
        }}
      />
    );
  }

  if (view === "india") {
    return (
      <IndiaHinglishLanding
        onNavigate={(section) => {
          if (section === "lab") { openLab("linux-terminal"); if (canAccessLab("linux-terminal")) setView("lab"); }
          else if (section === "pricing") navigate("pricing");
          else if (section === "dashboard") navigate("dashboard");
          else navigate("landing");
        }}
        onStartLab={(labId) => { openLab(labId); }}
      />
    );
  }

  if (view === "deception") {
    return (
      <DeceptionDashboard
        onBack={() => navigate("dashboard")}
        token={token}
      />
    );
  }

  if (view === "privacy") {
    return <PrivacyPolicy language={isIndia ? "hi" : "en"} />;
  }

  if (view === "aisettings") {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white">
        <div className="max-w-3xl mx-auto p-6">
          <button onClick={() => navigate("dashboard")} className="mb-6 text-sm text-slate-400 hover:text-white transition-colors">
            ← Back to Dashboard
          </button>
          <AISettings language={isIndia ? "hi" : "en"} token={token} />
        </div>
      </div>
    );
  }

  if (view === "auth") {
    return (
      <AuthPage
        onBack={() => navigate("landing")}
        initialMode={authMode}
        onLoginSuccess={(tkn, userData) => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
          // Show onboarding for new users (no completed labs)
          if (completedCount === 0) {
            setShowOnboarding(true);
            navigate("dashboard");
          } else {
            navigate("dashboard");
          }
        }}
      />
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={(labId) => {
          setShowOnboarding(false);
          openLab(labId);
          if (canAccessLab(labId)) setView("lab");
          else setView("dashboard");
        }}
      />
    );
  }

  if (view === "success") {
    return (
      <SuccessPage
        onGoToLab={labId => { openLab(labId); }}
        onGoToDashboard={() => navigate("dashboard")}
      />
    );
  }

  if (view === "community") {
    return (
      <CommunityHub
        onBack={() => navigate("dashboard")}
        onLogin={() => { setAuthMode("login"); setView("auth"); }}
        token={typeof window !== "undefined" ? localStorage.getItem("winlab_token") : null}
        isAdmin={plan === "business"}
      />
    );
  }

  if (view === "referral") {
    return (
      <div className="min-h-screen bg-[#0a0a0b] p-8">
        <button
          onClick={() => navigate("dashboard")}
          className="mb-6 text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← Back to Dashboard
        </button>
        <ReferralSystem />
      </div>
    );
  }

  if (view === "about") {
    return <AboutPage key={aboutTab} onBack={() => navigate("dashboard")} initialTab={aboutTab} onNeedLogin={() => { setAuthMode("login"); setView("auth"); }} />;
  }

  if (view === "legal") {
    return <LegalLayout onBack={() => navigate("dashboard")} />;
  }

  // ── App shell ─────────────────────────────────────────────────────────────
  const activeLab = labs.find(l => l.id === activeLabId);

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#000", color: "#fff" }}>

      {/* Social Sidebar — floating right side bar */}
      <SocialSidebar links={socialLinks} />

      {/* GDPR Cookie Consent */}
      <CookieBanner />

      {/* Circuit Breaker Banner — mostrato se il backend è irraggiungibile */}
      <CircuitBreakerBanner />

      {/* Progress & Achievement Toasts */}
      <ProgressToastManager />

      {/* Paywall overlay (on top of app shell, doesn't replace it) */}
      {paywallOpen && (
        <PaywallModal
          completedCount={completedCount}
          onClose={() => setPaywallOpen(false)}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside
          style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
                   borderRight: "1px solid #1a1a1a", overflow: "hidden", background: "#000" }}
          className={`
            ${isMobile ? "fixed inset-y-0 left-0 z-50 shadow-2xl" : "relative"}
          `}
          role="navigation"
          aria-label="Main navigation"
        >

          {/* Logo */}
          <div className="px-4 py-5 border-b border-[#1a1a1a]">
            <p className="font-mono text-sm tracking-[0.3em] text-white uppercase">WINLAB</p>
            <p className="font-mono text-[9px] text-gray-700 mt-1 tracking-widest uppercase">// Sysadmin Training</p>
          </div>

          {/* Top nav */}
          <nav className="p-2 border-b border-[#1a1a1a] space-y-0" aria-label="Primary navigation">
            {[
              { id: "landing",   icon: "🏠", label: "Home"        },
              ...(isIndia ? [{ id: "india", icon: "🇮🇳", label: "India Home" }] : []),
              { id: "dashboard", icon: "⊞",  label: "Dashboard"   },
              { id: "pricing",   icon: "💳", label: "Pricing"     },
              { id: "deception", icon: "🛡️", label: "SOC Shield"  },
              { id: "cert",      icon: "🏆", label: "Certificate" },
              { id: "referral",  icon: "🔗", label: "Invite Peer" },
              { id: "privacy",   icon: "🛡️", label: "Privacy" },
              { id: "aisettings",icon: "🤖", label: "AI Settings" },
            ].map(item => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={view === item.id}
                onClick={() => navigate(item.id)}
              />
            ))}
          </nav>

          {/* Community link (auth-gated) */}
          <div className="px-2 py-1">
            <button
              onClick={() => {
                if (!token) {
                  setAuthMode("login");
                  setView("auth");
                } else {
                  navigate("community");
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left font-mono text-[10px] tracking-widest uppercase transition-colors duration-150
                ${view === "community" ? "text-white bg-[#111]" : "text-gray-600 hover:text-gray-300 hover:bg-[#0d0d0d]"}`}
            >
              <span className="shrink-0 text-[8px] text-gray-700">{view === "community" ? "▸" : " "}</span>
              <span>Community</span>
            </button>
          </div>

          {/* Lab list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0">
            <p className="font-mono text-[9px] text-gray-700 px-3 pt-3 pb-2 uppercase tracking-[0.3em]">// Labs</p>
            {labs.map(lab => (
              <LabItem
                key={lab.id}
                lab={lab}
                active={activeLabId === lab.id && view === "lab"}
                completed={!!progress[lab.id]?.completed}
                locked={!canAccessLab(lab.id)}
                onClick={() => openLab(lab.id)}
              />
            ))}
          </div>

          {/* Footer links */}
          <div className="px-4 py-3 border-t border-[#1a1a1a] flex flex-wrap gap-x-4 gap-y-1">
            {[
              { label: "About", action: () => { setAboutTab("about"); navigate("about"); } },
              { label: "Blog", action: () => { setAboutTab("blog"); navigate("about"); } },
              { label: "FAQ", action: () => { setAboutTab("faq"); navigate("about"); } },
              { label: "Legal", action: () => navigate("legal") },
            ].map(link => (
              <button
                key={link.label}
                onClick={link.action}
                className="font-mono text-[9px] text-gray-700 hover:text-gray-400 tracking-widest uppercase transition-colors py-1"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Auth links */}
          <div className="p-3 border-t border-[#1a1a1a]">
            {!token ? (
              <div className="space-y-1">
                <button
                  onClick={() => { setAuthMode("login"); setView("auth"); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase text-gray-500 hover:text-white hover:bg-[#0d0d0d] transition-colors"
                >
                  <span>Sign In</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setView("auth"); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-white hover:bg-[#0d0d0d] transition-colors"
                >
                  <span>Register</span>
                  <span>→</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={() => navigate("profile")}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-mono text-[10px] text-gray-500 hover:text-white hover:bg-[#0d0d0d] transition-colors"
                >
                  <span className="truncate text-left tracking-wide">{user?.name || user?.email || "Profile"}</span>
                  <span className="text-gray-700 ml-2 text-[9px] tracking-widest uppercase">Settings</span>
                </button>

                <button
                  onClick={() => navigate("pricing")}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-white hover:bg-[#0d0d0d] transition-colors"
                >
                  <span>Plan</span>
                  <span className="text-gray-400 capitalize">{plan}{plan === "starter" ? " · Upgrade" : " ✓"}</span>
                </button>

                <button
                  onClick={() => { logout(); navigate("landing"); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 font-mono text-[10px] tracking-widest uppercase text-gray-700 hover:text-[#FF3B30] hover:bg-[#0d0d0d] transition-colors"
                >
                  <span>Logout</span>
                  <span>×</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Header */}
        <header className="flex items-center gap-3 px-3 h-11 border-b border-[#1a1a1a] shrink-0" role="banner" aria-label="Application header">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-11 h-11 flex items-center justify-center font-mono text-gray-600 hover:text-white transition-colors"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>

          {view === "lab" && activeLab && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-gray-600 uppercase tracking-widest min-w-0">
              <span className="shrink-0 text-sm">{activeLab.icon}</span>
              <span className="truncate">{activeLab.name}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {allCompleted && (
              <button
                onClick={() => navigate("cert")}
                className="font-mono text-[10px] tracking-widest uppercase text-gray-500 hover:text-white border border-[#222] hover:border-[#444] px-3 py-2 transition-colors"
                aria-label="View your certificate"
              >
                [ Certificate ]
              </button>
            )}
            {plan === "starter" && (
              <button
                onClick={() => setPaywallOpen(true)}
                className="font-mono text-[10px] tracking-widest uppercase text-white bg-white/10 hover:bg-white/15 border border-[#333] px-3 py-2 transition-colors"
                aria-label="Upgrade your plan"
              >
                Upgrade ↑
              </button>
            )}
          </div>
        </header>

        <ProgressBar count={completedCount} />

        {/* Main content area with ARIA landmark */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main" aria-label="Main content" tabIndex="-1">

          {view === "dashboard" && (
            <Dashboard
              labs={labs}
              progress={progress}
              plan={plan}
              onOpenLab={openLab}
              onUpgrade={() => setPaywallOpen(true)}
              onReferral={() => navigate("referral")}
              onManageBilling={handleManageBilling}
              achievements={achievements}
            />
          )}

          {view === "pricing" && (
            <div className="p-8">
              <PricingTable onNeedLogin={() => { setAuthMode("login"); setView("auth"); }} />
            </div>
          )}

          {view === "cert" && (
            <div className="p-8">
              <CertificationSystem />
            </div>
          )}

          {view === "lab" && activeLabId && (
            <div style={{ height: "100%" }}>
              {canAccessLab(activeLabId) ? (
                <LabErrorBoundary key={activeLabId}>
                  <Suspense fallback={<LabSkeleton />}>
                    <LabRenderer labId={activeLabId} />
                  </Suspense>
                </LabErrorBoundary>
              ) : (
                <LockedLab
                  lab={activeLab}
                  onUpgrade={() => setPaywallOpen(true)}
                />
              )}
            </div>
          )}

          {/* Fallback: nothing selected */}
          {view !== "dashboard" && view !== "pricing" && view !== "cert" && view !== "lab" && view !== "referral" && view !== "community" && view !== "about" && view !== "legal" && view !== "success" && (
            <Dashboard
              labs={labs}
              progress={progress}
              plan={plan}
              onOpenLab={openLab}
              onUpgrade={() => setPaywallOpen(true)}
              onReferral={() => navigate("referral")}
              onManageBilling={handleManageBilling}
            />
          )}
        </main>
      </div>

      {/* Floating AI Mentor (lab view only) */}
      {view === "lab" && activeLabId && (
        <AIMentor labId={activeLabId} labState={activeLabState} />
      )}
    </div>
  );
}
