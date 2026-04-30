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

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <a href="/" className="text-xs uppercase tracking-[0.28em] text-emerald-300/80 transition-colors hover:text-emerald-200">
          Back to WinLab
        </a>

        <section className="mt-6 rounded-[32px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(9,9,11,0.96))] p-8 md:p-10">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-300">Enterprise</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase italic tracking-tight text-white md:text-6xl">
            Browser-based incident training for real IT teams.
          </h1>
          <p className="mt-5 max-w-3xl text-base text-zinc-300 md:text-lg">
            SSO, team analytics, trust-center material, and crisis labs that mirror the failures enterprise operators actually handle.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="mailto:enterprise@winlab.cloud" className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black transition-colors hover:bg-emerald-300">
              Contact enterprise
            </a>
            <a href="/security" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/5">
              Open trust center
            </a>
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-3">
          {ENTERPRISE_PILLARS.map((pillar) => (
            <article key={pillar.title} className="rounded-[28px] border border-white/10 bg-zinc-950 p-6">
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white">{pillar.title}</h2>
              <ul className="mt-4 space-y-3">
                {pillar.items.map((item) => (
                  <li key={item} className="text-sm text-zinc-400">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-[32px] border border-white/10 bg-zinc-950 p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-zinc-500">What this restores</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black px-5 py-4 text-sm text-zinc-400">
              A public enterprise entry point in the current app flow, instead of leaving enterprise hidden behind the old server-only landing.
            </div>
            <div className="rounded-2xl border border-white/5 bg-black px-5 py-4 text-sm text-zinc-400">
              Clear links for security review, team onboarding, and direct enterprise contact from the same branch the rest of the public pages already use.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
