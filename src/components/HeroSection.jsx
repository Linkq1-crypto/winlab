export default function HeroSection({
  onStart,
  onSeeHowItWorks,
  stats,
  socialProof,
}) {
  return (
    <section className="bg-[#0B0F14] text-[#E6EDF3]">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#9DA7B3]">
            <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
            Live production incidents
          </div>

          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[#E6EDF3] sm:text-5xl lg:text-6xl">
            Your server is down. Fix it.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-[#9DA7B3] sm:text-lg">
            Break real servers. Get hired. No simulations.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center justify-center rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
            >
              Start first incident
            </button>

            <button
              type="button"
              onClick={onSeeHowItWorks}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#E6EDF3] transition hover:bg-white/10"
            >
              See how it works
            </button>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-sm text-[#9DA7B3]">{socialProof.headline}</p>
          </div>

          <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Engineers" value={formatCount(stats.engineers)} />
            <StatPill label="Countries" value={`${stats.countries}+`} />
            <StatPill label="Labs" value={String(stats.labs)} />
            <StatPill label="Rating" value={`${stats.avgRating}*`} />
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#F85149]" />
                <span className="h-3 w-3 rounded-full bg-[#D29922]" />
                <span className="h-3 w-3 rounded-full bg-[#3FB950]" />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#9DA7B3]">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                  <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
                  live
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[#D29922]">
                  degraded
                </span>
                <span className="hidden rounded-full border border-white/10 bg-black/20 px-2 py-1 sm:inline-flex">
                  prod-eu-west-1
                </span>
              </div>
            </div>

            <div className="min-h-[380px] bg-[#0B0F14] p-5 font-mono text-[13px] leading-6 text-[#E6EDF3] sm:min-h-[420px] sm:text-sm">
              <div className="text-[#9DA7B3]">prod-eu-west-1 - bash</div>
              <div className="text-[#3FB950]">live incident</div>

              <div className="mt-4 text-[#F85149]">[12:04:11] requests failing {"\u2191"}</div>
              <div className="text-[#F85149]">[12:04:13] nginx healthcheck failed</div>
              <div className="text-[#F85149]">[12:04:17] customer traffic impacted</div>

              <div className="mt-5">$ systemctl status nginx</div>
              <div className="text-[#F85149]">nginx.service - failed (Result: exit-code)</div>
              <div className="text-[#9DA7B3]">Main PID: 1823 (code=exited, status=1/FAILURE)</div>

              <div className="mt-4">$ journalctl -u nginx -n 20 --no-pager</div>
              <div className="text-[#D29922]">warning: upstream timeout threshold exceeded</div>
              <div className="text-[#D29922]">bind() to 0.0.0.0:80 failed</div>

              <div className="mt-6 text-[#3FB950]">$</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[#9DA7B3]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[#E6EDF3]">{value}</div>
    </div>
  );
}

function formatCount(value) {
  if (typeof value !== "number") return String(value);
  return value >= 1000 ? `${Math.round(value / 100) / 10}k+` : String(value);
}
