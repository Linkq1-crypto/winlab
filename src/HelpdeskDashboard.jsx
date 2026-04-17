/**
 * HelpdeskDashboard — Enterprise 3-column layout (Stripe/Linear style)
 *
 * Layout:
 * ┌────────────┬────────────────────────────┬────────────────┐
 * │ Sidebar    │ Inbox (lista)              │ Thread / Detail│
 * │            │                            │                │
 * │ Dashboard  │ john@mail  🟢 0.91 AUTO    │ Subject        │
 * │ Inbox      │ client@mail 🟡 0.65 DRAFT  │ From           │
 * │ Insights   │ spam@mail   🔴 BLOCK       │ Body           │
 * │ KB         │                            │ AI Draft       │
 * │ Templates  │                            │ Actions        │
 * └────────────┴────────────────────────────┴────────────────┘
 *
 * Keyboard shortcuts:
 * J/K — navigate emails
 * Enter — open selected
 * Cmd+Enter — send reply
 * A — generate AI reply
 * S — focus search
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { SkeletonDashboard, Spinner, InlineLoading } from './components/SkeletonLoading.jsx';
import { usePerformance, useOptimistic } from './components/PerformanceOptimizer.jsx';
import { ErrorToast, pushError } from './components/ErrorToast.jsx';
import { OfflineStatusBar } from './components/OfflineStatus.jsx';
import { watchNetworkChanges } from './utils/edgeCaseHandler.js';
import { registerOfflineSW } from './utils/registerSW.js';

// ──── Badge Components ────
function TrustBadge({ level, score }) {
  const config = {
    high: { icon: '🟢', label: 'Verified', cls: 'bg-green-600/20 text-green-400 border border-green-600/30' },
    medium: { icon: '🟡', label: 'Medium', cls: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' },
    low: { icon: '🔴', label: 'Low Trust', cls: 'bg-red-600/20 text-red-400 border border-red-600/30' },
  };
  const c = config[level] || config.medium;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.cls} font-medium whitespace-nowrap`}>{c.icon} {score}</span>;
}

function ConfidenceBar({ confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-7 text-right">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    open: 'bg-blue-600/20 text-blue-400 border border-blue-600/30',
    pending: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
    resolved: 'bg-green-600/20 text-green-400 border border-green-600/30',
  };
  const style = styles[status] || styles.open;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style} uppercase`}>{status}</span>;
}

function TeamBadge({ team }) {
  const icons = { support: '🛠️', billing: '💰', sales: '🤝', legal: '⚖️', security: '🔒' };
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">{icons[team] || '📋'} {team}</span>;
}

function ActionBadge({ action }) {
  const config = {
    auto: 'bg-green-600/20 text-green-400',
    draft: 'bg-yellow-600/20 text-yellow-400',
    manual: 'bg-slate-700 text-slate-400',
    block: 'bg-red-600/20 text-red-400',
    blocked: 'bg-red-600/20 text-red-400',
    rate_limited: 'bg-orange-600/20 text-orange-400',
    anomaly: 'bg-purple-600/20 text-purple-400',
  };
  const labels = { auto: 'AUTO', draft: 'REVIEW', manual: 'MANUAL', block: 'BLOCKED', blocked: 'BLOCKED', rate_limited: 'RATE LTD', anomaly: 'ANOMALY' };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config[action] || config.manual} font-mono`}>{labels[action] || action}</span>;
}

function SLATimer({ createdAt }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - createdAt;
      const mins = Math.floor(diff / 60000);
      setElapsed(mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const mins = Math.floor((Date.now() - createdAt) / 60000);
  const color = mins > 120 ? 'text-red-400' : mins > 60 ? 'text-yellow-400' : 'text-slate-500';
  return <span className={`text-[10px] font-mono ${color}`}>⏱ {elapsed}</span>;
}

// ──── Email Row (Stripe-style) ────
function EmailRow({ ticket, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`px-3 py-2.5 border-b border-slate-800 cursor-pointer transition-colors ${
        isSelected ? 'bg-slate-800/70' : 'hover:bg-slate-900/60'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 truncate">{ticket.senderName || ticket.from}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {ticket.trust && <TrustBadge level={ticket.trust.level} score={ticket.trust.score} />}
        </div>
      </div>
      <div className="text-sm truncate mb-1">{ticket.subject}</div>
      <div className="flex items-center gap-2">
        {ticket.ai?.team && <TeamBadge team={ticket.ai.team} />}
        {ticket.action && <ActionBadge action={ticket.action} />}
        <span className="text-[10px] text-slate-600 ml-auto"><SLATimer createdAt={ticket.createdAt} /></span>
      </div>
      {ticket.ai?.confidence != null && (
        <div className="mt-1"><ConfidenceBar confidence={ticket.ai.confidence} /></div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════

export default function HelpdeskDashboard() {
  // Navigation
  const [view, setView] = useState('inbox'); // inbox, insights, kb, templates
  const [tickets, setTickets] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('support');
  const [sla, setSLA] = useState(null);
  const [insights, setInsights] = useState(null);
  const [kbArticles, setKBArticles] = useState([]);
  const [topTemplates, setTopTemplates] = useState([]);
  const [securityStats, setSecurityStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [bugData, setBugData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const perf = usePerformance();
  const draftRef = useRef(null);
  const listRef = useRef(null);

  // ──── Data Loading ────
  const loadData = useCallback(async () => {
    try {
      const [inboxRes, slaRes] = await Promise.all([
        fetch('/api/helpdesk/inbox'),
        fetch('/api/helpdesk/sla'),
      ]);
      if (inboxRes.ok) setTickets((await inboxRes.json()).tickets || []);
      if (slaRes.ok) setSLA(await slaRes.json());
    } catch (err) { console.error('Load failed:', err); }
    finally { setInitialLoading(false); }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const [insRes, kbRes, tplRes, secRes, anaRes, bugRes, churnRes] = await Promise.all([
        fetch('/api/helpdesk/insights'),
        fetch('/api/helpdesk/kb'),
        fetch('/api/helpdesk/templates'),
        fetch('/api/helpdesk/security'),
        fetch('/api/helpdesk/analytics'),
        fetch('/api/helpdesk/bugs'),
        fetch('/api/helpdesk/churn'),
      ]);
      if (insRes.ok) setInsights(await insRes.json());
      if (kbRes.ok) setKBArticles((await kbRes.json()).articles || []);
      if (tplRes.ok) setTopTemplates((await tplRes.json()).templates || []);
      if (secRes.ok) setSecurityStats(await secRes.json());
      if (anaRes.ok) setAnalytics(await anaRes.json());
      if (bugRes.ok) setBugData(await bugRes.json());
      if (churnRes.ok) setChurnData(await churnRes.json());
    } catch (err) { console.error('Insights load failed:', err); }
  }, []);

  useEffect(() => { loadData(); loadInsights(); }, [loadData, loadInsights]);

  // ──── Register Service Worker (offline mode) ────
  useEffect(() => {
    registerOfflineSW();
  }, []);

  // Auto-refresh — adapt interval based on connection
  useEffect(() => {
    // Don't auto-refresh on very slow connections to save bandwidth
    if (perf.isVerySlow) return;

    const interval = perf.isSlow ? 60000 : 30000; // 1min on slow, 30s otherwise
    const i = setInterval(loadData, interval);
    return () => clearInterval(i);
  }, [loadData, perf.isSlow, perf.isVerySlow]);

  // ──── Network Change Handler (4G → 2G during use) ────
  useEffect(() => {
    return watchNetworkChanges(change => {
      if (change.type === 'downgrade') {
        pushError(
          { message: `Network downgraded to ${change.to}` },
          'network-change'
        );
      } else if (change.type === 'offline') {
        pushError(
          { message: 'Connection lost. Retrying when back online...' },
          'offline'
        );
      } else if (change.type === 'online') {
        // Reload data when back online
        loadData();
      }
    });
  }, [loadData]);

  // ──── Ticket Selection ────
  function selectTicket(index) {
    if (index < 0 || index >= tickets.length) return;
    setSelectedIndex(index);
    setSelected(tickets[index]);
    setDraft('');
    setSelectedTeam(tickets[index].ai?.team || 'support');
  }

  // ──── AI Reply Generation ────
  async function generateReply() {
    if (!selected) return;

    // Optimistic: show loading immediately
    setAiLoading(true);
    setDraft('// Generating AI reply...');

    try {
      const timeout = perf.getActionTimeout();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch('/api/helpdesk/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selected.id }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const data = await res.json();
      setDraft(data.reply || '// No AI response available');
      if (data.senderName) setSelected(prev => ({ ...prev, senderName: data.senderName }));
    } catch (err) {
      if (err.name === 'AbortError') {
        setDraft('// Request timed out — please try again');
      } else {
        setDraft('// AI unavailable — please write a manual response');
      }
    }
    finally { setAiLoading(false); }
  }

  // ──── Send Reply ────
  async function sendReply() {
    if (!selected || !draft.trim()) return;

    // Optimistic: show sending immediately
    setSendLoading(true);

    try {
      const timeout = perf.getActionTimeout();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch('/api/helpdesk/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selected.id, message: draft, team: selectedTeam }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (res.ok) {
        setSelected(null);
        setSelectedIndex(-1);
        setDraft('');
        loadData();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Send failed:', err);
      }
    }
    finally { setSendLoading(false); }
  }

  // ──── Apply Template ────
  function applyTemplate(templateText) {
    if (selected) {
      setDraft(templateText.replace(/\{\{name\}\}/g, selected.senderName || 'there'));
    }
  }

  // ──── Keyboard Shortcuts ────
  useEffect(() => {
    function handleKey(e) {
      // Don't capture when typing in textarea
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          sendReply();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'j': // Next
          e.preventDefault();
          selectTicket(Math.min(selectedIndex + 1, tickets.length - 1));
          break;
        case 'k': // Previous
          e.preventDefault();
          selectTicket(Math.max(selectedIndex - 1, 0));
          break;
        case 'enter': // Open
          e.preventDefault();
          if (selectedIndex >= 0) selectTicket(selectedIndex);
          break;
        case 'a': // AI reply
          e.preventDefault();
          generateReply();
          break;
        case 's': // Focus search
          e.preventDefault();
          document.querySelector('[data-search]')?.focus();
          break;
        case 'escape': // Deselect
          setSelected(null);
          setSelectedIndex(-1);
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, tickets, selected, draft]);

  // ──── Ingest Demo ────
  async function ingestTest() {
    await fetch('/api/helpdesk/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emails: [
          { from: 'Mario Rossi <mario@gmail.com>', subject: 'Cannot access lab', body: 'Hi, connection refused for 1 hour. Urgent for interview tomorrow.', priority: 4 },
          { from: 'client@company.io', subject: 'Double charge on card', body: 'Charged twice for Pro subscription on April 1st and 3rd.', priority: 3 },
          { from: 'dev@startup.co', subject: 'Docker compose support', body: 'Would love docker-compose.yml in Linux labs.', priority: 1 },
          { from: 'spam123@sketchy.xyz', subject: 'BUY CRYPTO NOW!!!', body: 'click here for free bitcoin', priority: 0 },
        ],
      }),
    });
    loadData(); loadInsights();
  }

  // ──── Filter tickets ────
  const filteredTickets = searchQuery
    ? tickets.filter(t =>
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.from.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tickets;

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  // Show skeleton on initial load (instant perceived speed)
  if (initialLoading) {
    return <SkeletonDashboard />;
  }

  // Connection quality indicator (only on slow connections)
  const showSlowWarning = perf.isSlow && !initialLoading;

  return (
    <div className="flex h-screen bg-[#0b0f14] text-[#e5e7eb] text-[13px]">

      {/* Connection warning bar */}
      {showSlowWarning && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-600/20 border-b border-yellow-600/30 px-3 py-1 text-[10px] text-yellow-400 text-center z-50">
          🐢 Slow connection detected — reduced data mode active
        </div>
      )}

      <div className={`flex h-screen bg-[#0b0f14] text-[#e5e7eb] text-[13px] ${showSlowWarning ? 'mt-5' : ''}`}>

      {/* ═══ COLUMN 1: Sidebar ═══ */}
      <div className="w-48 border-r border-[#1f2937] flex flex-col bg-[#111827]">
        <div className="px-3 py-3 border-b border-[#1f2937]">
          <div className="font-bold text-sm">🛡️ WINLAB</div>
          <div className="text-[10px] text-[#9ca3af]">Helpdesk AI</div>
        </div>

        <nav className="flex-1 py-2">
          {[
            { id: 'inbox', icon: '📬', label: 'Inbox' },
            { id: 'analytics', icon: '📊', label: 'Analytics' },
            { id: 'bugs', icon: '🚨', label: 'Bug Detection' },
            { id: 'churn', icon: '⚠️', label: 'Churn Risk' },
            { id: 'insights', icon: '💡', label: 'Insights' },
            { id: 'kb', icon: '📚', label: 'Knowledge Base' },
            { id: 'templates', icon: '📝', label: 'Templates' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                view === item.id ? 'bg-slate-800 text-white' : 'text-[#9ca3af] hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar stats */}
        {sla && view === 'inbox' && (
          <div className="px-3 py-2 border-t border-[#1f2937] text-[10px] text-[#9ca3af] space-y-1">
            <div>🔵 Open: {sla.tickets?.open || 0}</div>
            <div>🟡 Pending: {sla.tickets?.pending || 0}</div>
            <div>✅ Resolved: {sla.tickets?.resolved || 0}</div>
            <div>🤖 AI: {sla.ai?.avgConfidence ? Math.round(sla.ai.avgConfidence * 100) : 0}%</div>
          </div>
        )}
      </div>

      {/* ═══ COLUMN 2: Inbox List ═══ */}
      <div className="w-80 border-r border-[#1f2937] flex flex-col bg-[#0b0f14]">

        {/* Top bar */}
        <div className="px-3 py-2 border-b border-[#1f2937] flex items-center justify-between">
          <input
            data-search
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-xs text-white w-36 focus:border-blue-600 focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button onClick={loadData} className="text-xs text-[#9ca3af] hover:text-white">↺</button>
            <button onClick={ingestTest} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded">+Demo</button>
          </div>
        </div>

        {/* Top bar metrics */}
        <div className="px-3 py-1.5 border-b border-[#1f2937] text-[10px] text-[#9ca3af] flex gap-3 bg-[#111827]">
          <span>Queue: {sla?.queue?.waiting || 0}</span>
          <span>Auto: {sla?.queue?.completed || 0}</span>
          <span>AI: {sla?.ai?.avgConfidence ? Math.round(sla.ai.avgConfidence * 100) : 0}%</span>
        </div>

        {/* Email list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-6 text-center text-[#9ca3af] text-xs">No tickets. Click +Demo</div>
          ) : (
            filteredTickets.map((ticket, idx) => (
              <EmailRow
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedIndex === tickets.indexOf(ticket)}
                onClick={() => {
                  const realIdx = tickets.indexOf(ticket);
                  selectTicket(realIdx);
                }}
              />
            ))
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-3 py-1.5 border-t border-[#1f2937] text-[9px] text-[#6b7280] flex gap-2">
          <span>J/K nav</span><span>Enter open</span><span>A AI</span><span>⌘↵ send</span>
        </div>
      </div>

      {/* ═══ COLUMN 3: Thread Detail / View ═══ */}
      <div className="flex-1 flex flex-col bg-[#0b0f14]">

        {view === 'inbox' && selected ? (
          <>
            {/* Ticket Header */}
            <div className="px-5 py-3 border-b border-[#1f2937]">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">{selected.subject}</h3>
                <StatusBadge status={selected.status} />
                {selected.ai?.team && <TeamBadge team={selected.ai.team} />}
                {selected.action && <ActionBadge action={selected.action} />}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#9ca3af]">
                <span>From: {selected.from}</span>
                {selected.senderName && <span className="text-blue-400">👤 {selected.senderName}</span>}
                {selected.trust && <TrustBadge level={selected.trust.level} score={selected.trust.score} />}
                <SLATimer createdAt={selected.createdAt} />
              </div>

              {/* AI info bar */}
              {selected.ai && (
                <div className="mt-2 flex items-center gap-4 text-[10px] text-[#9ca3af] bg-[#111827] rounded px-3 py-1.5">
                  <span>🎯 {selected.ai.intent}</span>
                  <span>🌐 {selected.ai.language.toUpperCase()}</span>
                  <span>⚡ {selected.ai.urgency}</span>
                  <span className="flex-1"><ConfidenceBar confidence={selected.ai.confidence} /></span>
                </div>
              )}
            </div>

            {/* Original Message */}
            <div className="px-5 py-3 bg-[#111827]/50 border-b border-[#1f2937]">
              <p className="text-[10px] text-[#9ca3af] mb-1.5 font-semibold uppercase tracking-wider">Original Message</p>
              <div className="text-xs text-[#e5e7eb] whitespace-pre-wrap">{selected.body || selected.snippet || '(No content)'}</div>
            </div>

            {/* Reply Area */}
            <div className="flex-1 flex flex-col px-5 py-3 gap-2">

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button onClick={generateReply} disabled={aiLoading}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 px-2.5 py-1 rounded text-[11px] transition-colors disabled:opacity-50">
                  {aiLoading ? '⏳...' : '🤖 AI'}
                </button>
                <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}
                  className="bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-[11px] text-[#9ca3af] focus:border-blue-600 focus:outline-none">
                  <option value="support">🛠️ Support</option>
                  <option value="billing">💰 Billing</option>
                  <option value="sales">🤝 Sales</option>
                  <option value="legal">⚖️ Legal</option>
                  <option value="security">🔒 Security</option>
                </select>
                <span className="text-[10px] text-[#6b7280] ml-auto">AI suggests → you approve</span>
              </div>

              {/* Template suggestions */}
              {selected.templateSuggestions && selected.templateSuggestions.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[10px] text-[#6b7280]">💡</span>
                  {selected.templateSuggestions.slice(0, 3).map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => applyTemplate(tpl.preview)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-2 py-0.5 text-[#9ca3af] transition-colors"
                    >
                      {tpl.preview.slice(0, 40)}... ({tpl.uses}x)
                    </button>
                  ))}
                </div>
              )}

              {/* Draft */}
              <textarea
                ref={draftRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendReply(); } }}
                className="flex-1 bg-[#111827] border border-[#1f2937] rounded-lg p-3 text-xs text-white resize-none focus:border-blue-600 focus:outline-none"
                placeholder="Write response... (A for AI, ⌘+Enter send)"
              />

              {/* Send */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6b7280]">⌘ + Enter to send</span>
                <button onClick={sendReply} disabled={!draft.trim() || sendLoading}
                  className="bg-white text-black hover:bg-slate-200 px-5 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {sendLoading ? '⏳ Sending...' : '✅ Approva & Invia'}
                </button>
              </div>
            </div>
          </>
        ) : view === 'inbox' ? (
          <div className="flex-1 flex items-center justify-center text-[#6b7280]">
            <div className="text-center">
              <span className="text-3xl block mb-2">📬</span>
              <p className="text-xs">Select a ticket (J/K to navigate)</p>
            </div>
          </div>
        ) : view === 'insights' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">💡 Business Insights</h2>
            {insights?.insights?.map((ins, i) => (
              <div key={i} className={`p-3 rounded-lg mb-2 border ${
                ins.severity === 'high' ? 'bg-red-600/10 border-red-600/20 text-red-400' :
                ins.severity === 'medium' ? 'bg-yellow-600/10 border-yellow-600/20 text-yellow-400' :
                'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                {ins.message}
              </div>
            ))}
            {insights?.clusters?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-xs mb-2">📊 Ticket Clusters</h3>
                {insights.clusters.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-800 rounded mb-1">
                    <span className="text-xs">{c.topic}</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
            {!insights && <p className="text-[#9ca3af] text-xs">No insights yet. Ingest tickets first.</p>}
          </div>
        ) : view === 'kb' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">📚 Knowledge Base</h2>
            {kbArticles.length > 0 ? kbArticles.map(a => (
              <div key={a.id} className="p-3 bg-slate-800 rounded mb-2 border border-slate-700">
                <div className="font-medium text-xs mb-1">{a.title}</div>
                <div className="text-[11px] text-[#9ca3af]">{a.solution?.slice(0, 150)}...</div>
                <div className="flex gap-2 mt-2 text-[10px] text-[#6b7280]">
                  <span>{a.intent}</span><span>{a.lang}</span><span>{a.team}</span>
                  <span>{a.uses} uses</span>
                </div>
              </div>
            )) : <p className="text-[#9ca3af] text-xs">No KB articles yet. Reply to more tickets to auto-generate.</p>}
          </div>
        ) : view === 'templates' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">📝 Top Templates</h2>
            {topTemplates.length > 0 ? topTemplates.map(t => (
              <div key={t.id} className="p-3 bg-slate-800 rounded mb-2 border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">{t.intent}</span>
                  <span className="text-[10px] text-[#6b7280]">{t.uses}x · {t.successRate}% ✓</span>
                </div>
                <div className="text-[11px] text-[#9ca3af]">{t.preview}</div>
                <div className="flex gap-2 mt-2 text-[10px] text-[#6b7280]">
                  <span>{t.team}</span><span>{t.lang}</span>{t.isAuto && <span className="text-blue-400">auto</span>}
                </div>
              </div>
            )) : <p className="text-[#9ca3af] text-xs">No templates yet. They populate as you use the system.</p>}

            {securityStats && (
              <div className="mt-6">
                <h3 className="font-semibold text-xs mb-2">🔒 Security Stats</h3>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-800 p-2 rounded">Blacklisted: {securityStats.security?.blacklistCount || 0}</div>
                  <div className="bg-slate-800 p-2 rounded">Rate limits: {securityStats.security?.rateLimitEntries || 0}</div>
                  <div className="bg-slate-800 p-2 rounded">Cache items: {securityStats.cache?.totalItems || 0}</div>
                  <div className="bg-slate-800 p-2 rounded">Cache uses: {securityStats.cache?.totalUses || 0}</div>
                </div>
              </div>
            )}
          </div>
        ) : view === 'analytics' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">📊 Analytics</h2>

            {/* KPI Cards */}
            {analytics?.kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Total', value: analytics.kpis.total, color: 'text-white' },
                  { label: 'Auto', value: `${analytics.kpis.autoRate}%`, color: 'text-green-400' },
                  { label: 'AI Conf', value: analytics.kpis.avgConfidence, color: 'text-blue-400' },
                  { label: 'Edit Rate', value: `${analytics.kpis.editRate}%`, color: 'text-yellow-400' },
                  { label: 'Avg Trust', value: analytics.kpis.avgTrustScore, color: analytics.kpis.avgTrustScore > 60 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Anomalies', value: analytics.kpis.anomalyCount, color: 'text-red-400' },
                  { label: 'Draft', value: analytics.kpis.draftCount, color: 'text-yellow-400' },
                  { label: 'Blocked', value: analytics.kpis.blockCount, color: 'text-red-500' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="text-[10px] text-[#9ca3af] uppercase">{kpi.label}</div>
                    <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Time Series (bar chart using CSS) */}
            {analytics?.timeSeries && analytics.timeSeries.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-xs mb-2">📈 Volume (7 days)</h3>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-end gap-1 h-24">
                    {analytics.timeSeries.map((d, i) => {
                      const max = Math.max(...analytics.timeSeries.map(t => t.count), 1);
                      const height = Math.max(4, (d.count / max) * 96);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full bg-blue-600 rounded-t" style={{ height: `${height}px` }} title={`${d.count} emails`} />
                          <span className="text-[8px] text-[#6b7280]">{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Decision Breakdown */}
            {analytics?.byDecision && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <h4 className="text-[10px] text-[#9ca3af] uppercase mb-2">Decisions</h4>
                  {analytics.byDecision.map(d => (
                    <div key={d.label} className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#e5e7eb]">{d.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.percentage}%` }} />
                        </div>
                        <span className="text-[#9ca3af] w-12 text-right">{d.count} ({d.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                  <h4 className="text-[10px] text-[#9ca3af] uppercase mb-2">Top Intents</h4>
                  {analytics.byIntent?.slice(0, 5).map(d => (
                    <div key={d.label} className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#e5e7eb]">{d.label}</span>
                      <span className="text-[#9ca3af]">{d.count} ({d.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : view === 'bugs' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">🚨 Bug Detection</h2>

            {/* Spike Alerts */}
            {bugData?.spikes && bugData.spikes.length > 0 ? (
              bugData.spikes.map((spike, i) => (
                <div key={i} className={`p-3 rounded-lg mb-2 border ${
                  spike.severity === 'critical' ? 'bg-red-600/10 border-red-600/30' :
                  spike.severity === 'high' ? 'bg-orange-600/10 border-orange-600/30' :
                  'bg-yellow-600/10 border-yellow-600/30'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{spike.severity.toUpperCase()} — {spike.intent}</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded">+{spike.increasePercent}%</span>
                  </div>
                  <div className="text-[11px] text-[#9ca3af]">
                    {spike.currentCount} tickets in {spike.windowHours}h (avg: {spike.baselineAvg}/day)
                  </div>
                  {spike.deployCorrelation && (
                    <div className="mt-1 text-[11px] text-orange-400">
                      🚀 Correlated with deploy {spike.deployCorrelation.version} ({spike.deployCorrelation.timeSinceDeploy} ago)
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
                <span className="text-2xl block mb-2">✅</span>
                <p className="text-[#9ca3af] text-xs">No spikes detected</p>
              </div>
            )}

            {/* Deploy History */}
            {bugData?.deploys && bugData.deploys.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-xs mb-2">🚀 Recent Deploys</h3>
                {bugData.deploys.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-800 rounded mb-1 text-[11px]">
                    <span className="text-[#e5e7eb] font-mono">{d.version}</span>
                    <span className="text-[#9ca3af]">{d.environment}</span>
                    <span className="text-[#6b7280]">{new Date(d.deployedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : view === 'churn' ? (
          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="font-bold text-sm mb-4">⚠️ Churn Risk</h2>

            {/* Churn Stats */}
            {churnData?.stats && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{churnData.stats.high}</div>
                  <div className="text-[10px] text-red-400 uppercase">HIGH RISK</div>
                </div>
                <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{churnData.stats.medium}</div>
                  <div className="text-[10px] text-yellow-400 uppercase">MEDIUM</div>
                </div>
                <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{churnData.stats.low}</div>
                  <div className="text-[10px] text-green-400 uppercase">LOW</div>
                </div>
              </div>
            )}

            {/* At-Risk Users */}
            {churnData?.atRisk && churnData.atRisk.length > 0 ? (
              <div>
                <h3 className="font-semibold text-xs mb-2">Users at Risk</h3>
                {churnData.atRisk.slice(0, 20).map((user, i) => (
                  <div key={i} className={`p-2.5 rounded mb-1.5 border ${
                    user.churnLevel === 'high' ? 'bg-red-600/10 border-red-600/30' :
                    user.churnLevel === 'medium' ? 'bg-yellow-600/10 border-yellow-600/30' :
                    'bg-slate-800 border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{user.email}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">{user.plan}</span>
                        <span className={`text-xs font-bold ${
                          user.churnScore >= 70 ? 'text-red-400' :
                          user.churnScore >= 40 ? 'text-yellow-400' : 'text-green-400'
                        }`}>{user.churnScore}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#9ca3af] flex gap-3">
                      <span>📩 {user.tickets} tickets</span>
                      <span>🔓 {user.openTickets} open</span>
                      {user.repeatIssues?.length > 0 && <span>🔁 {user.repeatIssues.length} repeat</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
                <p className="text-[#9ca3af] text-xs">No churn risk data yet. Users will appear after ticket activity.</p>
              </div>
            )}

            {/* By Plan */}
            {churnData?.stats?.byPlan && Object.keys(churnData.stats.byPlan).length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-xs mb-2">Risk by Plan</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(churnData.stats.byPlan).map(([plan, data]) => (
                    <div key={plan} className="bg-slate-800 rounded p-2 text-[11px]">
                      <div className="font-medium text-[#e5e7eb] capitalize">{plan}</div>
                      <div className="text-[#9ca3af]">{data.count} users · avg {data.avgScore} risk</div>
                      <div className="text-red-400">{data.highRiskPercent}% high risk</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      </div> {/* wrapper for slow connection offset */}

      {/* Error Toast — global error notifications */}
      <ErrorToast />

      {/* Offline Status Bar — bottom bar showing sync state */}
      <OfflineStatusBar />
    </div>
  );
}
