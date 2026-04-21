// AboutPage.jsx – Jobs-Dark redesign
import { useState } from "react";

const TABS = [
  { id: "about",  label: "About"      },
  { id: "sales",  label: "Enterprise" },
  { id: "blog",   label: "Blog"       },
  { id: "github", label: "Open Source"},
  { id: "faq",    label: "FAQ"        },
];

const inputClass = "w-full bg-black border border-[#222] px-4 py-3 font-mono text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#444] transition-colors duration-200";

// ── About ─────────────────────────────────────────────────────────────────────
function About() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
        // WINLAB — OUR_STORY
      </p>
      <h1 className="font-mono text-4xl font-black text-white mb-8 leading-none tracking-tight">
        Beyond the<br /><span className="text-[#FF3B30]">Kernel.</span>
      </h1>

      <div className="space-y-5 font-mono text-sm text-gray-500 leading-relaxed">
        <p>
          Learning SysAdmin skills shouldn't feel like reading a 1990s manual.
          At WINLAB, we believe the only way to truly master infrastructure is to
          <span className="text-gray-200"> break it</span>.
        </p>
        <p>
          We built the world's first high-fidelity simulation suite for VMware,
          RAID, and Linux environments. No slow VMs, no cloud costs, no risk.
          Just pure, interactive problem-solving guided by a Senior AI Mentor
          powered by Claude.
        </p>
        <p className="text-gray-300 border-l-2 border-[#333] pl-4">
          "Our Mission: To bridge the gap between <em>'I've read the docs'</em> and
          <em> 'I can fix the production cluster at 3 AM.'</em>"
        </p>
        <p>
          Created by engineers who have lived through the worst data center outages,
          for the engineers who will prevent the next ones.
        </p>
      </div>

      <div className="border border-[#222] mt-12 font-mono">
        <div className="grid grid-cols-3 border-b border-[#1a1a1a] px-5 py-2 text-[9px] text-gray-700 uppercase tracking-widest">
          <span>Labs</span><span>Scenarios</span><span>Failures allowed</span>
        </div>
        <div className="grid grid-cols-3 px-5 py-5">
          <span className="text-2xl font-black text-white">10</span>
          <span className="text-2xl font-black text-white">60+</span>
          <span className="text-2xl font-black text-white">∞</span>
        </div>
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
    setSent(true);
  }

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
        // ENTERPRISE — B2B_SOLUTIONS
      </p>
      <h1 className="font-mono text-4xl font-black text-white mb-4 leading-none tracking-tight">
        Enterprise Training.<br />Zero Infrastructure Costs.
      </h1>
      <p className="font-mono text-sm text-gray-500 leading-relaxed mb-10">
        Stop paying for idle AWS/Azure labs. WINLAB provides a turnkey solution
        for IT Departments and Managed Service Providers (MSPs).
      </p>

      <div className="border border-[#222] mb-10">
        {[
          { id: "01", title: "Zero Setup",
            body: "Interactive sandboxes that run instantly in any browser. No VM provisioning, no VPN, no waiting." },
          { id: "02", title: "Skill Auditing",
            body: "Track team progress with the Manager Dashboard. Know exactly who is ready for the next project." },
          { id: "03", title: "Cost Predictability",
            body: "One flat fee. No surprise billing from cloud providers for forgotten instances running overnight." },
          { id: "04", title: "Custom Scenarios",
            body: "Enterprise tier includes custom challenge creation for your specific stack and LDAP schema." },
        ].map((item, i) => (
          <div key={i} className={`flex gap-4 px-5 py-5 ${i < 3 ? "border-b border-[#1a1a1a]" : ""}`}>
            <span className="font-mono text-[10px] text-gray-700 shrink-0 pt-0.5">{item.id}</span>
            <div>
              <p className="font-mono text-sm text-white mb-1">{item.title}</p>
              <p className="font-mono text-xs text-gray-500 leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {sent ? (
        <div className="border border-[#222] p-6 font-mono text-center">
          <span className="text-green-500">// OK</span>
          <span className="text-gray-400"> — Request received. Trial access within 24h.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border border-[#222] p-6 space-y-4">
          <p className="font-mono text-[10px] text-gray-600 uppercase tracking-widest mb-4">// Request 7-day full-team trial</p>
          <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" required className={inputClass} />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Work email" required className={inputClass} />
          <button type="submit" className="w-full font-mono text-xs tracking-widest uppercase text-black bg-white py-3 hover:bg-gray-200 transition-colors duration-200">
            [ Request Trial ]
          </button>
          <p className="font-mono text-[9px] text-gray-700 text-center tracking-widest">
            Or: <a href="mailto:sales@winlab.cloud" className="text-gray-500 hover:text-white underline underline-offset-2 transition-colors">sales@winlab.cloud</a>
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
  const [shareOpen, setShareOpen] = useState(null);
  const [copied, setCopied] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("winlab_token") : null;

  const [articles] = useState(() => {
    try {
      const saved = localStorage.getItem("winlab_articles");
      if (saved) return JSON.parse(saved);
    } catch { /* fall through */ }
    return [
      {
        id: "01", tag: "Storage",
        title: "The Art of the Rebuild",
        subtitle: "Why most RAID 5 recoveries fail — and how to fix them.",
        body: "Most engineers only discover RAID's quirks when a disk fails at 2 AM. The parity math is sound, but the recovery process is full of operator traps: wrong rebuild order, silent read errors on a second disk, filesystem inconsistencies post-sync. In this deep dive we walk through every failure mode and how the WINLAB RAID Simulator prepares you to handle each one.",
        readTime: "8 min", published: true,
      },
      {
        id: "02", tag: "Terraform",
        title: "Terraform State Hell",
        subtitle: "5 scenarios that will test your patience (and how WINLAB solves them).",
        body: "State file drift. Remote state locking deadlocks. Partial applies that leave infra in an unknown condition. Import loops. Destroy cascades. If you haven't lived through at least three of these in production, you haven't done enough Terraform. We built five lab scenarios that simulate each one in a safe environment.",
        readTime: "12 min", published: true,
      },
      {
        id: "03", tag: "vSphere",
        title: "vSphere Orchestration in 2026",
        subtitle: "Moving from GUI-clicking to Infrastructure as Code.",
        body: "The vSphere Web Client is comfortable. It's also how you build undocumented, unreproducible, untestable infrastructure. In 2026, the winning pattern is vsphere provider in Terraform + GitOps. This article covers the migration path and uses the WINLAB vSphere simulator to demonstrate live drift detection and remediation.",
        readTime: "10 min", published: true,
      },
    ];
  });

  const published = articles.filter(a => a.published !== false);

  function getPostUrl(post) { return `${window.location.origin}/blog/${post.id}`; }

  function handleCopyLink(post) {
    navigator.clipboard?.writeText(getPostUrl(post)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareTwitter(post) {
    const text = encodeURIComponent(`"${post.title}" — ${post.subtitle}\n\n${getPostUrl(post)}\n\nvia @WinLabCloud`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener");
  }

  function handleShareLinkedIn(post) {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getPostUrl(post))}`, "_blank", "noopener");
  }

  function handleComment(i) {
    if (!commentInput.trim()) return;
    setComments(prev => ({
      ...prev,
      [i]: [...(prev[i] || []), { text: commentInput, at: new Date().toLocaleString("it-IT") }]
    }));
    setCommentInput("");
  }

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
        // FIELD_NOTES — TECHNICAL_BLOG
      </p>
      <h1 className="font-mono text-4xl font-black text-white mb-10 leading-none tracking-tight">Field Notes</h1>

      <div className="border border-[#222]">
        {published.map((post, i) => (
          <div key={i} className={i < published.length - 1 ? "border-b border-[#1a1a1a]" : ""}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-start gap-5 px-5 py-5 text-left hover:bg-[#050505] transition-colors group"
            >
              <span className="font-mono text-[10px] text-gray-700 shrink-0 pt-1 tracking-widest">{post.id}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[9px] text-gray-600 border border-[#333] px-2 py-0.5 uppercase tracking-widest">{post.tag}</span>
                  <span className="font-mono text-[9px] text-gray-700">{post.readTime}</span>
                </div>
                <p className="font-mono text-sm text-gray-200 group-hover:text-white transition-colors">{post.title}</p>
                <p className="font-mono text-xs text-gray-600 mt-0.5">{post.subtitle}</p>
              </div>
              <span className={`font-mono text-gray-700 shrink-0 transition-transform ${expanded === i ? "rotate-180" : ""}`}>▾</span>
            </button>

            {expanded === i && (
              <div className="px-5 pb-5 border-t border-[#1a1a1a]">
                <p className="font-mono text-xs text-gray-400 leading-relaxed pt-4 mb-4">{post.body}</p>

                <div className="flex items-center gap-5 py-3 border-t border-[#1a1a1a] relative">
                  <button onClick={() => setLikes(p => ({...p, [i]: (p[i]||0)+1}))} className="font-mono text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
                    +1 ({likes[i] || 0})
                  </button>
                  <button onClick={() => setDislikes(p => ({...p, [i]: (p[i]||0)+1}))} className="font-mono text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
                    -1 ({dislikes[i] || 0})
                  </button>
                  <button onClick={() => setCommentOpen(commentOpen === i ? null : i)} className="font-mono text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
                    Comments ({(comments[i] || []).length})
                  </button>

                  <div className="ml-auto relative">
                    <button onClick={() => setShareOpen(shareOpen === i ? null : i)} className="font-mono text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
                      Share ↗
                    </button>
                    {shareOpen === i && (
                      <div className="absolute right-0 bottom-8 w-52 bg-black border border-[#222] z-50">
                        <div className="px-4 py-2 border-b border-[#1a1a1a] font-mono text-[9px] text-gray-700 uppercase tracking-widest">Share</div>
                        {[
                          { label: "Post on X", action: () => { handleShareTwitter(published[i]); setShareOpen(null); } },
                          { label: "Share on LinkedIn", action: () => { handleShareLinkedIn(published[i]); setShareOpen(null); } },
                          { label: copied ? "Copied!" : "Copy link", action: () => handleCopyLink(published[i]) },
                        ].map((item, si) => (
                          <button key={si} onClick={item.action} className="w-full px-4 py-2.5 font-mono text-[10px] text-gray-500 hover:text-white hover:bg-[#0d0d0d] transition-colors text-left">
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {commentOpen === i && (
                  <div className="pt-3 border-t border-[#1a1a1a]">
                    {(comments[i] || []).map((c, ci) => (
                      <div key={ci} className="font-mono text-[10px] text-gray-600 mb-1">
                        <span className="text-gray-700">{c.at}</span> — <span className="text-gray-400">{c.text}</span>
                      </div>
                    ))}
                    {token ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleComment(i); }}
                          placeholder="Write a comment…"
                          className="flex-1 bg-black border border-[#222] px-3 py-2 font-mono text-xs text-gray-300 placeholder-gray-700 focus:outline-none focus:border-[#444]"
                        />
                        <button onClick={() => handleComment(i)} disabled={!commentInput.trim()} className="font-mono text-[10px] uppercase tracking-widest text-black bg-white px-3 py-2 disabled:opacity-40 hover:bg-gray-200 transition-colors">
                          Post
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 border border-[#1a1a1a]">
                        <span className="font-mono text-xs text-gray-600">Sign in to comment</span>
                        <button onClick={onNeedLogin} className="font-mono text-[10px] uppercase tracking-widest text-black bg-white px-3 py-1.5 hover:bg-gray-200 transition-colors">
                          Sign in →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {published.length === 0 && (
          <p className="font-mono text-xs text-gray-700 text-center py-12">No articles published yet.</p>
        )}
      </div>
    </div>
  );
}

// ── GitHub / OSS ──────────────────────────────────────────────────────────────
const OSS_ITEMS = [
  { name: "terraform-vsphere-templates",  desc: "Production-grade Terraform modules for vSphere VM provisioning, HA/DRS setup, and vSwitch configuration."       },
  { name: "linux-hardening-scripts",       desc: "CIS Benchmark-aligned hardening scripts for RHEL/Oracle Linux 8/9. Covers SSH, auditd, firewalld, SELinux."   },
  { name: "sssd-ldap-debugger",            desc: "Step-by-step diagnostic toolkit for SSSD/LDAP authentication failures. Covers permission issues and cache corruption." },
  { name: "raid-recovery-playbooks",       desc: "Ansible playbooks for mdadm software RAID recovery procedures. Tested against WINLAB RAID lab scenarios." },
];

function GitHub() {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
        // OPEN_SOURCE — COMMUNITY
      </p>
      <h1 className="font-mono text-4xl font-black text-white mb-4 leading-none tracking-tight">
        Empowering the<br />Community.
      </h1>
      <p className="font-mono text-sm text-gray-500 leading-relaxed mb-10">
        While our core simulation engine is proprietary, WINLAB shares production-grade
        infrastructure tools used in our labs.
      </p>

      <div className="border border-[#222] mb-10">
        {OSS_ITEMS.map((item, i) => (
          <div key={i} className={`flex items-start gap-4 px-5 py-5 ${i < OSS_ITEMS.length - 1 ? "border-b border-[#1a1a1a]" : ""} hover:bg-[#050505] transition-colors group`}>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm text-green-500 mb-1">winlab-io / {item.name}</p>
              <p className="font-mono text-xs text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
            <a
              href={`https://github.com/winlab-io/${item.name}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-gray-600 hover:text-white border border-[#222] hover:border-[#444] px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              View →
            </a>
          </div>
        ))}
      </div>

      <div className="border border-[#222] p-6 font-mono text-center">
        <p className="text-sm text-gray-300 mb-1">Star the repo to stay updated</p>
        <p className="text-xs text-gray-600 mb-4">New lab releases come with matching OSS tooling drops.</p>
        <a
          href="https://github.com/winlab-io"
          target="_blank"
          rel="noreferrer"
          className="inline-block font-mono text-[10px] uppercase tracking-widest text-black bg-white px-6 py-2.5 hover:bg-gray-200 transition-colors"
        >
          [ github.com/winlab-io ]
        </a>
      </div>
    </div>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "What's included in the free plan?",
    a: "The free Starter plan includes 1 lab (Linux Terminal) and 3 AI Mentor hints. It lets you experience the platform before committing to a subscription." },
  { q: "What's the difference between Pro and Business?",
    a: "Pro ($19/mo) unlocks 8 labs and unlimited AI Mentor hints. Business ($99/mo) adds all 10 labs, the Manager Dashboard, priority support with SLA, and custom scenario creation." },
  { q: "Can I cancel my subscription at any time?",
    a: "Yes. Cancel anytime from your Stripe billing portal. You keep full access until the end of your current billing period." },
  { q: "How does the AI Mentor work?",
    a: "The AI Mentor is powered by Claude (Anthropic). It uses Socratic questioning — it never gives you the direct answer, but guides you with targeted questions toward the solution." },
  { q: "How do I earn the WINLAB Certificate?",
    a: "Complete all 10 labs. The certificate is generated automatically with a unique, publicly verifiable ID. Share the link directly with employers or on LinkedIn." },
  { q: "Is my lab progress saved if I close the browser?",
    a: "Yes. Progress is stored locally and synced to our servers when you're logged in. It's restored automatically on your next visit from any device." },
  { q: "Does WINLAB work on mobile?",
    a: "The platform is optimised for desktop browsers. Labs involve terminal input and multi-panel interfaces that require a screen of at least 1024 px wide." },
  { q: "What technologies do the labs cover?",
    a: "Linux Terminal, RAID (mdadm), OS installation, VMware vSphere, SSSD/LDAP, real-world server incident recovery, advanced multi-step scenarios, AI-generated challenges, Network Lab, and Security Audit." },
  { q: "Do you offer educational discounts?",
    a: "Yes. Contact us at hello@winlab.cloud with your institution details. We offer significant discounts for universities, bootcamps, and non-profit training programmes." },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase mb-8">
        // FREQUENTLY_ASKED_QUESTIONS
      </p>
      <h1 className="font-mono text-4xl font-black text-white mb-10 leading-none tracking-tight">
        FAQ
      </h1>

      <div className="border border-[#222]">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className={i < FAQ_ITEMS.length - 1 ? "border-b border-[#1a1a1a]" : ""}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[#050505] transition-colors"
            >
              <span className="font-mono text-sm text-gray-300">{item.q}</span>
              <span className={`font-mono text-gray-700 shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open === i && (
              <div className="px-5 pb-5 border-t border-[#1a1a1a] pt-3">
                <p className="font-mono text-xs text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border border-[#222] p-6 mt-8 font-mono">
        <p className="text-[9px] text-gray-700 uppercase tracking-[0.4em] mb-4">// CONTACT_DIRECTORY</p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs mb-6">
          {[
            { email: "support@winlab.cloud",       label: "Technical support" },
            { email: "billing@winlab.cloud",        label: "Payments & invoices" },
            { email: "hello@winlab.cloud",          label: "General inquiries" },
            { email: "sales@winlab.cloud",          label: "B2B & enterprise" },
            { email: "certification@winlab.cloud",  label: "Certificate verification" },
            { email: "security@winlab.cloud",       label: "Vulnerability reports" },
          ].map(item => (
            <div key={item.email}>
              <a href={`mailto:${item.email}`} className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors">
                {item.email}
              </a>
              <span className="text-gray-700 ml-2">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gray-700 text-center tracking-widest uppercase">Usually replies within a few hours.</p>
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
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="border-b border-[#1a1a1a] sticky top-0 bg-black/95 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 h-12">
          <button
            onClick={onBack}
            className="font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-white transition-colors shrink-0"
          >
            ← Back
          </button>
          <div className="flex gap-0 overflow-x-auto border-l border-[#1a1a1a] pl-4">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 font-mono text-[10px] tracking-widest uppercase transition-colors whitespace-nowrap
                  ${tab === t.id ? "text-white border-b border-white" : "text-gray-600 hover:text-gray-300"}`}
              >
                {t.label}
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
