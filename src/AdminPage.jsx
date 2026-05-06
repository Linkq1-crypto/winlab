// AdminPage.jsx – Hidden admin panel: Dashboard + Blog Editor
// Route: /myrooting — not linked anywhere, blocked in robots.txt
// Has its own login (separate from site auth)
import { useState, useEffect, useCallback } from "react";
import LiveLeaderboard from "./components/LiveLeaderboard";
import SessionReplay from "./components/SessionReplay";
import { useLab } from "./LabContext";
import BudgetProgress from "./BudgetProgress";

// ── Admin credentials (change these!) ────────────────────────────────────────
const ADMIN_CREDENTIALS = {
  email: "admin@winlab.cloud",
  password: "winlab2026!",
};

const DEFAULT_ARTICLES = [
  {
    id: "01",
    tag: "Storage",
    tagColor: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    title: "The Art of the Rebuild",
    subtitle: "Why most RAID 5 recoveries fail — and how to fix them.",
    body: "Most engineers only discover RAID's quirks when a disk fails at 2 AM. The parity math is sound, but the recovery process is full of operator traps: wrong rebuild order, silent read errors on a second disk, filesystem inconsistencies post-sync. In this deep dive we walk through every failure mode and how the WINLAB RAID Simulator prepares you to handle each one.",
    readTime: "8 min read",
    published: true,
  },
  {
    id: "02",
    tag: "Terraform",
    tagColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    title: "Terraform State Hell",
    subtitle: "5 scenarios that will test your patience (and how WINLAB solves them).",
    body: "State file drift. Remote state locking deadlocks. Partial applies that leave infra in an unknown condition. Import loops. Destroy cascades. If you haven't lived through at least three of these in production, you haven't done enough Terraform. We built five lab scenarios that simulate each one in a safe environment.",
    readTime: "12 min read",
    published: true,
  },
  {
    id: "03",
    tag: "vSphere",
    tagColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    title: "vSphere Orchestration in 2026",
    subtitle: "Moving from GUI-clicking to Infrastructure as Code.",
    body: "The vSphere Web Client is comfortable. It's also how you build undocumented, unreproducible, untestable infrastructure. In 2026, the winning pattern is vsphere provider in Terraform + GitOps. This article covers the migration path and uses the WINLAB vSphere simulator to demonstrate live drift detection and remediation.",
    readTime: "10 min read",
    published: true,
  },
];

