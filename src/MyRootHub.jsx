// MyRootHub.jsx — Enterprise command center hub
// Route: /myrooting — aggregates all dashboards
import { useState, useEffect } from "react";
import SocialConfig from "./SocialConfig";

const DASHBOARDS = [
  {
    id: "msp",
    title: "MSP Central",
    subtitle: "Managed Service Provider — Multi-tenant overview",
    icon: "🏢",
    route: "/myrooting/msp",
    color: "from-blue-600/20 to-blue-600/5",
    borderColor: "border-blue-600/30",
    accentColor: "text-blue-400",
  },
  {
    id: "helpdesk",
    title: "Helpdesk AI",
    subtitle: "Intelligent ticket routing & auto-resolution",
    icon: "🎧",
    route: "/myrooting/helpdesk",
    color: "from-purple-600/20 to-purple-600/5",
    borderColor: "border-purple-600/30",
    accentColor: "text-purple-400",
  },
  {
    id: "telemetry",
    title: "Telemetry & Analytics",
    subtitle: "Lab usage tracking, scenario breakdown & export",
    icon: "📊",
    route: "/myrooting/telemetry",
    color: "from-emerald-600/20 to-emerald-600/5",
    borderColor: "border-emerald-600/30",
    accentColor: "text-emerald-400",
  },
  {
    id: "deception",
    title: "SOC Honeypot",
    subtitle: "Threat detection, fake credentials & attacker profiling",
    icon: "🛡️",
    route: "/myrooting/deception",
    color: "from-red-600/20 to-red-600/5",
    borderColor: "border-red-600/30",
    accentColor: "text-red-400",
  },
];

function DashboardCard({ dash, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-start p-6 rounded-xl border bg-gradient-to-br ${dash.color} ${dash.borderColor} hover:scale-[1.02] transition-all text-left`}
    >
      <span className="text-4xl mb-3">{dash.icon}</span>
      <h3 className={`text-lg font-bold text-white mb-1 ${dash.accentColor}`}>{dash.title}</h3>
      <p className="text-sm text-slate-400 mb-4">{dash.subtitle}</p>
      <span className={`text-xs font-medium ${dash.accentColor} mt-auto`}>
        Open Dashboard →
      </span>
    </button>
  );
}

export default function MyRootHub() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tkn = localStorage.getItem("winlab_logged_in");
    setToken(tkn);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading MyRoot…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-slate-400 text-sm mb-6">
            Sign in to access the enterprise command center.
          </p>
          <a
            href="/auth"
            className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Sign In →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <div className="border-b border-slate-800 sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <a href="/" className="text-slate-600 hover:text-white text-sm transition-colors">
              ← Home
            </a>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="font-bold text-white">MyRoot Command Center</span>
            </div>
          </div>
          <span className="text-xs text-slate-600 font-mono">ENTERPRISE</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white mb-1">Enterprise Dashboards</h1>
          <p className="text-slate-400 text-sm">Select a command center to monitor and manage your infrastructure.</p>
        </div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {DASHBOARDS.map((dash) => (
            <DashboardCard
              key={dash.id}
              dash={dash}
              onClick={() => {
                window.location.href = dash.route;
              }}
            />
          ))}
        </div>

        {/* Social Links Config */}
        <div className="mt-12">
          <SocialConfig />
        </div>

        {/* Quick stats footer */}
        <div className="mt-12 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>🔒 All dashboards require authentication</span>
            <span>⌨️ Keyboard shortcuts available in each panel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
