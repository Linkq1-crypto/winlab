// AboutPage.jsx – About · Sales/B2B · Blog · GitHub/OSS
import { useState } from "react";

const TABS = [
  { id: "about",  label: "About Us",   icon: "⚡" },
  { id: "sales",  label: "Enterprise", icon: "🏢" },
  { id: "blog",   label: "Blog",       icon: "📝" },
  { id: "github", label: "Open Source",icon: "🐙" },
  { id: "faq",    label: "FAQ",        icon: "❓" },
];

// ── About ─────────────────────────────────────────────────────────────────────
function About() {
  return (
    <div className="max-w-2xl">
      <span className="text-xs text-blue-400 uppercase tracking-widest">Our Story</span>
      <h1 className="text-4xl font-black text-white mt-3 mb-8 leading-tight">
        Beyond the Kernel.
      </h1>

      <div className="space-y-5 text-slate-400 leading-relaxed">
        <p>
          Learning SysAdmin skills shouldn't feel like reading a 1990s manual.
          At WINLAB, we believe the only way to truly master infrastructure is to
          <span className="text-white font-medium"> break it</span>.
        </p>
        <p>
          We built the world's first high-fidelity simulation suite for VMware,
          RAID, and Linux environments. No slow VMs, no cloud costs, no risk.
          Just pure, interactive problem-solving guided by a Senior AI Mentor
          powered by Claude.
        </p>
        <p className="text-white/90 border-l-2 border-blue-600 pl-4 italic">
          "Our Mission: To bridge the gap between <em>'I've read the docs'</em> and
          <em> 'I can fix the production cluster at 3 AM.'</em>"
        </p>
        <p>
          Created by engineers who have lived through the worst data center outages,
          for the engineers who will prevent the next ones.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-12">
        {[
          { value: "10",   label: "Labs"             },
          { value: "60+",  label: "Scenarios"        },
          { value: "∞",    label: "Times you can fail"},
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-blue-500 mb-1">{s.value}</p>
            <p className="text-xs text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sales / B2B ───────────────────────────────────────────────────────────────
function Sales() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    // In production: POST /api/sales/inquiry
    setSent(true);
  }

  return (
    <div className="max-w-2xl">
      <span className="text-xs text-purple-400 uppercase tracking-widest">B2B Solutions</span>
      <h1 className="text-4xl font-black text-white mt-3 mb-4 leading-tight">
        Enterprise Training.<br />Zero Infrastructure Costs.
      </h1>
      <p className="text-slate-400 leading-relaxed mb-10">
        Stop paying for idle AWS/Azure labs. WINLAB provides a turnkey solution
        for IT Departments and Managed Service Providers (MSPs).
      </p>

      <div className="space-y-4 mb-10">
        {[
          { icon: "⚡", title: "Zero Setup",
            body: "Interactive sandboxes that run instantly in any browser. No VM provisioning, no VPN, no waiting." },
          { icon: "📊", title: "Skill Auditing",
            body: "Track team progress with the Manager Dashboard. Know exactly who is ready for the next project before you assign it." },
          { icon: "💰", title: "Cost Predictability",
            body: "One flat fee. No surprise billing from cloud providers for forgotten instances running overnight." },
          { icon: "🔧", title: "Custom Scenarios",
            body: "Enterprise tier includes custom challenge creation for your specific stack. SSSD with your LDAP schema. RAID with your controller model." },
        ].map((item, i) => (
          <div key={i} className="flex gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <span className="text-2xl shrink-0">{item.icon}</span>
            <div>
              <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
              <p className="text-slate-500 text-sm leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Contact form */}
      {sent ? (
        <div className="p-6 rounded-xl border border-green-600/30 bg-green-600/10 text-center">
          <p className="text-green-400 font-semibold">✓ Request received</p>
          <p className="text-slate-400 text-sm mt-1">
            We'll send your 7-day full-team trial access within 24 hours.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-purple-600/20 bg-purple-600/5 space-y-4">
          <h3 className="font-semibold text-white">Request a 7-day full-team trial</h3>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company name"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-600"
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Work email"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-600"
          />
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Request Trial →
          </button>
          <p className="text-xs text-slate-600 text-center">
            Or email us directly at <a href="mailto:sales@winlab.cloud" className="text-slate-400 hover:text-white underline underline-offset-2">sales@winlab.cloud</a>
            <br />
            <span className="text-slate-500">For billing inquiries: <a href="mailto:billing@winlab.cloud" className="text-slate-400 hover:text-white underline underline-offset-2">billing@winlab.cloud</a></span>
          </p>
        </form>
      )}
    </div>
  );
}

// ── Blog ──────────────────────────────────────────────────────────────────────
function Blog({ onNeedLogin }) {
  const [expanded, setExpanded] = useState(null);
  const [likes, setLikes] = useState({});
  const [dislikes, setDislikes] = useState({});
  const [commentOpen, setCommentOpen] = useState(null);
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("winlab_token") : null;

  // Read articles from admin storage (shared via localStorage)
  const [articles, setArticles] = useState(() => {
    try {
      const saved = localStorage.getItem("winlab_articles");
      if (saved) return JSON.parse(saved);
    } catch { /* fall through */ }
    // Fallback defaults
    return [
      {
        id: "01", tag: "Storage",
        tagColor: "text-orange-400 border-orange-500/30 bg-orange-500/10",
        title: "The Art of the Rebuild",
        subtitle: "Why most RAID 5 recoveries fail — and how to fix them.",
        body: "Most engineers only discover RAID's quirks when a disk fails at 2 AM. The parity math is sound, but the recovery process is full of operator traps: wrong rebuild order, silent read errors on a second disk, filesystem inconsistencies post-sync. In this deep dive we walk through every failure mode and how the WINLAB RAID Simulator prepares you to handle each one.",
        readTime: "8 min read", published: true,
      },
      {
        id: "02", tag: "Terraform",
        tagColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
        title: "Terraform State Hell",
        subtitle: "5 scenarios that will test your patience (and how WINLAB solves them).",
        body: "State file drift. Remote state locking deadlocks. Partial applies that leave infra in an unknown condition. Import loops. Destroy cascades. If you haven't lived through at least three of these in production, you haven't done enough Terraform. We built five lab scenarios that simulate each one in a safe environment.",
        readTime: "12 min read", published: true,
      },
      {
        id: "03", tag: "vSphere",
        tagColor: "text-blue-400 border-blue-500/30 bg-blue-500/10",
        title: "vSphere Orchestration in 2026",
        subtitle: "Moving from GUI-clicking to Infrastructure as Code.",
        body: "The vSphere Web Client is comfortable. It's also how you build undocumented, unreproducible, untestable infrastructure. In 2026, the winning pattern is vsphere provider in Terraform + GitOps. This article covers the migration path and uses the WINLAB vSphere simulator to demonstrate live drift detection and remediation.",
        readTime: "10 min read", published: true,
      },
    ];
  });

  // Only show published
  const published = articles.filter(a => a.published !== false);

  function handleLike(i) {
    setLikes(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }));
  }
  function handleDislike(i) {
    setDislikes(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }));
  }
  function handleComment(i) {
    if (!commentInput.trim()) return;
    setComments(prev => ({
      ...prev,
      [i]: [...(prev[i] || []), { text: commentInput, at: new Date().toLocaleString("it-IT") }]
    }));
    setCommentInput("");
  }
  function handleShare(i) {
    const url = `${window.location.origin}/blog/${published[i].id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="max-w-2xl">
      <span className="text-xs text-blue-400 uppercase tracking-widest">Technical Blog</span>
      <h1 className="text-4xl font-black text-white mt-3 mb-10 leading-tight">Field Notes</h1>

      <div className="space-y-5">
        {published.map((post, i) => (
          <div
            key={i}
            className="border border-slate-800 bg-slate-900/50 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-start gap-5 p-6 text-left hover:bg-slate-800/40 transition-colors"
            >
              <span className="text-3xl font-black text-slate-800 shrink-0 tabular-nums">{post.id}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${post.tagColor}`}>
                    {post.tag}
                  </span>
                  <span className="text-[10px] text-slate-600">{post.readTime}</span>
                </div>
                <p className="font-bold text-white text-sm">{post.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{post.subtitle}</p>
              </div>
              <span className={`text-slate-600 shrink-0 transition-transform ${expanded === i ? "rotate-180" : ""}`}>▾</span>
            </button>

            {expanded === i && (
              <div className="px-6 pb-6 border-t border-slate-800">
                {/* Article body */}
                <div className="pt-4">
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{post.body}</p>
                </div>

                {/* Action bar: Like / Dislike / Comment / Share */}
                <div className="flex items-center gap-4 py-3 border-t border-slate-800/60">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(i)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    <span>👍</span>
                    <span>{likes[i] || 0}</span>
                  </button>

                  {/* Dislike */}
                  <button
                    onClick={() => handleDislike(i)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <span>👎</span>
                    <span>{dislikes[i] || 0}</span>
                  </button>

                  {/* Comment toggle */}
                  <button
                    onClick={() => setCommentOpen(commentOpen === i ? null : i)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-green-400 transition-colors"
                  >
                    <span>💬</span>
                    <span>{(comments[i] || []).length} Commenti</span>
                  </button>

                  {/* Share */}
                  <button
                    onClick={() => handleShare(i)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors ml-auto"
                  >
                    <span>🔗</span>
                    <span>Condividi</span>
                  </button>
                </div>

                {/* Comment section */}
                {commentOpen === i && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60">
                    {/* Existing comments */}
                    {(comments[i] || []).length > 0 && (
                      <div className="space-y-2 mb-3">
                        {comments[i].map((c, ci) => (
                          <div key={ci} className="text-xs">
                            <span className="text-slate-600">{c.at}</span>
                            <span className="text-slate-500 mx-1">—</span>
                            <span className="text-slate-300">{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input or login prompt */}
                    {token ? (
                      <div className="flex gap-2">
                        <input
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleComment(i); }}
                          placeholder="Scrivi un commento…"
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-600"
                        />
                        <button
                          onClick={() => handleComment(i)}
                          disabled={!commentInput.trim()}
                          className="px-3 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-blue-600/30 transition-colors"
                        >
                          Invia
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-700/40 bg-slate-800/30">
                        <span className="text-xs text-slate-500">Accedi per commentare</span>
                        <button
                          onClick={onNeedLogin}
                          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                        >
                          Accedi →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Read time */}
                <p className="text-[10px] text-slate-700 mt-2">{post.readTime}</p>
              </div>
            )}
          </div>
        ))}
        {published.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No articles published yet.</p>
        )}
      </div>
    </div>
  );
}

// ── GitHub / OSS ──────────────────────────────────────────────────────────────
const OSS_ITEMS = [
  { icon: "🔧", name: "terraform-vsphere-templates",  desc: "Production-grade Terraform modules for vSphere VM provisioning, HA/DRS setup, and vSwitch configuration."       },
  { icon: "🔒", name: "linux-hardening-scripts",       desc: "CIS Benchmark-aligned hardening scripts for RHEL/Oracle Linux 8/9. Covers SSH, auditd, firewalld, SELinux."   },
  { icon: "🔐", name: "sssd-ldap-debugger",            desc: "Step-by-step diagnostic toolkit for SSSD/LDAP authentication failures. Covers permission issues, cache corruption, and nsswitch." },
  { icon: "💾", name: "raid-recovery-playbooks",       desc: "Ansible playbooks for mdadm software RAID recovery procedures. Tested against scenarios in the WINLAB RAID lab." },
];

function GitHub() {
  return (
    <div className="max-w-2xl">
      <span className="text-xs text-green-400 uppercase tracking-widest">Open Source</span>
      <h1 className="text-4xl font-black text-white mt-3 mb-4 leading-tight">
        Empowering the Community.
      </h1>
      <p className="text-slate-400 leading-relaxed mb-10">
        While our core simulation engine is proprietary, WINLAB is committed to the
        Open Source ecosystem. We share production-grade infrastructure tools used
        in our labs. We believe sharing knowledge makes the entire internet more stable.
      </p>

      <div className="space-y-3 mb-10">
        {OSS_ITEMS.map((item, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
            <span className="text-xl shrink-0">{item.icon}</span>
            <div>
              <p className="font-mono text-sm text-green-400 mb-1">winlab-io / {item.name}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
            <a
              href={`https://github.com/winlab-io/${item.name}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 rounded-lg transition-all"
            >
              View →
            </a>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-xl border border-green-600/20 bg-green-600/5 text-center">
        <p className="text-2xl mb-3">⭐</p>
        <p className="text-white font-semibold mb-2">Star the repo to stay updated</p>
        <p className="text-slate-500 text-sm mb-4">New lab releases come with matching OSS tooling drops.</p>
        <a
          href="https://github.com/winlab-io"
          target="_blank"
          rel="noreferrer"
          className="inline-block px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          🐙 github.com/winlab-io
        </a>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "What's included in the free plan?",
    a: "The free Starter plan includes 1 lab (Linux Terminal) and 3 AI Mentor hints. It's designed to let you experience the platform before committing to a subscription.",
  },
  {
    q: "What's the difference between Pro and Business?",
    a: "Pro ($19/mo) unlocks 8 labs and unlimited AI Mentor hints. Business ($99/mo) adds all 10 labs (including Network Lab and Security Audit), the Manager Dashboard for tracking team progress, priority support with SLA, and custom scenario creation.",
  },
  {
    q: "Can I cancel my subscription at any time?",
    a: "Yes. Cancel anytime from your Stripe billing portal. You keep full access until the end of your current billing period. Your progress and certificate are always yours to keep.",
  },
  {
    q: "How does the AI Mentor work?",
    a: "The AI Mentor is powered by Claude (Anthropic). It uses Socratic questioning — it never gives you the direct answer, but guides you with targeted questions toward the solution. Starter users get 3 hints per session; Pro and Business users have unlimited hints.",
  },
  {
    q: "How do I earn the WINLAB Certificate of Excellence?",
    a: "Complete all 10 labs. The certificate is generated automatically with a unique, publicly verifiable ID (format: WINLAB-timestamp-userId). You can share the verification link directly with employers or on LinkedIn.",
  },
  {
    q: "Is my lab progress saved if I close the browser?",
    a: "Yes. Progress is stored locally (localStorage) and synced to our servers when you're logged in. It's restored automatically on your next visit from any device.",
  },
  {
    q: "Does WINLAB work on mobile?",
    a: "The platform is optimised for desktop browsers. Labs involve terminal input and multi-panel interfaces that require a screen of at least 1024 px wide. A responsive mobile view is on the roadmap.",
  },
  {
    q: "How does the Business team dashboard work?",
    a: "Business plan managers can track every team member's lab progress, completion scores, and certification status from a single dashboard. Members are grouped by Team ID, which is assigned when your organisation is onboarded.",
  },
  {
    q: "What technologies do the labs cover?",
    a: "Linux Terminal, RAID configuration (mdadm), OS installation & partitioning, VMware vSphere, SSSD/LDAP authentication, real-world server incident recovery, advanced multi-step scenarios, AI-generated challenges, Network Lab, and Security Audit.",
  },
  {
    q: "Do you offer educational or non-profit discounts?",
    a: "Yes. Contact us at hello@winlab.cloud or sales@winlab.cloud with your institution details. We offer significant discounts for universities, coding bootcamps, and non-profit training programmes.",
  },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div className="max-w-2xl">
      <span className="text-xs text-yellow-400 uppercase tracking-widest">FAQ</span>
      <h1 className="text-4xl font-black text-white mt-3 mb-10 leading-tight">
        Frequently Asked<br />Questions
      </h1>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
            >
              <span className="text-sm font-semibold text-white">{item.q}</span>
              <span className={`text-slate-500 shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open === i && (
              <div className="px-5 pb-5 border-t border-slate-800 pt-3">
                <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center">
        <p className="text-white text-sm font-semibold mb-1">Still have questions?</p>
        <p className="text-slate-500 text-xs mb-3">Our team usually replies within a few hours.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="mailto:support@winlab.cloud"
            className="inline-block px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            ✉ support@winlab.cloud
          </a>
          <a
            href="mailto:hello@winlab.cloud"
            className="inline-block px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            ✉ hello@winlab.cloud
          </a>
        </div>
      </div>

      {/* Contact Directory */}
      <div className="mt-8 p-6 rounded-xl border border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-semibold text-white mb-4">📬 Contact Directory</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          {[
            { email: "support@winlab.cloud",    label: "Technical support & AI Mentor" },
            { email: "billing@winlab.cloud",     label: "Payments, invoices & refunds"  },
            { email: "hello@winlab.cloud",       label: "General inquiries"             },
            { email: "sales@winlab.cloud",       label: "B2B & enterprise team plans"   },
            { email: "partnership@winlab.cloud", label: "Collaborations & partnerships" },
            { email: "certification@winlab.cloud", label: "Certificate issues & verification" },
            { email: "security@winlab.cloud",    label: "Vulnerability reports"         },
            { email: "abuse@winlab.cloud",       label: "Report misuse"                 },
            { email: "privacy@winlab.cloud",     label: "GDPR & data privacy"           },
          ].map(item => (
            <div key={item.email} className="flex items-start gap-3">
              <a href={`mailto:${item.email}`} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-mono shrink-0">
                {item.email}
              </a>
              <span className="text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AboutPage({ onBack, initialTab = "about", onNeedLogin }) {
  const [tab, setTab] = useState(initialTab);

  const content = {
    about:  <About />,
    sales:  <Sales />,
    blog:   <Blog onNeedLogin={onNeedLogin} />,
    github: <GitHub />,
    faq:    <FAQ />,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 h-14">
          <button onClick={onBack} className="text-slate-600 hover:text-white text-sm transition-colors shrink-0">← Back</button>
          <div className="flex gap-1 overflow-x-auto scrollbar-none min-w-0">
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
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14">
        {content[tab]}
      </div>
    </div>
  );
}
