export default function LandingFeaturedLabs({ featuredLabs }) {
  return (
    <section className="border-t border-zinc-900 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Featured labs</div>
            <h2 className="text-3xl font-semibold leading-tight">Real failures, not toy problems.</h2>
          </div>
          <div className="max-w-md text-sm text-zinc-400">
            The landing only loads public data once. The full incident starts only after the user asks for it.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {featuredLabs.slice(0, 3).map((lab) => (
            <article key={lab.slug} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium">{lab.title}</div>
                  <div className="mt-2 text-sm text-zinc-400">{lab.description}</div>
                </div>
                <div className="rounded-full border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
                  {lab.tier}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span>{lab.durationMin} min</span>
                <span>{"\u2022"}</span>
                <span>{lab.difficulty}</span>
                <span>{"\u2022"}</span>
                <span>{lab.rating}*</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
