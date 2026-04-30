// LabContext.jsx – Global state: user plan, lab progress, paywall, hints
// Fully DB-synced: progress, achievements, settings, lab state
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { readStoredAiConsentPreference, syncStoredAiConsentPreference, writeStoredAiConsentPreference } from "./services/aiConsent.js";

// ── Lab registry ──────────────────────────────────────────────────────────────
export const LABS = [
  { id: "linux-terminal",    name: "Linux Terminal",        icon: "🖥️",  tier: "starter",     file: "linux-terminal-sim"         },
  { id: "enhanced-terminal", name: "Guided Lab Challenge",  icon: "🎯",  tier: "starter",     file: "EnhancedTerminalLab"        },
  { id: "raid-simulator",    name: "RAID Configuration",    icon: "💾",  tier: "pro",         file: "raid-simulator"             },
  { id: "os-install",        name: "OS Installation",       icon: "📀",  tier: "pro",         file: "os-install-raid"            },
  { id: "vsphere",           name: "vSphere",               icon: "☁️",  tier: "pro",         file: "vsphere-simulator"          },
  { id: "sssd-ldap",         name: "SSSD / LDAP",           icon: "🔐",  tier: "pro",         file: "sysadmin-sssd-users-gone"   },
  { id: "real-server",       name: "Real Server Incidents", icon: "🔥",  tier: "pro",         file: "linux-real-server-sim"      },
  { id: "advanced-scenarios",name: "Advanced Scenarios",    icon: "⚡",  tier: "pro",         file: "sysadmin-6-scenari"         },
  { id: "ai-challenges",     name: "AI Challenges",         icon: "🤖",  tier: "pro",         file: "AIChallengeSimulator"       },
  { id: "intune-mdm",        name: "Intune MDM",            icon: "🪟",  tier: "pro",         file: "components/IntuneMDM"       },
  { id: "jamf-pro",          name: "Jamf Pro",              icon: "🍎",  tier: "pro",         file: "components/JamfPro"         },
  { id: "network-lab",       name: "Network Lab",           icon: "🌐",  tier: "pro",         file: "components/NetworkLab"      },
  { id: "security-audit",    name: "Security Audit",        icon: "🛡️",  tier: "pro",         file: "components/SecurityAudit"   },
  { id: "enterprise-arch",   name: "Enterprise Arch",       icon: "🏢",  tier: "business",    file: "components/EnterpriseArch"  },
  { id: "automation",        name: "Automation",            icon: "⚙️",  tier: "business",    file: "components/AutomationLab"   },
  { id: "cloud-infrastructure",name:"Cloud Infrastructure", icon: "🌩️",  tier: "business",    file: "components/CloudInfra"      },
  { id: "msp-multi-tenant",  name: "Multi-Tenant MSP",      icon: "🌍",  tier: "business",    file: "components/MspDashboard"    },
  { id: "codex-api-timeout", name: "Codex Incident: API Timeout", icon: "[AI]", tier: "pro", file: "CodexIncidentLab" },
  { id: "codex-auth-bypass", name: "Codex Incident: Auth Bypass", icon: "[AI]", tier: "pro", file: "CodexIncidentLab" },
  { id: "codex-stripe-webhook", name: "Codex Incident: Stripe Webhook", icon: "[AI]", tier: "pro", file: "CodexIncidentLab" },
];

export const PLAN_LIMITS = {
  starter:  { labs: ["linux-terminal", "enhanced-terminal", "raid-simulator", "os-install", "vsphere"], hints: 3 },
  pro:      { labs: LABS.filter(l => l.tier !== "business").map(l => l.id), hints: Infinity },
  business: { labs: LABS.map(l => l.id), hints: Infinity },
};

