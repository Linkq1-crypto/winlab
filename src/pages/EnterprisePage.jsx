import React from 'react';

const ENTERPRISE_PILLARS = [
  {
    title: 'Training for teams',
    items: ['40+ enterprise crisis scenarios', 'Shared team progression', 'Manager visibility into skill gaps'],
  },
  {
    title: 'Identity and access',
    items: ['SSO for Azure AD and Okta', 'Tenant isolation', 'Role-based access for team admins'],
  },
  {
    title: 'Procurement ready',
    items: ['Trust center documentation', 'Security questionnaire support', 'Direct onboarding with enterprise@winlab.cloud'],
  },
];

const DEADLOCK_LABS = [
  'PostgreSQL Deadlock',
  'Kubernetes Dependency Loop',
  'Queue Worker Starvation',
  'Redis Lock Contention',
  'API Cascade Blocking',
];

const TIER_DIFF = [
  {
    tier: 'Pro',
    value: 'Deadlock labs',
    copy: 'Operators train on lock contention, queue starvation, and cascading wait chains inside guided incident labs.',
  },
  {
    tier: 'Business',
    value: 'Team incident graph',
    copy: 'Managers and responders review shared dependency graphs, blocked paths, and escalation decisions together.',
  },
  {
    tier: 'Enterprise',
    value: 'Custom deadlock scenarios and reports',
    copy: 'WinLab models tenant-specific dependency failures and delivers tailored after-action reporting for real environments.',
  },
];

export default function EnterprisePage() {
  return (
    <div className="winlab-public-page">
      <main className="winlab-public-main max-w-6xl">
        <a href="/" className="text-xs text-emerald-300/80 transition-colors hover:text-emerald-200">
          Back to WinLab
        </a>

        <section className="mt-4 rounded-[18px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(9,9,11,0.96))] p-5 sm:mt-6 sm:rounded-[32px] sm:p-8 md:p-10">
          <p className="winlab-public-eyebrow text-emerald-300">Enterprise</p>
          <h1 className="winlab-public-title mt-2 max-w-3xl text-white">
            Incident training for teams that need root cause, not noise.
          </h1>
          <p className="winlab-public-copy mt-4 max-w-2xl text-zinc-300 md:text-lg">
            SSO, team analytics, trust-center material, and crisis labs that mirror the dependency failures enterprise operators actually handle.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="mailto:enterprise@winlab.cloud" className="min-h-[48px] rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-black transition-colors hover:bg-emerald-300">
              Contact enterprise
            </a>
            <a href="/security" className="min-h-[48px] rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-white/5">
              Open trust center
            </a>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {ENTERPRISE_PILLARS.map((pillar) => (
            <article key={pillar.title} className="winlab-public-card">
              <h2 className="text-lg font-black text-white">{pillar.title}</h2>
              <ul className="mt-4 space-y-2">
                {pillar.items.map((item) => (
                  <li key={item} className="text-sm text-zinc-400">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="winlab-public-card mt-8 overflow-hidden border-cyan-400/12 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.12),_transparent_34%),linear-gradient(180deg,rgba(8,15,26,0.98),rgba(9,9,11,0.98))]">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="winlab-public-eyebrow text-cyan-300">DeadlockGuard&trade;</p>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Find what is blocked, by whom, and why.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-300 sm:text-base">
                WinLab visualizes service dependencies, database locks, and cascading wait chains so operators can identify root cause faster.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Positioning</p>
                  <p className="mt-2 text-sm font-semibold text-white">Incident training + root cause simulation</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Category</p>
                  <p className="mt-2 text-sm font-semibold text-white">Deadlocks &amp; Dependency Failures</p>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Scenario set</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEADLOCK_LABS.map((lab) => (
                    <span key={lab} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">
                      {lab}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-400/15 bg-black/30 p-4 shadow-[0_18px_50px_rgba(6,47,73,0.24)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/75">Dependency Graph</p>
                  <p className="mt-1 text-xs text-zinc-500">incident graph / wait analysis</p>
                </div>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                  chain stalled
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/8 bg-[#081019] px-4 py-3 text-sm text-slate-300">
                  <span className="font-mono text-xs text-cyan-100/85">ingest-api &rarr; queue-worker &rarr; redis-lock &rarr; postgres-primary</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Blocked service</p>
                    <p className="mt-2 text-sm font-semibold text-white">queue-worker / reconcile-billing</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Lock holder</p>
                    <p className="mt-2 text-sm font-semibold text-white">redis-lock / tenant-eu-west-1</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Root cause</p>
                    <p className="mt-2 text-sm font-semibold text-white">Retry storm amplified a stale write lock</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/12 bg-emerald-400/6 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/80">Suggested action</p>
                    <p className="mt-2 text-sm font-semibold text-white">Drain queue, clear holder, replay consumers in order</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {TIER_DIFF.map((item) => (
            <article key={item.tier} className="winlab-public-card">
              <p className="winlab-public-eyebrow">{item.tier}</p>
              <h2 className="mt-2 text-lg font-black text-white">{item.value}</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="winlab-public-card mt-8">
          <p className="winlab-public-eyebrow mb-4">What this restores</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              A premium enterprise entry point that explains why WinLab is useful for dependency failures, lock analysis, and operator root-cause drills.
            </div>
            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              Clear packaging for Pro, Business, and Enterprise around DeadlockGuard instead of treating incident graph analysis like generic monitoring.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
