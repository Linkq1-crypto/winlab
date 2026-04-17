/**
 * HelpdeskPage — Enterprise AI Helpdesk
 *
 * Features:
 * - AI-suggested replies with human approval
 * - Trust score badges (anti-phishing)
 * - Confidence indicators
 * - Team auto-routing
 * - Name extraction (personalized greetings)
 * - SLA live timer
 * - Cmd+Enter to send
 * - Multi-language support
 */

import { useEffect, useState, useRef, useCallback } from 'react';

// ──── Trust Badge ────
function TrustBadge({ level, score }) {
  const config = {
    high: { icon: '🟢', label: 'Verified', cls: 'bg-green-600/20 text-green-400 border-green-600/30' },
    medium: { icon: '🟡', label: 'Medium', cls: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' },
    low: { icon: '🔴', label: 'Low Trust', cls: 'bg-red-600/20 text-red-400 border-red-600/30' },
  };
  const c = config[level] || config.medium;

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${c.cls} font-medium`}>
      {c.icon} {c.label} ({score})
    </span>
  );
}

// ──── Confidence Bar ────
function ConfidenceBar({ confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{pct}%</span>
    </div>
  );
}

// ──── Status Badge ────
function StatusBadge({ status }) {
  const styles = {
    open: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    pending: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
    resolved: 'bg-green-600/20 text-green-400 border-green-600/30',
  };
  const style = styles[status] || styles.open;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border uppercase ${style}`}>
      {status}
    </span>
  );
}

// ──── Team Badge ────
function TeamBadge({ team }) {
  const icons = {
    support: '🛠️',
    billing: '💰',
    sales: '🤝',
    legal: '⚖️',
    security: '🔒',
  };
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
      {icons[team] || '📋'} {team}
    </span>
  );
}