// ── Career Paths ──────────────────────────────────────────────────────────────
export const CAREER_PATHS = [
  {
    id: "junior",
    title: "Junior SysAdmin",
    subtitle: "Learn",
    description: "Linux fundamentals and command-line essentials",
    outcome: "You're ready to work on Linux servers",
    icon: "🖥️",
    color: { border: "border-green-600/30", bg: "bg-green-600/5", badge: "bg-green-600/15 text-green-400", bar: "bg-green-500" },
    requiredPlan: "starter",
    labs: ["linux-terminal", "enhanced-terminal"],
  },
  {
    id: "sysadmin",
    title: "Operational SysAdmin",
    subtitle: "Operate",
    description: "Storage, OS, networking and enterprise authentication",
    outcome: "You manage servers in production",
    icon: "⚙️",
    color: { border: "border-blue-600/30", bg: "bg-blue-600/5", badge: "bg-blue-600/15 text-blue-400", bar: "bg-blue-500" },
    requiredPlan: "pro",
    labs: ["os-install", "raid-simulator", "network-lab", "sssd-ldap"],
  },
  {
    id: "infra",
    title: "Infra Engineer",
    subtitle: "Scale",
    description: "Virtualization, security and incident response",
    outcome: "You handle real incidents on complex infrastructure",
    icon: "🔥",
    color: { border: "border-orange-600/30", bg: "bg-orange-600/5", badge: "bg-orange-600/15 text-orange-400", bar: "bg-orange-500" },
    requiredPlan: "pro",
    labs: ["vsphere", "security-audit", "real-server"],
  },
  {
    id: "ai",
    title: "AI + Automation",
    subtitle: "Stand out",
    description: "Use AI to work faster and solve complex problems",
    outcome: "You automate and resolve incidents with AI",
    icon: "🤖",
    color: { border: "border-purple-600/30", bg: "bg-purple-600/5", badge: "bg-purple-600/15 text-purple-400", bar: "bg-purple-500" },
    requiredPlan: "pro",
    labs: ["ai-challenges", "advanced-scenarios"],
  },
  {
    id: "enterprise",
    title: "Enterprise Architect",
    subtitle: "Lead",
    description: "Real enterprise infrastructure simulations",
    outcome: "You manage multi-tenant enterprise infrastructure",
    icon: "🏢",
    color: { border: "border-slate-500/30", bg: "bg-slate-500/5", badge: "bg-slate-500/15 text-slate-300", bar: "bg-slate-400" },
    requiredPlan: "business",
    labs: ["enterprise-arch", "automation", "cloud-infrastructure", "msp-multi-tenant"],
  },
];

// Returns the first incomplete lab in a path, or null if all done
export function getNextLab(pathId, progress) {
  const path = CAREER_PATHS.find(p => p.id === pathId);
  if (!path) return null;
  return path.labs.find(labId => !progress[labId]?.completed) || null;
}

// ── Context ───────────────────────────────────────────────────────────────────
const LabContext = createContext(null);

