import { useEffect, useMemo, useState } from 'react';
import { Bug, Lightbulb, Server, ShieldAlert, ThumbsUp } from 'lucide-react';

function PageNav() {
  return (
    <nav className="winlab-public-nav">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Server className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <div className="winlab-public-nav-links">
        <a href="/" className="text-xs text-gray-500 transition-colors hover:text-white">Back</a>
      </div>
    </nav>
  );
}

const TYPE_META = {
  feature: {
    title: 'Feature Request',
    icon: Lightbulb,
    accent: 'text-emerald-400',
  },
  bug: {
    title: 'Bug Report',
    icon: Bug,
    accent: 'text-red-400',
  },
};

export default function FeedbackPage() {
  const [viewer, setViewer] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('feature');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    type: 'feature',
    title: '',
    body: '',
    labId: '',
    severity: 'medium',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [userRes, postsRes] = await Promise.all([
          fetch('/api/user/me', { credentials: 'include' }),
          fetch('/api/community/posts', { credentials: 'include' }),
        ]);

        if (!cancelled) {
          if (userRes.ok) {
            const userData = await userRes.json().catch(() => null);
            setViewer(userData);
          } else {
            setViewer(null);
          }

          if (postsRes.ok) {
            const postsData = await postsRes.json().catch(() => []);
            setCommunityPosts(Array.isArray(postsData) ? postsData : []);
          } else {
            setCommunityPosts([]);
          }
        }
      } catch {
        if (!cancelled) {
          setViewer(null);
          setCommunityPosts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const filteredPosts = useMemo(
    () => communityPosts.filter((post) => post.type === activeTab).slice(0, 8),
    [communityPosts, activeTab],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!viewer) {
      setMessage('Sign in from the dashboard before submitting feedback.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const endpoint = form.type === 'bug' ? '/api/community/bugs' : '/api/community/posts';
      const payload = form.type === 'bug'
        ? { title: form.title, body: form.body, labId: form.labId, severity: form.severity }
        : { type: 'feature', title: form.title, body: form.body, labId: form.labId, severity: form.severity };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || 'Unable to submit feedback.');
        return;
      }

      const refresh = await fetch('/api/community/posts', { credentials: 'include' });
      const postsData = await refresh.json().catch(() => []);
      setCommunityPosts(Array.isArray(postsData) ? postsData : []);
      setForm({ type: form.type, title: '', body: '', labId: '', severity: 'medium' });
      setActiveTab(form.type);
      setMessage(form.type === 'bug' ? 'Bug report submitted.' : 'Feature request submitted.');
    } catch {
      setMessage('Network error while submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-6xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">Community</p>
          <h1 className="winlab-public-title">Feedback</h1>
          <p className="winlab-public-copy mb-8">
            Report a bug, request a feature, or review what operators are asking for without forcing a dense forum layout onto mobile.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <section className="winlab-public-card sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Submit Feedback</h2>
                <p className="text-sm text-gray-500">Choose the right channel so the request lands in the existing community workflow.</p>
              </div>
              {!viewer && (
                <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-yellow-400">
                  <ShieldAlert className="w-4 h-4" />
                  Sign in required
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(TYPE_META).map(([type, meta]) => {
                  const Icon = meta.icon;
                  const active = form.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, type }))}
                      className={`min-h-[48px] rounded-2xl border px-4 py-4 text-left transition-all ${
                        active ? 'border-red-500/30 bg-red-600/10 text-white' : 'border-white/8 bg-black/30 text-gray-400 hover:border-white/15'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-3 ${active ? 'text-red-400' : meta.accent}`} />
                      <div className="text-xs font-black uppercase tracking-widest">{meta.title}</div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  className="min-h-[44px] w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                  placeholder={form.type === 'bug' ? 'Short summary of the issue' : 'What should WinLab add or improve?'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Lab ID</label>
                  <input
                    value={form.labId}
                    onChange={(e) => setForm((current) => ({ ...current, labId: e.target.value }))}
                    className="min-h-[44px] w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                    placeholder="Optional: nginx-port-conflict"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((current) => ({ ...current, severity: e.target.value }))}
                    className="min-h-[44px] w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Details</label>
                <textarea
                  rows={7}
                  value={form.body}
                  onChange={(e) => setForm((current) => ({ ...current, body: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/30"
                  placeholder="Describe the bug, missing workflow, expected behavior, reproduction steps, or context."
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className={`text-sm ${message && !message.endsWith('submitted.') ? 'text-red-400' : 'text-emerald-400'}`}>{message}</span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[48px] rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Send Feedback'}
                </button>
              </div>
            </form>
          </section>

          <section className="winlab-public-card sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Recent Posts</h2>
                <p className="text-sm text-gray-500">Latest community items already tracked by the backend.</p>
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto">
              {Object.entries(TYPE_META).map(([type, meta]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveTab(type)}
                  className={`min-h-[44px] whitespace-nowrap px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === type ? 'bg-red-600 text-white' : 'bg-black border border-white/8 text-gray-500 hover:text-white'
                  }`}
                >
                  {meta.title}
                </button>
              ))}
            </div>

            {loading && (
              <div className="text-sm text-gray-500">Loading community items...</div>
            )}

            {!loading && filteredPosts.length === 0 && (
              <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-sm text-gray-500">
                No {activeTab} posts yet.
              </div>
            )}

            <div className="space-y-3">
              {filteredPosts.map((post) => {
                const meta = TYPE_META[post.type] || TYPE_META.feature;
                const Icon = meta.icon;
                return (
                  <div key={post.id} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${meta.accent}`} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-tight">{post.title}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-1">
                            {meta.title}{post.labId ? ` · ${post.labId}` : ''}{post.severity ? ` · ${post.severity}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs text-gray-500 shrink-0">
                        <ThumbsUp className="w-4 h-4" />
                        {post.votes ?? 0}
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{post.body || 'No extra details provided.'}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
