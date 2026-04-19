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
    <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-800/60 shrink-0">
      <span className="text-[11px] text-slate-600 w-16 shrink-0">Progress</span>
      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-700 animate-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500 w-10 text-right shrink-0">{pct}%</span>
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
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all text-left min-h-[44px]
        ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}
    >
      <span className="text-base leading-none shrink-0" aria-hidden="true">{icon}</span>
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
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all min-h-[48px]
        ${active   ? "bg-blue-600/20 border border-blue-600/30 text-white"
                   : "text-slate-400 hover:text-white hover:bg-slate-800/60"}
        ${locked   ? "opacity-50" : ""}`}
    >
      <span className="text-lg leading-none shrink-0" aria-hidden="true">{lab.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{lab.name}</p>
        <p className={`text-[10px] mt-0.5 ${
          lab.tier === "starter" ? "text-slate-600"
          : lab.tier === "pro"   ? "text-blue-500/70"
                                  : "text-purple-500/70"
        }`}>
          {lab.tier === "starter" ? "Free" : lab.tier === "pro" ? "Pro" : "Business"}
        </p>
      </div>
      {completed && <span className="text-green-500 text-xs shrink-0" aria-label="Completed">✓</span>}
      {locked    && <span className="text-slate-700 text-xs shrink-0" aria-label="Locked">🔒</span>}
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
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          {hasBilling && (
            <button
              onClick={onManageBilling}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
            >
              Gestisci abbonamento
            </button>
          )}
          {achievements.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              🏅 {achievements.length} badge{achievements.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-8">Il tuo percorso sysadmin.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {[
          { label: "Labs completati", value: `${completedCount}/${labs.length}`, accent: "text-blue-400" },
          { label: "Piano attuale",   value: plan === "earlyAccess" ? "Early Access" : plan, accent: plan === "pro" || plan === "earlyAccess" ? "text-blue-400" : plan === "business" ? "text-purple-400" : "text-slate-300" },
          { label: "Stato",           value: completedCount >= 10 ? "Certificato 🏆" : "In corso", accent: completedCount >= 10 ? "text-green-400" : "text-slate-400" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-600 mb-1">{s.label}</p>
            <p className={`text-xl font-bold capitalize ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Career Paths */}
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Percorsi di carriera</h2>
      <div className="space-y-3 mb-10">
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
              className={`rounded-xl border p-5 transition-all ${
                canAccess
                  ? `${path.color.border} ${path.color.bg}`
                  : "border-slate-800 bg-slate-900/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <span className="text-3xl shrink-0">{path.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-white">{path.title}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${path.color.badge}`}>
                        {path.subtitle}
                      </span>
                      {!canAccess && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 capitalize">
                          🔒 {path.requiredPlan}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{path.description}</p>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${path.color.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{completedInPath}/{total}</span>
                    </div>

                    {/* Lab list */}
                    <div className="flex flex-wrap gap-2">
                      {path.labs.map(labId => {
                        const lab = labs.find(l => l.id === labId);
                        const isDone = progress[labId]?.completed;
                        return (
                          <span
                            key={labId}
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              isDone
                                ? "border-green-600/30 text-green-400 bg-green-600/10"
                                : "border-slate-700 text-slate-500"
                            }`}
                          >
                            {isDone ? "✓ " : ""}{lab?.name || labId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: CTA */}
                <div className="shrink-0">
                  {done ? (
                    <span className="text-green-400 text-xs font-semibold">Completato ✓</span>
                  ) : canAccess && nextLab ? (
                    <button
                      onClick={() => onOpenLab(nextLab.id)}
                      className="px-3 py-2 min-h-[36px] text-xs bg-white/5 hover:bg-white/10 border border-slate-700 text-white rounded-lg transition-all whitespace-nowrap"
                    >
                      Continua →
                    </button>
                  ) : !canAccess ? (
                    <button
                      onClick={onUpgrade}
                      className="px-3 py-2 min-h-[36px] text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 rounded-lg transition-all whitespace-nowrap"
                    >
                      Upgrade ↑
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Outcome */}
              {done && (
                <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800 italic">
                  "{path.outcome}"
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Referral Terminal Box */}
      <div className="mb-10 bg-slate-900 border border-green-600/20 rounded-xl p-5 font-mono">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-green-400 mb-1">$ systemctl status community-growth</div>
            <div className="text-sm text-slate-300">● status: <span className="text-yellow-400">waiting_for_peers</span></div>
          </div>
          <button
            onClick={onReferral}
            className="px-4 py-2 min-h-[44px] text-xs bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-400 rounded-lg transition-all"
          >
            🔑 Generate Token
          </button>
        </div>
        <div className="text-xs text-slate-500 space-y-0.5">
          <div><span className="text-green-400">[!]</span> Invita un amico e ottieni <span className="text-yellow-400">-20%</span> di sconto</div>
          <div><span className="text-green-400">[!]</span> Corporate referral: <span className="text-purple-400">-30%</span> Root Privilege</div>
        </div>
      </div>

      {/* Lab grid (tutti i lab) */}
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Tutti i lab</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {labs.map(lab => {
          const canAccess = planRank >= (PLAN_RANK[lab.tier] ?? 0);
          const done = progress[lab.id]?.completed;
          return (
            <button
              key={lab.id}
              onClick={() => canAccess ? onOpenLab(lab.id) : onUpgrade()}
              className={`flex flex-col gap-2 p-4 rounded-xl border text-left transition-all
                ${done       ? "border-green-600/20 bg-green-600/5"
                : canAccess  ? "border-slate-800 bg-slate-900 hover:border-blue-600/40 hover:bg-slate-800"
                             : "border-slate-800 bg-slate-900/40 opacity-60"}`}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{lab.icon}</span>
                {done && <span className="text-green-400 text-xs">✓</span>}
                {!canAccess && <span className="text-slate-600 text-xs">🔒</span>}
              </div>
              <p className="text-xs font-semibold text-white leading-snug">{lab.name}</p>
              <p className={`text-[10px] ${lab.tier === "starter" ? "text-slate-600" : lab.tier === "pro" ? "text-blue-500/70" : "text-purple-500/70"}`}>
                {lab.tier === "starter" ? "Free" : lab.tier === "pro" ? "Pro" : "Business"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-4">
            🏅 Achievements
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {achievements.map(a => (
              <div key={a.id} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center">
                <span className="text-3xl">{a.icon}</span>
                <p className="text-xs font-bold text-white">{a.label}</p>
                <p className="text-[10px] text-slate-500">{a.desc}</p>
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
      <div className="relative bg-[#0d0d0f] border border-slate-800 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>
        <p className="text-center text-slate-400 text-sm mb-6">
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
          {labLabel} &nbsp;·&nbsp; Free demo
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

  // Launch landing page: /launch or /72h or ?launch=1
  if (isLaunchLanding) {
    return <LaunchLanding onCTA={() => {
      // Start checkout
      window.location.href = "/api/checkout";
    }} />;
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
    // During 72h launch window: show early access landing (LandingPage.jsx)
    // After 72h: show normal landing (WinLabHome.jsx) with 5 free labs
    if (launchTierActive) {
      return (
        <LandingPage
          onCTA={() => navigate("auth")}
          onNavigate={(section) => {
            if (section === "india") navigate("india");
            else if (section === "pricing") navigate("pricing");
            else navigate("landing");
          }}
        />
      );
    }
    return (
      <WinLabHome
        onCTA={() => { openLab("linux-terminal"); if (canAccessLab("linux-terminal")) setView("lab"); }}
        onNavigate={(section) => {
          if (section === "india") navigate("india");
          else if (section === "pricing") navigate("pricing");
          else navigate("landing");
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
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "#0a0a0b", color: "#fff" }}>

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
          style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
                   borderRight: "1px solid #1e293b", overflow: "hidden" }}
          className={`
            ${isMobile ? "fixed inset-y-0 left-0 z-50 shadow-2xl" : "relative"}
          `}
          role="navigation"
          aria-label="Main navigation"
        >

          {/* Logo */}
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex items-center gap-1">
              <span className="text-blue-500 font-black text-lg tracking-tight">WIN</span>
              <span className="text-white font-black text-lg tracking-tight">LAB</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">Sysadmin Training Platform</p>
          </div>

          {/* Top nav */}
          <nav className="p-2 border-b border-slate-800 space-y-0.5" aria-label="Primary navigation">
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
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left
                ${view === "community" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}
            >
              <span className="text-base leading-none">💬</span>
              <span>Community</span>
            </button>
          </div>

          {/* Lab list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <p className="text-[10px] text-slate-700 px-3 pt-2 pb-1 uppercase tracking-widest">Labs</p>
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
          <div className="px-3 pb-2 flex flex-wrap items-center gap-1">
            {[
              { label: "About", action: () => { setAboutTab("about"); navigate("about"); } },
              { label: "Blog", action: () => { setAboutTab("blog"); navigate("about"); } },
              { label: "FAQ", action: () => { setAboutTab("faq"); navigate("about"); } },
              { label: "Privacy & Terms", action: () => navigate("legal") },
            ].map(link => (
              <button
                key={link.label}
                onClick={link.action}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors px-3 py-2 min-h-[44px]"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Auth links */}
          <div className="p-3 border-t border-slate-800">
            {!token ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => { setAuthMode("login"); setView("auth"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <span className="text-slate-500">Account</span>
                  <span className="text-slate-300 font-semibold">Sign In →</span>
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setView("auth"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-green-600/10 hover:bg-green-600/20 border border-green-600/20 transition-colors"
                >
                  <span className="text-slate-500">New?</span>
                  <span className="text-green-400 font-semibold">Register →</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* User Info & Profile Link */}
                <button
                  onClick={() => navigate("profile")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <span className="text-slate-300 truncate text-left">{user?.name || user?.email || "Profile"}</span>
                  <span className="text-slate-500 ml-2">⚙️</span>
                </button>

                {/* Plan badge */}
                <button
                  onClick={() => navigate("pricing")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors
                    ${plan === "business" ? "bg-purple-600/10 border border-purple-600/20 hover:bg-purple-600/20"
                    : plan === "pro"      ? "bg-blue-600/10 border border-blue-600/20 hover:bg-blue-600/20"
                                          : "bg-slate-800 hover:bg-slate-700"}`}
                >
                  <span className="text-slate-500">Plan</span>
                  <span className={`font-semibold capitalize
                    ${plan === "business" ? "text-purple-400"
                    : plan === "pro"      ? "text-blue-400"
                                          : "text-slate-300"}`}>
                    {plan}{plan === "starter" ? " · Upgrade ↑" : " ✓"}
                  </span>
                </button>

                {/* Logout */}
                <button
                  onClick={() => { logout(); navigate("landing"); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-red-600/10 border border-transparent hover:border-red-600/20 transition-colors"
                >
                  <span className="text-slate-500">Logout</span>
                  <span className="text-red-400 ml-2">🚪</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Header */}
        <header className="flex items-center gap-3 px-3 h-12 sm:h-11 border-b border-slate-800 shrink-0" role="banner" aria-label="Application header">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-white text-lg transition-colors"
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>

          {view === "lab" && activeLab && (
            <div className="flex items-center gap-2 text-sm text-slate-400 min-w-0">
              <span className="shrink-0">{activeLab.icon}</span>
              <span className="truncate">{activeLab.name}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {allCompleted && (
              <button
                onClick={() => navigate("cert")}
                className="text-xs px-3 py-2 min-h-[44px] bg-green-600/20 border border-green-600/30 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                aria-label="View your certificate"
              >
                🏆 <span className="hidden sm:inline">Certificate</span>
              </button>
            )}
            {plan === "starter" && (
              <button
                onClick={() => setPaywallOpen(true)}
                className="text-xs px-3 py-2 min-h-[44px] bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
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