export function LabProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [plan, setPlan]               = useState("starter");
  const [token, setToken]             = useState(null);
  const [progress, setProgress]       = useState({});
  const [activeLabState, setActiveLabState] = useState({});
  const [showPaywall, setShowPaywall] = useState(false);
  const [hintCount, setHintCount]     = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [aiConsent, setAiConsent]     = useState(false);
  const [lastActiveLab, setLastActiveLab] = useState(null);
  const [lastLabState, setLastLabState] = useState(null);

  // ── Hydrate — cookie-based auth, verify via /api/user/me ────────────────────
  useEffect(() => {
    // Load cached local state immediately for fast UI
    const localProgress = localStorage.getItem("winlab_progress");
    if (localProgress) setProgress(JSON.parse(localProgress));

    const localAchievements = localStorage.getItem("winlab_achievements");
    if (localAchievements) setAchievements(JSON.parse(localAchievements));

    const localAiConsent = readStoredAiConsentPreference();
    if (typeof localAiConsent === "boolean") {
      setAiConsent(localAiConsent);
    }

    // Verify session via httpOnly cookie — if valid, hydrate user state
    fetch("/api/user/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
          // Normalize plan string
          let planValue = data.plan || "starter";
          try {
            if (typeof planValue === "string" && planValue.startsWith("{")) {
              planValue = JSON.parse(planValue).tier || JSON.parse(planValue).plan || "starter";
            }
          } catch { planValue = "starter"; }
          if (!["starter", "pro", "business", "earlyAccess"].includes(planValue)) planValue = "starter";
          setPlan(planValue);
          // Restore token from localStorage if present (set on login)
          const stored = localStorage.getItem("winlab_token");
          if (stored) setToken(stored);
          const serverAiConsent = data.aiMentorConsent === true;
          setAiConsent(serverAiConsent);
          writeStoredAiConsentPreference(serverAiConsent);
          localStorage.setItem("winlab_logged_in", "1");
          if (data.unlockedBadges) {
            try {
              const badges = JSON.parse(data.unlockedBadges);
              setAchievements(badges);
              localStorage.setItem("winlab_achievements", JSON.stringify(badges));
            } catch {}
          }
          if (data.lastActiveLab) setLastActiveLab(data.lastActiveLab);
          if (data.lastLabState) {
            try {
              setLastLabState(JSON.parse(data.lastLabState));
            } catch {
              setLastLabState(data.lastLabState);
            }
          }
        } else {
          localStorage.removeItem("winlab_logged_in");
        }
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    void syncStoredAiConsentPreference({ token });
  }, [token]);

  // ── Sync Plan ───────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("winlab_plan", plan); }, [plan]);

  // ── Achievement system ──────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { id: "first-lab",     icon: "🚀", label: "First Steps",       desc: "Completed your first lab",            check: (c) => c >= 1 },
    { id: "three-labs",    icon: "🔥", label: "Getting Serious",   desc: "Completed 3 labs",                  check: (c) => c >= 3 },
    { id: "five-labs",     icon: "⚡", label: "Halfway There",     desc: "Completed 5 labs",                  check: (c) => c >= 5 },
    { id: "all-labs",      icon: "🏆", label: "SysAdmin Master",   desc: "Completed all labs",             check: (c) => c >= LABS.length },
    { id: "linux-master",  icon: "🐧", label: "Terminal Wizard",   desc: "Completed Linux Terminal",          check: (_, p) => !!p["linux-terminal"]?.completed },
    { id: "guided-wizard", icon: "🎯", label: "Guided Lab Master", desc: "Completed Guided Lab Challenge",    check: (_, p) => !!p["enhanced-terminal"]?.completed },
    { id: "raid-expert",   icon: "💾", label: "RAID Expert",       desc: "Completed RAID Simulator",          check: (_, p) => !!p["raid-simulator"]?.completed },
  ];

  const awardAchievements = useCallback((completedCount, currentProgress) => {
    const newAchievements = [];
    for (const ach of ACHIEVEMENTS) {
      if (!achievements.find(a => a.id === ach.id) && ach.check(completedCount, currentProgress)) {
        newAchievements.push({ ...ach, unlockedAt: new Date().toISOString() });
      }
    }
    if (newAchievements.length > 0) {
      const updated = [...achievements, ...newAchievements];
      setAchievements(updated);
      localStorage.setItem("winlab_achievements", JSON.stringify(updated));

      // Sync to DB
      if (user?.id) {
        fetch("/api/user/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ unlockedBadges: updated.map(a => a.id) })
        }).catch(() => {});
      }

      newAchievements.forEach(ach => {
        window.dispatchEvent(new CustomEvent("winlab-achievement", { detail: ach }));
      });
    }
    return newAchievements;
  }, [achievements, user]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const canAccessLab = useCallback((labId) => {
    return PLAN_LIMITS[plan]?.labs.includes(labId) ?? false;
  }, [plan]);

  const saveProgress = useCallback((updated) => {
    setProgress(updated);
    localStorage.setItem("winlab_progress", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("winlab-progress", { detail: { message: "Progress saved" } }));

    // Sync to DB
    if (user?.id && token) {
      // We only sync the completion status here; detailed objectives are synced via completeObjective
      // To keep payload small, we just sync the completed labs list
      const completedLabs = Object.entries(updated).filter(([, v]) => v.completed).map(([k]) => k);
      // We could have a specific endpoint, but for now rely on completeObjective for granular sync
    }
  }, [user, token]);

  const completeObjective = useCallback(async (labId, objectiveKey) => {
    const updated = {
      ...progress,
      [labId]: {
        ...progress[labId],
        objectives: { ...(progress[labId]?.objectives || {}), [objectiveKey]: { at: new Date().toISOString() } }
      }
    };
    saveProgress(updated);

    // DB Sync
    if (user?.id) {
      fetch("/api/progress/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ labId, completed: false, score: 0 })
      }).catch(() => {});
    }
  }, [progress, user, saveProgress]);

  const completeLab = useCallback(async (labId) => {
    const updated = {
      ...progress,
      [labId]: { ...progress[labId], completed: true, completedAt: new Date().toISOString() }
    };
    saveProgress(updated);
    const completedCount = Object.values(updated).filter(l => l.completed).length;
    const newAchievements = awardAchievements(completedCount, updated);

    let triggerPaywall = false;
    if (user?.id) {
      try {
        const res = await fetch("/api/progress/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ labId, completed: true, score: 100 })
        });
        const data = await res.json();
        triggerPaywall = data.triggerPaywall;
      } catch {}
    }

    if ((triggerPaywall || (completedCount >= 5 && plan === "starter"))) setShowPaywall(true);
    return { completedCount, newAchievements };
  }, [progress, user, plan, saveProgress, awardAchievements]);

  // ── Lab State Persistence (Resume Lab) ──────────────────────────────────────
  const saveLabState = useCallback((labId, state) => {
    setActiveLabState(state);
    setLastActiveLab(labId);
    setLastLabState(state);

    // Debounced DB save
    if (user?.id) {
      clearTimeout(window._labStateTimer);
      window._labStateTimer = setTimeout(() => {
        fetch("/api/user/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ lastActiveLab: labId, lastLabState: state })
        }).catch(() => {});
      }, 2000);
    }
  }, [user]);

  // ── Profile & Settings ──────────────────────────────────────────────────────
  const updateProfile = useCallback(async (data) => {
    if (user?.id) {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(u => ({ ...u, ...updated }));
      }
    }
  }, [user]);

  const updateSettings = useCallback(async (data) => {
    if (typeof data.aiConsent === "boolean") {
      setAiConsent(data.aiConsent);
      writeStoredAiConsentPreference(data.aiConsent);
    }
    if (user?.id) {
      await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
    }
  }, [user]);

  const login = useCallback((userData, tokenValue) => {
    setUser(userData);
    // Normalize plan — DB may store raw JSON string e.g. '{"tier":"free"}'
    let planValue = userData?.plan || "starter";
    try {
      if (typeof planValue === "string" && planValue.startsWith("{")) {
        planValue = JSON.parse(planValue).tier || JSON.parse(planValue).plan || "starter";
      }
    } catch { planValue = "starter"; }
    // Map legacy/unknown values to known tiers
    if (!["starter", "pro", "business", "earlyAccess"].includes(planValue)) planValue = "starter";
    setPlan(planValue);
    if (tokenValue) {
      setToken(tokenValue);
      localStorage.setItem("winlab_token", tokenValue);
    }
    localStorage.setItem("winlab_logged_in", "1");
  }, []);

  const logout = useCallback(() => {
    setUser(null); setPlan("starter"); setToken(null);
    setAiConsent(false); setLastActiveLab(null); setLastLabState(null); setActiveLabState({});
    localStorage.removeItem("winlab_logged_in");
    localStorage.removeItem("winlab_token");
    localStorage.removeItem("winlab_progress");
    localStorage.removeItem("winlab_plan");
    setProgress({});
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const deleteAccount = useCallback(async () => {
    if (user?.id) {
      await fetch("/api/user/account", { method: "DELETE", credentials: "include" });
      logout();
    }
  }, [user, logout]);

  const useHint = useCallback(() => {
    const max = PLAN_LIMITS[plan]?.hints ?? 3;
    if (hintCount >= max) { setShowPaywall(true); return false; }
    setHintCount(h => h + 1);
    return true;
  }, [hintCount, plan]);

  const completedCount = Object.values(progress).filter(l => l.completed).length;
  const allCompleted   = completedCount >= 10;

  return (
    <LabContext.Provider value={{
      user, token, plan, setPlan,
      login, logout,
      progress, completedCount, allCompleted,
      activeLabState, setActiveLabState: saveLabState,
      showPaywall, setShowPaywall,
      hintCount, maxHints: PLAN_LIMITS[plan]?.hints ?? 3,
      canAccessLab, completeObjective, completeLab, useHint,
      achievements, awardAchievements,
      aiConsent, updateSettings,
      updateProfile, deleteAccount,
      lastActiveLab, lastLabState,
      LABS,
    }}>
      {children}
    </LabContext.Provider>
  );
}

export const useLab = () => {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside <LabProvider>");
  return ctx;
};
