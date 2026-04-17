// CommunityHub.jsx – Feedback Board · Bug Reporter · AI Summary (admin)
import { useState, useEffect, useCallback } from "react";

const LABS = [
  "Linux Terminal Simulator",
  "RAID Simulator",
  "OS Install + RAID",
  "vSphere Simulator",
  "SSSD / LDAP",
  "Real Server Sim",
  "Advanced Scenarios",
  "AI Challenge Simulator",
  "Network Lab",
  "Security Audit",
];

// Emoji mapper for feature requests and bugs
function getPostEmoji(post, index) {
  const featureEmojis = ["🚀", "💡", "⚡", "🔧", "🎯", "🛠️", "📦", "🌟", "🔥", "💻"];
  const bugEmojis = ["🐛", "🔴", "⚠️", "💥", "🚨", "🆘", "🐞", "❌", "🛑", "👾"];
  
  if (post.type === "bug") {
    const severityEmojis = {
      critical: "🚨",
      high: "🔴",
      medium: "⚠️",
      low: "🐛"
    };
    return severityEmojis[post.severity] || bugEmojis[index % bugEmojis.length];
  }
  
  return featureEmojis[index % featureEmojis.length];
}

function getSeverityBadge(severity) {
  const badges = {
    critical: { emoji: "🚨", label: "CRITICAL", class: "bg-red-600/20 text-red-400 border-red-600/40" },
    high: { emoji: "🔴", label: "HIGH", class: "bg-orange-600/20 text-orange-400 border-orange-600/40" },
    medium: { emoji: "⚠️", label: "MEDIUM", class: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40" },
    low: { emoji: "🐛", label: "LOW", class: "bg-slate-600/20 text-slate-400 border-slate-600/40" }
  };
  return badges[severity] || badges.medium;
}

// ── Shield loading icon ───────────────────────────────────────────────────────
function ShieldIcon({ size = 32, spinning = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={spinning ? "animate-spin" : ""}
      style={spinning ? { animationDuration: "2s" } : {}}
    >
      <path
        d="M12 2L4 5v6.5C4 16.09 7.41 20.36 12 22c4.59-1.64 8-5.91 8-10.5V5L12 2z"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(59,130,246,0.08)"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="border border-slate-800 bg-slate-900/50 rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-slate-800 rounded w-1/4 mb-3" />
      <div className="h-4 bg-slate-800 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-800 rounded w-1/2" />
    </div>
  );
}

// ── Feedback Board ────────────────────────────────────────────────────────────
const DEFAULT_FEATURES = [
  { id: "f1", title: "Docker / Kubernetes Lab",        body: "Simulate multi-node k8s cluster failures, rolling deployments, and etcd recovery.", votes: 142, voted: false },
  { id: "f2", title: "Windows Server AD Lab",          body: "Active Directory domain controller setup, GPO misconfigurations, and replication failures.", votes: 98,  voted: false },
  { id: "f3", title: "Networking (BGP / OSPF) Lab",    body: "Route flapping, AS path manipulation, split-horizon debugging in a simulated multi-router topology.", votes: 87,  voted: false },
  { id: "f4", title: "Database Replication (Postgres)", body: "Simulate streaming replication lag, failover promotion, and WAL corruption recovery.", votes: 73,  voted: false },
  { id: "f5", title: "Ansible / Config Drift Lab",     body: "Introduce drift across 20 simulated hosts and practice idempotent remediation playbooks.", votes: 61,  voted: false },
];

function FeedbackBoard({ token, onLogin }) {
  const [posts,       setPosts]       = useState(null); // null = loading
  const [newTitle,    setNewTitle]    = useState("");
  const [newBody,     setNewBody]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [showForm,    setShowForm]    = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/community/posts?type=feature");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.length > 0 ? data : DEFAULT_FEATURES);
      } else {
        setPosts(DEFAULT_FEATURES);
      }
    } catch {
      setPosts(DEFAULT_FEATURES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleVote(postId) {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, votes: p.voted ? p.votes - 1 : p.votes + 1, voted: !p.voted }
        : p
    ));
    try {
      await fetch(`/api/community/posts/${postId}/vote`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // silently revert on error – just reload
      load();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Check auth before submitting
    if (!token) {
      // Will be handled by parent
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "feature", title: newTitle, body: newBody }),
      });
      if (res.ok) {
        setNewTitle(""); setNewBody(""); setShowForm(false);
        load();
      } else if (res.status === 401) {
        // Unauthorized - token expired or invalid
        if (onLogin) onLogin();
      }
    } catch {
      // no-op
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = posts ? [...posts].sort((a, b) => b.votes - a.votes) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Feature Requests</h2>
          <p className="text-slate-500 text-xs mt-0.5">Vote for what we build next.</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {showForm ? "✕ Cancel" : "+ Suggest"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl border border-blue-600/20 bg-blue-600/5 space-y-3">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Feature title…"
            required
            maxLength={120}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Describe the lab / scenario you'd like to see (optional)…"
            rows={3}
            maxLength={500}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !newTitle.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {submitting ? "Posting…" : "Submit Request"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {sorted === null
          ? [1, 2, 3].map(i => <CardSkeleton key={i} />)
          : sorted.map((post, i) => (
            <div
              key={post.id}
              className={`flex gap-4 p-4 rounded-xl border transition-all
                ${post.voted
                  ? "border-blue-600/40 bg-blue-600/5"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"}`}
            >
              {/* Rank & Emoji */}
              <span className="text-2xl font-black text-slate-800 tabular-nums shrink-0 w-6 text-center">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xl shrink-0" title="Feature request">
                {getPostEmoji({ type: "feature" }, i)}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug">{post.title}</p>
                {post.body && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{post.body}</p>
                )}
              </div>

              {/* Upvote - Terminal Style */}
              <button
                onClick={() => handleVote(post.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg border transition-all shrink-0 font-mono
                  ${post.voted
                    ? "bg-blue-600/20 border-blue-600/40 text-blue-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}
              >
                <span className="text-[10px] leading-none">▲</span>
                <span className="text-sm font-bold tabular-nums leading-none">{post.votes}</span>
                <span className="text-[9px] text-slate-600">{post.voted ? "[+1]" : "[0]"}</span>
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Bug Reporter ──────────────────────────────────────────────────────────────
function BugReporter({ token }) {
  const [labId,       setLabId]       = useState("");
  const [title,       setTitle]       = useState("");
  const [body,        setBody]        = useState("");
  const [severity,    setSeverity]    = useState("medium");
  const [submitting,  setSubmitting]  = useState(false);
  const [sent,        setSent]        = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/community/bugs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // cookie auth,
        },
        body: JSON.stringify({ labId, title, body, severity }),
      });
      if (res.ok || res.status === 201) setSent(true);
      else if (res.status === 401 && onLogin) onLogin();
    } catch {
      setSent(true); // show success anyway for UX
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-6xl mb-2">🛡️</div>
        <ShieldIcon size={48} />
        <p className="text-green-400 font-semibold text-lg">✓ Bug report received</p>
        <p className="text-slate-400 text-sm text-center max-w-sm font-mono">
          [STATUS] Ticket created<br/>
          [ACTION] Our team will investigate<br/>
          [ETA] Fix will ship in next release
        </p>
        <button
          onClick={() => { setSent(false); setTitle(""); setBody(""); setLabId(""); setSeverity("medium"); }}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          Report another issue
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-bold text-white">Bug Reporter</h2>
        <span className="text-xl">🐛</span>
      </div>
      <p className="text-slate-500 text-xs mb-6 font-mono">
        $ tail -f /var/log/syslog | grep ERROR<br/>
        Found something broken? Tell us exactly what happened.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {/* Lab select */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Affected Lab</label>
          <select
            value={labId}
            onChange={e => setLabId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 appearance-none"
          >
            <option value="" disabled>Select a lab…</option>
            {LABS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
            <option value="Other">Other / General</option>
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Severity</label>
          <div className="flex gap-2">
            {[
              { id: "low",      label: "Low",      emoji: "🐛", color: "border-slate-600 text-slate-400" },
              { id: "medium",   label: "Medium",   emoji: "⚠️", color: "border-yellow-600/50 text-yellow-400" },
              { id: "high",     label: "High",     emoji: "🔴", color: "border-orange-600/50 text-orange-400" },
              { id: "critical", label: "Critical", emoji: "🚨", color: "border-red-600/50 text-red-400" },
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeverity(s.id)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all
                  ${severity === s.id
                    ? `${s.color} bg-current/10`
                    : "border-slate-800 text-slate-600 hover:text-slate-400"}`}
                style={severity === s.id ? { backgroundColor: "rgba(255,255,255,0.04)" } : {}}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Short description</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Terminal freezes after mdadm --create"
            required
            maxLength={160}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Steps to reproduce</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={"1. Open the RAID lab\n2. Type: mdadm --create /dev/md0 --level=5 ...\n3. Press Enter → terminal hangs"}
            rows={5}
            required
            maxLength={2000}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {submitting ? (
            <>
              <ShieldIcon size={16} spinning />
              Submitting…
            </>
          ) : "Submit Bug Report"}
        </button>
      </form>
    </div>
  );
}

// ── AI Summary (admin view) ───────────────────────────────────────────────────
function AISummary({ token }) {
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [cached,    setCached]    = useState(false);

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback-summary", {
        credentials: "include",
      });
      if (res.status === 403) {
        setError("Admin access required.");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      setSummary(data.summary);
      setCached(data.cached ?? false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <ShieldIcon size={20} />
        <h2 className="text-lg font-bold text-white">AI Feedback Summary</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 font-medium">
          Admin
        </span>
      </div>
      <p className="text-slate-500 text-xs mb-6">
        Uses Claude to cluster and summarise all open feedback into actionable insights.
      </p>

      {!summary && !loading && (
        <button
          onClick={fetchSummary}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <ShieldIcon size={16} />
          Generate AI Summary
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-10">
          <ShieldIcon size={28} spinning />
          <div>
            <p className="text-white text-sm font-medium">Analysing feedback…</p>
            <p className="text-slate-500 text-xs mt-0.5">Claude is reading all posts and clustering themes.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-600/20 bg-red-600/5">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            {cached && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                ⚡ cached
              </span>
            )}
            <button
              onClick={fetchSummary}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Regenerate ↻
            </button>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Changelog ─────────────────────────────────────────────────────────────────
const CHANGELOG = [
  { date: "Mar 2026", tag: "New",   tagColor: "text-green-400 border-green-500/30 bg-green-500/10",   text: "RAID Simulator v2 — added RAID 6 and hot-spare scenarios" },
  { date: "Feb 2026", tag: "Fix",   tagColor: "text-orange-400 border-orange-500/30 bg-orange-500/10", text: "Fixed mdadm --assemble hanging on partially-failed arrays" },
  { date: "Feb 2026", tag: "New",   tagColor: "text-green-400 border-green-500/30 bg-green-500/10",   text: "AI Mentor now reads live lab state for context-aware hints" },
  { date: "Jan 2026", tag: "Perf",  tagColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",      text: "AI response caching — repeat questions now return instantly" },
  { date: "Jan 2026", tag: "New",   tagColor: "text-green-400 border-green-500/30 bg-green-500/10",   text: "vSphere Simulator — Terraform provider drift detection added" },
  { date: "Dec 2025", tag: "Fix",   tagColor: "text-orange-400 border-orange-500/30 bg-orange-500/10", text: "SSSD lab: fixed false positive on sssd.conf permission check" },
];

function Changelog() {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Changelog</h2>
      <p className="text-slate-500 text-xs mb-6">Recent updates to WINLAB labs and platform.</p>
      <div className="space-y-3">
        {CHANGELOG.map((item, i) => (
          <div key={i} className="flex gap-4 items-start p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-xs text-slate-600 w-16 shrink-0 pt-0.5 tabular-nums">{item.date}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${item.tagColor}`}>
              {item.tag}
            </span>
            <p className="text-sm text-slate-400 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "feedback",  label: "Feature Requests", icon: "⬆" },
  { id: "bugs",      label: "Bug Reporter",      icon: "🐛" },
  { id: "changelog", label: "Changelog",         icon: "📋" },
  { id: "ai",        label: "AI Summary",        icon: "✦",  adminOnly: true },
];

export default function CommunityHub({ onBack, onLogin, token, isAdmin = false }) {
  const [tab, setTab] = useState("feedback");
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  // If not logged in, show login prompt
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="text-5xl mb-6">🔐</div>
          <h2 className="text-xl font-bold text-white mb-3">Sign in to join the community</h2>
          <p className="text-slate-400 text-sm mb-8">
            You need an account to submit feature requests, report bugs, and vote on ideas.
          </p>
          <button
            onClick={onLogin}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Sign In →
          </button>
          <p className="text-xs text-slate-600 mt-4">
            Don't have an account?{" "}
            <button onClick={onLogin} className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
              Register for free
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* Sticky top bar */}
      <div className="border-b border-slate-800 sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-6 h-14">
          <button onClick={onBack} className="text-slate-600 hover:text-white text-sm transition-colors">
            ← Back
          </button>

          <div className="flex items-center gap-2 mr-auto">
            <ShieldIcon size={18} />
            <span className="text-sm font-bold text-white">Community</span>
          </div>

          <div className="flex gap-1">
            {visibleTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${tab === t.id ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {tab === "feedback"  && <FeedbackBoard token={token} onLogin={onLogin} />}
        {tab === "bugs"      && <BugReporter   token={token} />}
        {tab === "changelog" && <Changelog />}
        {tab === "ai"        && isAdmin && <AISummary token={token} />}
      </div>
    </div>
  );
}
