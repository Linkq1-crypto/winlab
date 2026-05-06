const PROOF_CARDS = [
  {
    title: 'Real Linux failures',
    copy: 'Fix incidents in a live shell, not a toy walkthrough.',
  },
  {
    title: 'Browser-native labs',
    copy: 'No VM, no setup, no local environment drift.',
  },
  {
    title: 'Fast operator feedback',
    copy: 'See the failure, test commands, and verify the fix quickly.',
  },
];

export default function MobileLanding({
  onLaunchFreeLab,
  onOpenEarlyAccess,
  terminalLines = [],
  launchCountdown = null,
  featuredStarterLabs = [],
}) {
  const teaserLines = terminalLines.slice(0, 5);
  const showEarlyAccess = Boolean(launchCountdown?.visible);

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#050505] px-4 py-4 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-600 text-[11px] font-black text-white">
              W
            </div>
            <span className="truncate text-sm font-black tracking-tight text-white">WINLAB</span>
          </div>
          <button
            type="button"
            onClick={onOpenEarlyAccess}
            className="min-h-[48px] shrink-0 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[13px] font-black text-emerald-100 transition-colors hover:bg-emerald-400/15"
          >
            Early Access
          </button>
        </header>

        <section className="rounded-[18px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(7,17,26,0.98),rgba(5,8,14,0.98))] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/80">Live Incident Training</p>
          <h1 className="mt-3 text-[32px] font-black leading-[1.02] tracking-[-0.04em] text-white">
            REAL LABS.
            <br />
            ZERO FRICTION.
          </h1>
          <p className="mt-3 max-w-[26rem] text-sm leading-relaxed text-slate-300">
            Fix real Linux failures in your browser. No VM. No setup.
          </p>
          <button
            type="button"
            onClick={onLaunchFreeLab}
            className="mt-5 min-h-[48px] w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-red-500"
          >
            Launch Free Lab
          </button>
        </section>

        {featuredStarterLabs.length > 0 ? (
          <section className="rounded-[18px] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,rgba(10,18,16,0.96),rgba(5,5,5,0.98))] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/80">Free Starter Labs</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">Start free with real incidents before touching pricing.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {featuredStarterLabs.map((lab) => (
                <button
                  key={lab.id}
                  type="button"
                  onClick={onLaunchFreeLab}
                  className="rounded-[16px] border border-emerald-400/12 bg-black/25 px-4 py-3 text-left transition-colors hover:bg-black/40"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/80">Free Starter</p>
                  <p className="mt-2 text-sm font-black leading-tight text-white">{lab.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{lab.difficulty} / {lab.duration}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[18px] border border-white/8 bg-[#07111a] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/75">
            <div className="h-2 w-2 rounded-full bg-cyan-300" />
            Terminal Preview
          </div>
          <div className="space-y-1 overflow-x-auto font-mono text-[11px] leading-[1.5] text-slate-300">
            {teaserLines.map((line, index) => (
              <div key={`${line.text}-${index}`} className="whitespace-pre-wrap break-words">
                {line.text}
              </div>
            ))}
          </div>
        </section>

        {showEarlyAccess ? (
          <section className="rounded-[18px] border border-emerald-400/15 bg-emerald-400/6 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/80">Early Access</p>
            <p className="mt-2 text-[28px] font-black leading-none tracking-tight text-white">
              EUR 5 <span className="text-sm font-medium text-emerald-100/70">forever</span>
            </p>
            <p className="mt-2 text-sm text-emerald-50/80">Locked launch price for life.</p>
            <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/70">{launchCountdown.label}</p>
              <p className="mt-2 font-mono text-[14px] font-black text-white">{launchCountdown.countdown}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/80">Only 500 seats</p>
            </div>
            <button
              type="button"
              onClick={onOpenEarlyAccess}
              className="mt-4 min-h-[48px] w-full rounded-2xl border border-emerald-400/20 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-400/10"
            >
              Get Early Access
            </button>
          </section>
        ) : null}

        <section className="grid gap-3">
          {PROOF_CARDS.map((card) => (
            <article key={card.title} className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
              <h2 className="text-sm font-black text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.copy}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