const TAG_OPTIONS = [
  { label: "Storage", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  { label: "Terraform", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  { label: "vSphere", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { label: "Linux", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  { label: "Security", color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { label: "Networking", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
];

function slugifyArticleTitle(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseStoredTags(rawTags) {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags !== "string" || !rawTags.trim()) return [];
  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

function findTagStyle(label) {
  return TAG_OPTIONS.find((entry) => entry.label.toLowerCase() === String(label || "").toLowerCase()) || TAG_OPTIONS[3];
}

function createEmptyBlogForm() {
  return {
    id: "",
    slug: "",
    title: "",
    excerpt: "",
    content: "",
    tagsInput: "Linux",
    published: true,
  };
}

function blogPostToForm(post) {
  const tags = parseStoredTags(post.tags);
  return {
    id: post.id,
    slug: post.slug || "",
    title: post.title || "",
    excerpt: post.excerpt || "",
    content: post.content || "",
    tagsInput: tags.join(", "),
    published: post.status === "published",
  };
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const planCounts = users
    ? users.reduce((acc, u) => { acc[u.plan] = (acc[u.plan] || 0) + 1; return acc; }, {})
    : {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
        <a
          href="/myrooting/telemetry"
          className="text-xs bg-slate-800 text-emerald-400 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500 transition"
        >
          📊 Telemetry
        </a>
      </div>

      {/* AI Budget Progress */}
      <BudgetProgress language="en" token={localStorage.getItem("winlab_token")} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Users", value: users?.length ?? "—" },
          { label: "PV (Starter)", value: planCounts.PV ?? "—" },
          { label: "PRO", value: planCounts.PRO ?? "—" },
          { label: "BUS", value: planCounts.BUS ?? "—" },
          { label: "ENT", value: planCounts.ENT ?? "—" },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
            <p className="text-2xl font-black text-blue-400 mb-1">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Users table — anonymized */}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : users ? (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">User Code</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">XP</th>
                <th className="px-4 py-3">Streak</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 100).map((u, i) => (
                <tr key={i} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="px-4 py-2.5 font-mono text-white">{u.code}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium
                      ${u.plan === "BUS" ? "bg-purple-600/20 text-purple-400"
                      : u.plan === "PRO" ? "bg-blue-600/20 text-blue-400"
                      : u.plan === "ENT" ? "bg-red-600/20 text-red-400"
                      : "bg-slate-700 text-slate-400"}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{u.joined}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.xp}</td>
                  <td className="px-4 py-2.5 text-slate-400">{u.streak > 0 ? `🔥 ${u.streak}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">Unable to load users. Backend may be offline.</p>
      )}
    </div>
  );
}

// ── Blog Editor Tab ───────────────────────────────────────────────────────────
function BlogEditor() {
  const [articles, setArticles] = useState(() => {
    try {
      const saved = localStorage.getItem("winlab_articles");
      return saved ? JSON.parse(saved) : DEFAULT_ARTICLES;
    } catch {
      return DEFAULT_ARTICLES;
    }
  });
  const [editing, setEditing] = useState(null); // null | article index
  const [form, setForm] = useState({ id: "", tag: "", tagColor: "", title: "", subtitle: "", body: "", readTime: "5 min read", published: true });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("winlab_articles", JSON.stringify(articles));
  }, [articles]);

  function openNew() {
    setEditing(-1);
    setForm({ id: String(articles.length + 1).padStart(2, "0"), tag: "Linux", tagColor: TAG_OPTIONS[3].color, title: "", subtitle: "", body: "", readTime: "5 min read", published: true });
  }

  function openEdit(i) {
    setEditing(i);
    setForm({ ...articles[i] });
  }

  function save() {
    if (!form.title.trim()) return;
    if (editing === -1) {
      setArticles([...articles, { ...form }]);
    } else {
      const updated = [...articles];
      updated[editing] = { ...form };
      setArticles(updated);
    }
    setEditing(null);
  }

  function remove(i) {
    if (confirm("Delete this article?")) {
      setArticles(articles.filter((_, idx) => idx !== i));
      if (editing === i) setEditing(null);
    }
  }

  function togglePublish(i) {
    const updated = [...articles];
    updated[i] = { ...updated[i], published: !updated[i].published };
    setArticles(updated);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Blog Editor</h2>
        <button
          onClick={openNew}
          disabled={editing !== null}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          + New Article
        </button>
      </div>

      {/* Form */}
      {editing !== null && (
        <div className="mb-8 p-5 rounded-xl border border-blue-600/20 bg-blue-600/5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">{editing === -1 ? "Create Article" : "Edit Article"}</h3>
            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-white text-xs">✕ Cancel</button>
          </div>

          {/* Tag select */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tag</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_OPTIONS.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setForm({ ...form, tag: t.label, tagColor: t.color })}
                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-all min-h-[44px]
                    ${form.tag === t.label ? t.color : "border-slate-700 text-slate-600 hover:text-slate-400"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Article title"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <input
            value={form.subtitle}
            onChange={e => setForm({ ...form, subtitle: e.target.value })}
            placeholder="Subtitle"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <textarea
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
            placeholder="Article body…"
            rows={6}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none"
          />
          <div className="flex items-center gap-4">
            <input
              value={form.readTime}
              onChange={e => setForm({ ...form, readTime: e.target.value })}
              placeholder="5 min read"
              className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form.published}
                onChange={e => setForm({ ...form, published: e.target.checked })}
                className="accent-blue-600"
              />
              Published
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={!form.title.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {editing === -1 ? "Create" : "Save Changes"}
            </button>
            {editing !== -1 && (
              <button
                onClick={() => remove(editing)}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Article list */}
      <div className="space-y-3">
        {articles.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-all
              ${a.published ? "border-slate-800 bg-slate-900/40" : "border-slate-800/40 bg-slate-900/20 opacity-60"}`}
          >
            <span className="text-2xl font-black text-slate-800 shrink-0 tabular-nums w-6 text-center">{a.id}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${a.tagColor}`}>
                  {a.tag}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${a.published ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-slate-600 text-slate-500 bg-slate-800"}`}>
                  {a.published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-sm font-semibold text-white">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.subtitle}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => togglePublish(i)}
                className="px-3 py-2 min-h-[44px] text-xs border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {a.published ? "Unpublish" : "Publish"}
              </button>
              <button
                onClick={() => openEdit(i)}
                className="px-3 py-2 min-h-[44px] text-xs border border-blue-600/30 text-blue-400 hover:text-blue-300 rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center py-16 text-slate-600 text-sm">
          No articles yet. Create your first one!
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
// ── Leaderboard Tab ───────────────────────────────────────────────────────────
function BlogEditorV2() {
  const [articles, setArticles] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(createEmptyBlogForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/blog/admin", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error("Unable to load blog posts.");
      }
      setArticles(data);
    } catch (err) {
      setError(err.message || "Unable to load blog posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  function openNew() {
    setEditing("new");
    setForm(createEmptyBlogForm());
    setError("");
  }

  function openEdit(post) {
    setEditing(post.id);
    setForm(blogPostToForm(post));
    setError("");
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return;

    const slug = slugifyArticleTitle(form.slug || form.title);
    const tags = form.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          slug,
          excerpt: form.excerpt.trim(),
          content: form.content.trim(),
          tags,
          status: form.published ? "published" : "draft",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || "Unable to save article.");
      }
      await loadArticles();
      setEditing(null);
      setForm(createEmptyBlogForm());
    } catch (err) {
      setError(err.message || "Unable to save article.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(post) {
    if (!post || !confirm("Delete this article?")) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/blog/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Unable to delete article.");
      }
      await loadArticles();
      if (editing === post.id) {
        setEditing(null);
        setForm(createEmptyBlogForm());
      }
    } catch (err) {
      setError(err.message || "Unable to delete article.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post) {
    const nextStatus = post.status === "published" ? "draft" : "published";
    const tags = parseStoredTags(post.tags);

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/blog", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || "",
          content: post.content,
          tags,
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || "Unable to update article.");
      }
      await loadArticles();
      if (editing === post.id) {
        setForm((current) => ({ ...current, published: nextStatus === "published" }));
      }
    } catch (err) {
      setError(err.message || "Unable to update article.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">Blog Editor</h2>
        <button
          onClick={openNew}
          disabled={editing !== null || saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          + New Article
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {editing !== null && (
        <div className="mb-8 p-5 rounded-xl border border-blue-600/20 bg-blue-600/5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">{editing === "new" ? "Create Article" : "Edit Article"}</h3>
            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-white text-xs">Cancel</button>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Primary Tag</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_OPTIONS.map((tagOption) => (
                <button
                  key={tagOption.label}
                  type="button"
                  onClick={() => {
                    const currentTags = form.tagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .filter((tag) => tag.toLowerCase() !== tagOption.label.toLowerCase());
                    setForm({ ...form, tagsInput: [tagOption.label, ...currentTags].join(", ") });
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-medium border transition-all min-h-[44px]
                    ${parseStoredTags(form.tagsInput).some((tag) => tag.toLowerCase() === tagOption.label.toLowerCase()) ? tagOption.color : "border-slate-700 text-slate-600 hover:text-slate-400"}`}
                >
                  {tagOption.label}
                </button>
              ))}
            </div>
          </div>

          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Article title"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="article-slug"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <input
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            placeholder="Short excerpt"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Article body"
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-600 resize-none"
          />
          <div className="flex items-center gap-4">
            <input
              value={form.tagsInput}
              onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
              placeholder="linux, sre, incident-response"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="accent-blue-600"
              />
              Published
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving || !form.title.trim() || !form.content.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {saving ? "Saving..." : editing === "new" ? "Create" : "Save Changes"}
            </button>
            {editing !== "new" && (
              <button
                onClick={() => remove(articles.find((article) => article.id === editing))}
                disabled={saving}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && <div className="text-sm text-slate-500">Loading posts...</div>}

        {!loading && articles.map((article) => {
          const tags = parseStoredTags(article.tags);
          const primaryTag = findTagStyle(tags[0] || "Linux");
          return (
            <div
              key={article.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all
                ${article.status === "published" ? "border-slate-800 bg-slate-900/40" : "border-slate-800/40 bg-slate-900/20 opacity-60"}`}
            >
              <span className="text-xs font-mono text-slate-600 shrink-0 w-28 pt-1">{article.slug}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${primaryTag.color}`}>
                    {tags[0] || "General"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${article.status === "published" ? "border-green-500/30 text-green-400 bg-green-500/10" : "border-slate-600 text-slate-500 bg-slate-800"}`}>
                    {article.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">{article.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{article.excerpt || "No excerpt"}</p>
                {tags.length > 1 && (
                  <p className="text-[10px] text-slate-600 mt-2">{tags.join(", ")}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => togglePublish(article)}
                  disabled={saving}
                  className="px-3 py-2 min-h-[44px] text-xs border border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  {article.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => openEdit(article)}
                  className="px-3 py-2 min-h-[44px] text-xs border border-blue-600/30 text-blue-400 hover:text-blue-300 rounded-lg transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && articles.length === 0 && (
        <div className="text-center py-16 text-slate-600 text-sm">
          No articles yet. Create your first one!
        </div>
      )}
    </div>
  );
}

function AdminLeaderboard() {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6">Live Leaderboard</h2>
      <LiveLeaderboard limit={20} className="max-w-2xl" />
    </div>
  );
}

// ── Session Replay Tab ────────────────────────────────────────────────────────
function AdminReplayTab() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const token = localStorage.getItem("winlab_token");

  useEffect(() => {
    fetch("/api/replay", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setSessions(d))
      .catch(() => {});
  }, [token]);

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6">Session Replay</h2>
      {active ? (
        <SessionReplay sessionId={active} onClose={() => setActive(null)} />
      ) : (
        <div className="space-y-2">
          {sessions.length === 0 && (
            <p className="text-slate-500 text-sm">No sessions recorded yet.</p>
          )}
          {sessions.map((s, i) => (
            <div
              key={i}
              onClick={() => setActive(s.sessionId)}
              className="flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-blue-500/40 transition"
            >
              <div>
                <p className="text-sm font-mono text-white">{s.sessionId.slice(0, 20)}…</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.labId || "unknown lab"} · {s._count?.cmd || 0} commands</p>
              </div>
              <span className="text-xs text-blue-400">▶ Replay</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── B2B Leads Tab ─────────────────────────────────────────────────────────────
const LEAD_STATUSES = ["new", "contacted", "demo_scheduled", "converted", "lost"];

function AdminB2bLeads() {
  const [leads, setLeads] = useState([]);
  const token = localStorage.getItem("winlab_token");

  const fetchLeads = useCallback(() => {
    fetch("/api/b2b/leads", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setLeads(d))
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateStatus(id, status) {
    await fetch(`/api/b2b/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  }

  const STATUS_COLORS = {
    new: "text-blue-400 bg-blue-500/10",
    contacted: "text-yellow-400 bg-yellow-500/10",
    demo_scheduled: "text-purple-400 bg-purple-500/10",
    converted: "text-green-400 bg-green-500/10",
    lost: "text-red-400 bg-red-500/10",
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6">B2B Leads <span className="text-slate-500 font-normal text-sm">({leads.length})</span></h2>
      {leads.length === 0 ? (
        <p className="text-slate-500 text-sm">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Team size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="px-4 py-2.5 font-medium text-white">{l.company}</td>
                  <td className="px-4 py-2.5 text-slate-300">
                    {l.firstName} {l.lastName}
                    <div className="text-slate-500">{l.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{l.teamSize}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={l.status}
                      onChange={(e) => updateStatus(l.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded font-medium bg-transparent border border-white/10 ${STATUS_COLORS[l.status] || "text-slate-400"}`}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Waitlist Tab ──────────────────────────────────────────────────────────────
function AdminWaitlist() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("winlab_token");

  useEffect(() => {
    fetch("/api/early-access/list", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">
          Waitlist{data ? <span className="text-slate-500 font-normal text-sm ml-2">({data.total} signups)</span> : ""}
        </h2>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="bg-slate-800 px-3 py-1.5 rounded-lg">Anonymized</span>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : !data || data.total === 0 ? (
        <p className="text-slate-500 text-sm">No signups yet.</p>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-emerald-400">{data.total}</p>
              <p className="text-xs text-slate-500 mt-1">Total signups</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-blue-400">{500 - data.total}</p>
              <p className="text-xs text-slate-500 mt-1">Seats remaining</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-purple-400">
                {data.signups.reduce((s, r) => s + (r.referrals || 0), 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total referrals</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Referrals</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.signups.map((r) => (
                  <tr key={r.position} className="border-t border-slate-800 hover:bg-slate-900/40">
                    <td className="px-4 py-2.5 text-slate-500 font-mono">{r.position}</td>
                    <td className="px-4 py-2.5 font-mono text-white">{r.code}</td>
                    <td className="px-4 py-2.5 text-slate-300 font-mono">{r.email}</td>
                    <td className="px-4 py-2.5 text-slate-400">{r.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      {r.referrals > 0 ? (
                        <span className="text-emerald-400 font-medium">+{r.referrals}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "blog", label: "Blog Editor", icon: "📝" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
  { id: "replay", label: "Replay", icon: "▶️" },
  { id: "b2b", label: "B2B Leads", icon: "🏢" },
  { id: "waitlist", label: "Waitlist", icon: "🎫" },
];

// ── Admin Login ───────────────────────────────────────────────────────────────
function AdminLogin({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        sessionStorage.setItem("admin_auth", "1");
        onAuthenticated();
      } else {
        setError("Accesso negato. Credenziali non valide.");
      }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-purple-600/[0.06] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-[#0d0d0f] border border-slate-800 rounded-2xl p-8">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-2xl mb-6 mx-auto">
            🔒
          </div>

          <h1 className="text-xl font-bold text-white text-center mb-2">Admin Access</h1>
          <p className="text-slate-500 text-xs text-center mb-8">Restricted area — enter your credentials</p>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 rounded-lg border border-red-600/30 bg-red-600/10 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@winlab.cloud"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-600 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading ? "Verifica…" : "Accedi →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { plan, token } = useLab();
  const [tab, setTab] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("admin_auth") === "1";
  });

  // Admin login gate
  if (!authenticated) {
    return <AdminLogin onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 h-14">
          <a href="/" className="text-slate-600 hover:text-white text-sm transition-colors shrink-0">← Home</a>
          <div className="flex items-center gap-2">
            <span className="text-sm">🔒</span>
            <span className="text-sm font-bold text-white">Admin</span>
          </div>
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${tab === t.id ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_auth");
              setAuthenticated(false);
            }}
            className="ml-auto text-xs px-3 py-1.5 border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-600/30 rounded-lg transition-colors"
          >
            Esci
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {tab === "dashboard" && <AdminDashboard />}
        {tab === "blog" && <BlogEditorV2 />}
        {tab === "leaderboard" && <AdminLeaderboard />}
        {tab === "replay" && <AdminReplayTab />}
        {tab === "b2b" && <AdminB2bLeads />}
        {tab === "waitlist" && <AdminWaitlist />}
      </div>
    </div>
  );
}
