// BudgetProgress.jsx – AI Budget bar for MYROOT admin panel
// Shows real-time AI spending with color-coded status
import { useState, useEffect, useCallback } from "react";

const COPY = {
  en: {
    title: "AI Budget",
    spent: "Spent",
    limit: "Limit",
    requests: "API requests",
    cached: "Cache hits",
    hitRate: "Hit rate",
    estimated: "Estimated saving",
    status: { ok: "Healthy", warning: "Approaching limit", critical: "Limit reached", blocked: "Blocked" },
  },
  it: {
    title: "Budget AI",
    spent: "Speso",
    limit: "Limite",
    requests: "Richieste API",
    cached: "Cache hit",
    hitRate: "Tasso cache",
    estimated: "Risparmio stimato",
    status: { ok: "OK", warning: "Limite vicino", critical: "Limite raggiunto", blocked: "Bloccato" },
  },
  hi: {
    title: "AI Budget",
    spent: "Kharch",
    limit: "Limit",
    requests: "API requests",
    cached: "Cache hits",
    hitRate: "Hit rate",
    estimated: "Estimated bachat",
    status: { ok: "Theek hai", warning: "Limit paas aa raha", critical: "Limit reached", blocked: "Block ho gaya" },
  },
};

export default function BudgetProgress({ language = "en", token }) {
  const t = COPY[language] || COPY.en;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/ai/budget-status", {
        credentials: "include",
      });
      if (res.ok) setStats(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchStats();
    const poll = setInterval(fetchStats, 30000); // every 30s
    return () => clearInterval(poll);
  }, [fetchStats]);

  if (loading) return <p className="text-slate-500 text-sm">Loading budget…</p>;
  if (!stats) return <p className="text-slate-500 text-sm">Budget stats unavailable.</p>;

  const pct = Math.min(100, ((stats.spent || 0) / (stats.limit || 15)) * 100);
  const color = pct < 80 ? "bg-emerald-500" : pct < 100 ? "bg-yellow-500" : "bg-red-500";
  const statusKey = pct >= 100 ? "blocked" : pct >= 95 ? "critical" : pct >= 80 ? "warning" : "ok";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{t.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          pct < 80 ? "bg-emerald-500/20 text-emerald-400" :
          pct < 100 ? "bg-yellow-500/20 text-yellow-400" :
          "bg-red-500/20 text-red-400"
        }`}>
          {t.status[statusKey]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex justify-between text-xs text-slate-500 mb-4">
        <span>{t.spent}: €{stats.spent?.toFixed(2) || "0.00"}</span>
        <span>{t.limit}: €{stats.limit?.toFixed(2) || "15.00"}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t.requests, value: stats.totalRequests ?? "—" },
          { label: t.cached, value: stats.cacheHits ?? "—" },
          { label: t.hitRate, value: stats.hitRate ? `${stats.hitRate}%` : "—" },
          { label: t.estimated, value: stats.estimatedSaving ? `€${stats.estimatedSaving.toFixed(2)}` : "—" },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
            <p className="text-sm font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
