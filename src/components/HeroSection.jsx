const DEFAULT_FEATURED_LABS = [
  {
    slug: "api-timeout",
    title: "API Timeout",
    description: "Trace the timeout chain and restore traffic before impact spreads.",
    durationMin: 18,
    difficulty: "junior",
    tier: "free",
    rating: 4.8,
  },
  {
    slug: "nginx-port-conflict",
    title: "Nginx Port Conflict",
    description: "Recover an edge service that cannot bind cleanly under load.",
    durationMin: 14,
    difficulty: "mid",
    tier: "free",
    rating: 4.7,
  },
  {
    slug: "permission-denied",
    title: "Permission Denied",
    description: "Fix a write path that fails with real production permissions.",
    durationMin: 16,
    difficulty: "mid",
    tier: "pro",
    rating: 4.9,
  },
];

export default function HeroSection({
  onStart,
  onWatch,
  startHref = "/labs/nginx-down",
  startLoading = false,
  startError = "",
  stats = {
    engineers: 12000,
    countries: 120,
    labs: 24,
    avgRating: 4.8,
  },
  socialProof = {
    headline: "Joined by engineers from 120+ countries",
  },
  featuredLabs = DEFAULT_FEATURED_LABS,
  pricing = {
    freeLabs: 5,
    proMonthlyUsd: 19,
    currency: "USD",
  },
}) {
  return (
    <section className="bg-[#0B0F14] text-[#E6EDF3]">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#9DA7B3]">
              <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
              Live production incidents
            </div>

            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[#E6EDF3] sm:text-5xl lg:text-6xl">
              Your server is down. Fix it.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-[#9DA7B3] sm:text-lg">
              A broken system. A live terminal. Fix it before it gets worse.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={startHref}
                onClick={onStart}
                aria-disabled={startLoading}
                className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-white transition ${
                  startLoading
                    ? "pointer-events-none bg-[#4F8CFF]/70"
                    : "bg-[#4F8CFF] hover:brightness-110"
                }`}
              >
                {startLoading ? "Starting..." : "Start first incident"}
              </a>

              <button
                type="button"
                onClick={onWatch}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#E6EDF3] transition hover:bg-white/10"
              >
                Watch it fail -&gt;
              </button>
            </div>

            {startError ? (
              <div className="mt-3 text-sm text-[#F85149]">{startError}</div>
            ) : null}

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-sm text-[#9DA7B3]">
                {socialProof.headline}
              </p>
            </div>

            <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              <StatPill label="Engineers" value={formatCount(stats.engineers)} />
              <StatPill label="Countries" value={`${stats.countries}+`} />
              <StatPill label="Labs" value={String(stats.labs)} />
              <StatPill label="Rating" value={`${stats.avgRating}*`} />
            </div>
          </div>

          <div className="relative" id="terminal-preview">
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

              <div className="min-h-[360px] bg-[#0B0F14] p-5 font-mono text-[13px] leading-6 text-[#E6EDF3] sm:min-h-[400px] sm:text-sm">
                <div className="text-[#9DA7B3]">prod-eu-west-1 - bash</div>
                <div className="text-[#3FB950]">live incident</div>

                <div className="mt-4 text-[#F85149]">[12:04:11] requests failing up</div>
                <div className="text-[#F85149]">[12:04:13] nginx healthcheck failed</div>
                <div className="text-[#F85149]">[12:04:17] customer traffic impacted</div>

                <div className="mt-5">$ systemctl status nginx</div>
                <div className="text-[#F85149]">x nginx.service - failed (Result: exit-code)</div>
                <div className="text-[#9DA7B3]">Main PID: 1823 (code=exited, status=1/FAILURE)</div>

                <div className="mt-4">$ curl -I http://localhost</div>
                <div className="text-[#F85149]">curl: (7) Failed to connect to localhost port 80</div>

                <div className="mt-4 text-[#9DA7B3]">// the system is still down.</div>

                <div className="mt-6 text-[#E6EDF3]">$ journalctl -u nginx -n 50 --no-pager</div>
                <div className="text-[#D29922]">warning: upstream timeout threshold exceeded</div>

                <div className="mt-6 text-[#3FB950]">$</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#9DA7B3]">
              <span>{stats.labs} labs available</span>
              <span className="font-medium text-[#E6EDF3]">Avg rating {stats.avgRating}*</span>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0F141B] p-5">
            <div className="mb-4 text-xs uppercase tracking-wide text-[#9DA7B3]">
              Featured labs
            </div>
            <div className="grid gap-3">
              {featuredLabs.slice(0, 3).map((lab) => (
                <div
                  key={lab.slug}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[#E6EDF3]">{lab.title}</div>
                      <div className="mt-1 text-sm text-[#9DA7B3]">{lab.description}</div>
                    </div>
                    <div className="text-xs uppercase text-[#9DA7B3]">{lab.tier}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#9DA7B3]">
                    <span>{lab.durationMin} min</span>
                    <span>•</span>
                    <span>{lab.difficulty}</span>
                    <span>•</span>
                    <span>{lab.rating}*</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0F141B] p-5">
            <div className="mb-4 text-xs uppercase tracking-wide text-[#9DA7B3]">
              Pricing
            </div>
            <div className="text-3xl font-semibold text-[#E6EDF3]">
              {pricing.currency} {pricing.proMonthlyUsd}/mo
            </div>
            <div className="mt-2 text-sm text-[#9DA7B3]">
              Start with {pricing.freeLabs} free labs. Upgrade only when you want more depth.
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-[#9DA7B3]">
              Fast homepage payload. No auth, no progress calls, no checkout until user action.
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
