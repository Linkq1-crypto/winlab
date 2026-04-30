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
    <div className="winlab-public-page">
      <main className="winlab-public-main max-w-6xl">
        <a href="/" className="text-xs text-emerald-300/80 transition-colors hover:text-emerald-200">
          Back to WinLab
        </a>

        <section className="mt-4 rounded-[18px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(9,9,11,0.96))] p-5 sm:mt-6 sm:rounded-[32px] sm:p-8 md:p-10">
          <p className="winlab-public-eyebrow text-emerald-300">Enterprise</p>
          <h1 className="winlab-public-title mt-2 max-w-3xl text-white">
            Real incident training for IT teams.
          </h1>
          <p className="winlab-public-copy mt-4 max-w-2xl text-zinc-300 md:text-lg">
            SSO, team analytics, trust-center material, and crisis labs that mirror the failures enterprise operators actually handle.
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

        <section className="winlab-public-card mt-8">
          <p className="winlab-public-eyebrow mb-4">What this restores</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              A public enterprise entry point in the current app flow, instead of leaving enterprise hidden behind the old server-only landing.
            </div>
            <div className="rounded-2xl bg-black px-5 py-4 text-sm text-zinc-400">
              Clear links for security review, team onboarding, and direct enterprise contact from the same branch the rest of the public pages already use.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
