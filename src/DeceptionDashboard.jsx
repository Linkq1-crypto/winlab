// DeceptionDashboard.jsx – SOC Honeypot Dashboard for WINLAB Business Plan
import { useState, useEffect, useCallback, useRef } from "react";
import { useLab } from "./LabContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const THREAT_COLORS = {
  0: "text-slate-500",
  1: "text-yellow-400",
  2: "text-orange-400",
  3: "text-red-400",
  4: "text-red-500",
  5: "text-red-600",
};

const SKILL_BADGES = {
  beginner: "bg-slate-700 text-slate-300",
  intermediate: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30",
  advanced: "bg-orange-600/20 text-orange-400 border border-orange-600/30",
  expert: "bg-red-600/20 text-red-400 border border-red-600/30",
  unknown: "bg-slate-800 text-slate-600",
};

const INTENT_ICONS = {
  exploration: "🔍",
  "credential-theft": "🔑",
  "system-compromise": "💀",
  sabotage: "💣",
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function StatsCards({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { label: "Active Attackers", value: stats.activeAttackers, icon: "🎯", color: "text-red-400" },
        { label: "Commands Captured", value: stats.totalCommands, icon: "⌨️", color: "text-blue-400" },
        { label: "Avg Threat Score", value: stats.avgThreatScore, icon: "📊", color: "text-orange-400" },
        { label: "Fake Creds Used", value: stats.credentialDetections, icon: "🪤", color: "text-green-400" },
      ].map((card, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{card.icon}</span>
            <span className="text-xs text-slate-500 uppercase tracking-wider">{card.label}</span>
          </div>
          <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Skill Distribution ───────────────────────────────────────────────────────
function SkillDistribution({ dist }) {
  if (!dist) return null;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Skill Distribution</h3>
      <div className="space-y-2">
        {Object.entries(dist).map(([skill, count]) => (
          <div key={skill} className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${SKILL_BADGES[skill] || SKILL_BADGES.unknown} w-24 text-right`}>
              {skill}
            </span>
            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  skill === "expert" ? "bg-red-600" :
                  skill === "advanced" ? "bg-orange-600" :
                  skill === "intermediate" ? "bg-yellow-600" :
                  "bg-slate-600"
                }`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Session List ─────────────────────────────────────────────────────────────
function SessionList({ sessions, onSelect }) {
  if (!sessions?.length) return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <span className="text-3xl block mb-3">🛡️</span>
      <p className="text-slate-500 text-sm">No active attackers detected</p>
      <p className="text-slate-700 text-xs mt-1">Your systems are clean — for now</p>
    </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Active Sessions</h3>
        <span className="text-xs text-red-400">{sessions.length} active</span>
      </div>
      <div className="divide-y divide-slate-800">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-800/50 transition-colors text-left"
          >
            {/* Threat score */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm bg-slate-800 ${THREAT_COLORS[Math.floor(s.threatScore)] || "text-slate-500"}`}>
              {s.threatScore.toFixed(1)}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">{s.ip?.slice(0, 15) || "unknown"}</span>
                <span className="text-[10px] text-slate-600">{s.env}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {s.profile && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SKILL_BADGES[s.profile.skill] || SKILL_BADGES.unknown}`}>
                    {s.profile.skill}
                  </span>
                )}
                {s.profile && (
                  <span className="text-[10px] text-slate-500">
                    {INTENT_ICONS[s.profile.intent] || "🔍"} {s.profile.intent}
                  </span>
                )}
              </div>
            </div>
            {/* Activity */}
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500">{s.commands.length} cmds</p>
              <p className="text-[10px] text-slate-700">{timeAgo(s.lastActivity)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Session Detail ───────────────────────────────────────────────────────────
function SessionDetail({ session, onBack }) {
  if (!session) return null;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          <h3 className="text-sm font-semibold text-white font-mono">{session.id.slice(0, 8)}…</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${session.isActive ? "bg-green-600/20 text-green-400" : "bg-slate-700 text-slate-500"}`}>
          {session.isActive ? "LIVE" : "CLOSED"}
        </span>
      </div>

      {/* Profile */}
      {session.profile && (
        <div className="px-5 py-4 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-slate-600 uppercase">Type</p>
            <p className="text-xs text-white">{session.profile.type}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 uppercase">Skill</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${SKILL_BADGES[session.profile.skill] || SKILL_BADGES.unknown}`}>
              {session.profile.skill}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 uppercase">Intent</p>
            <p className="text-xs text-white">{INTENT_ICONS[session.profile.intent] || "🔍"} {session.profile.intent}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-600 uppercase">Threat Score</p>
            <p className={`text-lg font-black ${THREAT_COLORS[Math.floor(session.threatScore)] || "text-slate-500"}`}>
              {session.threatScore.toFixed(1)}/10
            </p>
          </div>
        </div>
      )}

      {/* Command History */}
      <div className="px-5 py-3 border-b border-slate-800">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Command History ({session.commands.length})</h4>
        <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
          {session.commands.map((cmd, i) => (
            <div key={i} className={`p-2 rounded ${cmd.threat?.threat ? "bg-red-600/10 border border-red-600/20" : "bg-slate-800/40"}`}>
              <div className="flex items-start gap-2">
                <span className="text-slate-600 shrink-0">{i + 1}</span>
                <span className={cmd.threat?.threat ? "text-red-400" : "text-green-400"}>$ {cmd.command}</span>
              </div>
              {cmd.output && cmd.output !== "__CLEAR__" && (
                <div className="text-slate-500 mt-0.5 whitespace-pre-wrap pl-5">{cmd.output.slice(0, 200)}{cmd.output.length > 200 ? "…" : ""}</div>
              )}
              {cmd.threat?.triggers?.length > 0 && (
                <div className="flex gap-1 mt-1 pl-5">
                  {cmd.threat.triggers.map((t, ti) => (
                    <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fake Credential Usage */}
      {session.usedFakeCredentials?.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-800">
          <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">🪤 Honeypot Credentials Triggered</h4>
          {session.usedFakeCredentials.map((cred, i) => (
            <div key={i} className="bg-green-600/10 border border-green-600/20 rounded p-2 mb-1 text-xs">
              <span className="text-green-400 font-mono">{cred.key}</span>
              <span className="text-slate-500 ml-2">via:</span>
              <span className="text-slate-400 font-mono ml-1">{cred.command.slice(0, 60)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DeceptionDashboard({ onBack, token }) {
  const { plan } = useLab();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        fetch("/api/deception/stats", { headers: { } }),
        fetch("/api/deception/sessions", { headers: { } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      setError("");
    } catch {
      // Silently fail during polling
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (plan !== "business") return;
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    return () => clearInterval(pollRef.current);
  }, [plan, token, fetchData]);

  if (plan !== "business") {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl block mb-4">🔒</span>
          <h2 className="text-xl font-bold text-white mb-2">Business Plan Required</h2>
          <p className="text-slate-400 text-sm">SOC Deception Dashboard is available for Business plan users only.</p>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading SOC Dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          )}
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              🛡️ SOC Deception Dashboard
            </h1>
            <p className="text-xs text-slate-500">Honeypot Intelligence & Attacker Profiling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">Live</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        <StatsCards stats={stats} />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {selectedSession ? (
              <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />
            ) : (
              <SessionList sessions={sessions} onSelect={setSelectedSession} />
            )}
          </div>

          <div>
            <SkillDistribution dist={stats?.skillDistribution} />

            {/* Top Attackers */}
            {stats?.topAttackers?.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">🎯 Top Attackers</h3>
                <div className="space-y-2">
                  {stats.topAttackers.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 w-4">{i + 1}</span>
                      <span className="font-mono text-slate-400 flex-1 truncate">{a.ip}</span>
                      <span className={`font-black ${THREAT_COLORS[Math.floor(a.threatScore)] || "text-slate-500"}`}>
                        {a.threatScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
