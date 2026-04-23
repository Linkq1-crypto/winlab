export default function HeroSection({ onStart, onWatch }) {
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
              <button
                type="button"
                onClick={onStart}
                className="inline-flex items-center justify-center rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
              >
                Start first incident
              </button>

              <button
                type="button"
                onClick={onWatch}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#E6EDF3] transition hover:bg-white/10"
              >
                Watch it fail -&gt;
              </button>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-sm text-[#9DA7B3]">
                Joined by <span className="font-semibold text-[#E6EDF3]">12,000+</span> engineers from{" "}
                <span className="font-semibold text-[#E6EDF3]">120+ countries</span>
              </p>
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
              <span>24 labs available</span>
              <span className="font-medium text-[#E6EDF3]">Avg rating 4.8*</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