// ──── Action Badge ────
function ActionBadge({ action }) {
  const config = {
    auto: { label: 'Auto OK', cls: 'bg-green-600/20 text-green-400' },
    draft: { label: 'Review', cls: 'bg-yellow-600/20 text-yellow-400' },
    manual: { label: 'Manual', cls: 'bg-slate-700 text-slate-400' },
    block: { label: 'Blocked', cls: 'bg-red-600/20 text-red-400' },
  };
  const c = config[action] || config.manual;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

// ──── SLA Timer ────
function SLATimer({ createdAt }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - createdAt;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      setElapsed(hours > 0 ? `${hours}h ${mins % 60}m` : `${mins}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const diff = Date.now() - createdAt;
  const mins = Math.floor(diff / 60000);
  const color = mins > 120 ? 'text-red-400' : mins > 60 ? 'text-yellow-400' : 'text-slate-500';

  return <span className={`text-xs font-mono ${color}`}>⏱ {elapsed}</span>;
}

// ──── URGENCY Indicator ────
function UrgencyIndicator({ urgency }) {
  const config = {
    critical: { icon: '🚨', label: 'CRITICAL', cls: 'text-red-500' },
    high: { icon: '🔴', label: 'URGENT', cls: 'text-red-400' },
    normal: { icon: '🟢', label: '', cls: 'text-slate-500' },
    low: { icon: '🔵', label: 'Low', cls: 'text-blue-400' },
  };
  const c = config[urgency] || config.normal;
  if (!c.label && urgency === 'normal') return null;
  return <span className={`text-[10px] ${c.cls}`}>{c.icon} {c.label}</span>;
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export default function HelpdeskPage() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sla, setSLA] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('support');
  const draftRef = useRef(null);

  // ──── Load inbox ────
  const loadInbox = useCallback(async () => {
    try {
      const [inboxRes, slaRes, metricsRes] = await Promise.all([
        fetch('/api/helpdesk/inbox'),
        fetch('/api/helpdesk/sla'),
        fetch('/api/helpdesk/metrics'),
      ]);
      if (inboxRes.ok) setTickets((await inboxRes.json()).tickets || []);
      if (slaRes.ok) setSLA(await slaRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const interval = setInterval(loadInbox, 30000);
    return () => clearInterval(interval);
  }, [loadInbox]);

  // ──── Generate AI reply ────
  async function generateReply() {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/helpdesk/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selected.id }),
      });
      const data = await res.json();
      setDraft(data.reply || '');
      if (data.senderName) setSelected(prev => ({ ...prev, senderName: data.senderName }));
      if (data.team) setSelectedTeam(data.team);
    } catch (err) {
      console.error('AI reply failed:', err);
      setDraft('// AI unavailable — please write a manual response');
    } finally {
      setAiLoading(false);
    }
  }

  // ──── Send reply ────
  async function sendReply() {
    if (!selected || !draft.trim()) return;
    setSendLoading(true);
    try {
      const res = await fetch('/api/helpdesk/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selected.id,
          message: draft,
          team: selectedTeam,
        }),
      });
      if (res.ok) {
        setSelected(null);
        setDraft('');
        loadInbox();
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSendLoading(false);
    }
  }

  // ──── Cmd+Enter shortcut ────
  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendReply();
    }
  }

  // ──── Ingest demo tickets ────
  async function ingestTest() {
    try {
      await fetch('/api/helpdesk/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: [
            {
              from: 'Mario Rossi <mario@gmail.com>',
              subject: 'Cannot access my lab environment',
              body: 'Hi, I\'ve been trying to log in for the past hour but keep getting "connection refused" when I try to access the Linux terminal lab. This is urgent as I need it for a job interview tomorrow. Please help!',
              priority: 4,
            },
            {
              from: 'client@company.io',
              subject: 'Billing question — double charge',
              body: 'Hello, I noticed I was charged twice for my Pro subscription this month. Can you check my account? The charges are on my credit card statement from April 1st and April 3rd.',
              priority: 3,
            },
            {
              from: 'dev@startup.co',
              subject: 'Feature request: Docker compose support',
              body: 'Would love to see docker-compose.yml support in the Linux labs. It would make the learning experience much better.',
              priority: 1,
            },
            {
              from: 'spam123@sketchy.xyz',
              subject: 'BUY CRYPTO NOW!!!',
              body: 'click here for free bitcoin',
              priority: 0,
            },
          ],
        }),
      });
      loadInbox();
    } catch (err) {
      console.error('Ingest failed:', err);
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white">

      {/* ═══════════ LEFT: Ticket List ═══════════ */}
      <div className="w-80 border-r border-slate-800 flex flex-col">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm">📬 Helpdesk</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setRefreshing(true); loadInbox(); }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                {refreshing ? '↻' : '↺'}
              </button>
              <button
                onClick={ingestTest}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition-colors"
              >
                + Demo
              </button>
            </div>
          </div>
          {sla && (
            <div className="flex gap-3 text-[10px] text-slate-500">
              <span>🔵 {sla.tickets?.open || 0} open</span>
              <span>🟡 {sla.tickets?.pending || 0} pending</span>
              <span>✅ {sla.ai?.avgConfidence ? `${Math.round(sla.ai.avgConfidence * 100)}% AI` : ''}</span>
            </div>
          )}
        </div>

        {/* Metrics bar */}
        {metrics && (
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/30 text-[10px] text-slate-500 flex gap-3">
            <span>Queue: {metrics.queue?.waiting || 0}</span>
            <span>Done: {metrics.queue?.completed || 0}</span>
            <span>Replies today: {metrics.repliesToday || 0}</span>
          </div>
        )}

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto">
          {tickets.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-xs">
              No tickets yet. Click "+ Demo" to load test data.
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => {
                  setSelected(ticket);
                  setDraft('');
                  setSelectedTeam(ticket.ai?.team || 'support');
                }}
                className={`p-3 border-b border-slate-800 cursor-pointer transition-colors hover:bg-slate-900/50 ${
                  selected?.id === ticket.id ? 'bg-slate-800/60' : ''
                }`}
              >
                {/* Top row: priority + action */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">
                    {ticket.priority >= 4 ? '🔴' : ticket.priority >= 2 ? '🟡' : '🟢'} P{ticket.priority}
                  </span>
                  {ticket.action && <ActionBadge action={ticket.action} />}
                </div>

                {/* From + trust */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-slate-400 truncate">
                    {ticket.senderName || ticket.from}
                  </span>
                  {ticket.trust && <TrustBadge level={ticket.trust.level} score={ticket.trust.score} />}
                </div>

                {/* Subject */}
                <div className="text-sm font-medium truncate mb-1">{ticket.subject}</div>

                {/* Bottom row: team + SLA */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {ticket.ai?.team && <TeamBadge team={ticket.ai.team} />}
                    {ticket.ai?.urgency && ticket.ai.urgency !== 'normal' && (
                      <UrgencyIndicator urgency={ticket.ai.urgency} />
                    )}
                  </div>
                  <SLATimer createdAt={ticket.createdAt} />
                </div>

                {/* Confidence bar */}
                {ticket.ai?.confidence != null && (
                  <div className="mt-1">
                    <ConfidenceBar confidence={ticket.ai.confidence} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════════ RIGHT: Detail + Reply ═══════════ */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* Ticket Header */}
            <div className="px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-bold text-base">{selected.subject}</h3>
                <StatusBadge status={selected.status} />
                {selected.ai?.team && <TeamBadge team={selected.ai.team} />}
                {selected.ai?.urgency && selected.ai.urgency !== 'normal' && (
                  <UrgencyIndicator urgency={selected.ai.urgency} />
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>From: {selected.from}</span>
                {selected.senderName && <span className="text-blue-400">👤 {selected.senderName}</span>}
                {selected.trust && <TrustBadge level={selected.trust.level} score={selected.trust.score} />}
                <SLATimer createdAt={selected.createdAt} />
              </div>

              {/* AI Info bar */}
              {selected.ai && (
                <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 bg-slate-900/50 rounded-lg px-3 py-2">
                  <span>🎯 Intent: <span className="text-slate-300">{selected.ai.intent}</span></span>
                  <span>🌐 Lang: <span className="text-slate-300 uppercase">{selected.ai.language}</span></span>
                  <span>⚡ Urgency: <span className="text-slate-300">{selected.ai.urgency}</span></span>
                  <span className="flex-1">
                    AI Confidence: <ConfidenceBar confidence={selected.ai.confidence} />
                  </span>
                  <span>Decision: <ActionBadge action={selected.action} /></span>
                </div>
              )}
            </div>

            {/* Original Email */}
            <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800">
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Original Message</p>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">
                {selected.body || selected.snippet || '(No content)'}
              </div>
            </div>

            {/* Reply Area */}
            <div className="flex-1 flex flex-col px-6 py-4 gap-3">

              {/* Controls row */}
              <div className="flex items-center gap-3">
                {/* AI Generate Button */}
                <button
                  onClick={generateReply}
                  disabled={aiLoading}
                  className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {aiLoading ? '⏳ Generating...' : '🤖 Generate AI Reply'}
                </button>

                {/* Team selector */}
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-blue-600 focus:outline-none"
                >
                  <option value="support">🛠️ Support</option>
                  <option value="billing">💰 Billing</option>
                  <option value="sales">🤝 Sales</option>
                  <option value="legal">⚖️ Legal</option>
                  <option value="security">🔒 Security</option>
                </select>

                <span className="text-[10px] text-slate-600 ml-auto">
                  AI suggests — you review & edit
                </span>
              </div>

              {/* Draft Textarea */}
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-white resize-none focus:border-blue-600 focus:outline-none transition-colors"
                placeholder="Write your response here... (or click 🤖 Generate AI Reply)"
              />

              {/* Send row */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">
                  ⌘ + Enter to send
                </span>
                <button
                  onClick={sendReply}
                  disabled={!draft.trim() || sendLoading}
                  className="bg-white text-black hover:bg-slate-200 px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendLoading ? '⏳ Sending...' : '✅ Approva & Invia'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <div className="text-center">
              <span className="text-4xl block mb-3">📬</span>
              <p className="text-sm">Select a ticket to view details and reply</p>
              <p className="text-xs text-slate-700 mt-1">AI classifies, suggests — you approve</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
