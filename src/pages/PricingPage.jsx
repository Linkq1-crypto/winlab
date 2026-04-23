import React from "react";

export default function PricingPage({
  user = null,
  onStartFree,
  onBuyFounding,
  onBuyPro,
  onBuyLifetime,
}) {
  const currentPlan = user?.plan || "FREE";

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm text-zinc-400">WINLAB</div>
            <div className="text-xs text-zinc-600">pricing</div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="text-sm text-zinc-400 hover:text-white">
              Sign in
            </button>
            <button
              type="button"
              onClick={onStartFree}
              className="rounded-2xl bg-white px-4 py-2 text-black hover:bg-zinc-200"
            >
              Start Free
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="max-w-4xl">
          <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
            Access
          </div>

          <h1 className="text-4xl font-semibold leading-[0.95] tracking-tight md:text-6xl">
            Train on failures that feel real.
          </h1>

          <p className="mt-5 max-w-3xl text-lg text-zinc-400">
            Start free, save your progress when it matters, and unlock deeper
            incident tracks as the system gets harder.
          </p>
        </section>

        <section className="mt-10 grid gap-5 xl:grid-cols-4">
          <PlanCard
            title="Free"
            price="Free"
            subtitle="Enter the system"
            active={currentPlan === "FREE"}
            features={[
              "5 free labs",
              "Novice + Junior",
              "Limited chains",
              "Basic AI access",
              "Try before you commit",
            ]}
            ctaLabel="Start Free"
            onClick={onStartFree}
          />

          <PlanCard
            title="Founding Unlock"
            price="$5"
            subtitle="One-time early access"
            badge="Best entry"
            highlight
            features={[
              "Save progress",
              "Founder badge",
              "Early supporter status",
              "Unlock tracked progression",
              "Best way to get in early",
            ]}
            ctaLabel="Get Founding Unlock"
            onClick={onBuyFounding}
            footnote="One-time unlock. Ideal after your first successful run."
          />

          <PlanCard
            title="Pro"
            price="$19/mo"
            subtitle="For real usage"
            active={currentPlan === "PRO"}
            features={[
              "All labs",
              "Mid + Senior modes",
              "Full chains",
              "Full AI actions",
              "Scoring, history, leaderboard",
            ]}
            ctaLabel="Start Pro"
            onClick={onBuyPro}
          />

          <PlanCard
            title="Lifetime"
            price="$199"
            subtitle="Own your training"
            active={currentPlan === "LIFETIME"}
            features={[
              "Everything included",
              "Future expansions",
              "Advanced chains",
              "Hardcore / SRE direction",
              "No recurring subscription",
            ]}
            ctaLabel="Get Lifetime"
            onClick={onBuyLifetime}
          />
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
              Why this pricing works
            </div>

            <h2 className="mb-4 text-2xl font-semibold md:text-3xl">
              Do not pay before the dopamine hit.
            </h2>

            <div className="space-y-4 text-zinc-400">
              <p>
                Free access should let people feel the product. That means real
                incidents, a real terminal, and enough room to understand the value.
              </p>
              <p>
                The first payment should happen after the user stabilizes something
                and wants to save the run, not before they have felt the pressure.
              </p>
              <p>
                Pro unlocks the depth. Lifetime is for people who already know this
                is how they want to train.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
              What unlocks when
            </div>

            <div className="grid gap-3">
              <FeatureRow
                title="Free"
                text="Learn the loop: debug -> AI -> patch -> verify"
              />
              <FeatureRow
                title="Founding Unlock"
                text="Save progress and make the experience yours"
              />
              <FeatureRow
                title="Pro"
                text="Unlock harder levels, full chains, and deeper progression"
              />
              <FeatureRow title="Lifetime" text="Own everything and future expansions" />
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
          <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
            Included in paid access
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniFeature text="Save progress and resume later" />
            <MiniFeature text="Multi-step recovery chains" />
            <MiniFeature text="Scoring and leaderboard" />
            <MiniFeature text="Higher difficulty modes" />
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 p-8">
          <div className="max-w-3xl">
            <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
              Final note
            </div>

            <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
              No videos. No theory. Just failures.
            </h2>

            <p className="mt-4 text-zinc-400">
              Start free. When you feel the system open up, choose how deep you want
              to go.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStartFree}
                className="rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200"
              >
                Start Free
              </button>
              <button
                type="button"
                onClick={onBuyPro}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black"
              >
                View Pro
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PlanCard({
  title,
  price,
  subtitle,
  features,
  ctaLabel,
  onClick,
  highlight = false,
  badge = null,
  active = false,
  footnote = null,
}) {
  return (
    <div
      className={`flex flex-col rounded-3xl border p-5 ${
        highlight
          ? "border-white bg-white text-black"
          : active
            ? "border-green-500 bg-zinc-950"
            : "border-zinc-800 bg-zinc-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm ${highlight ? "text-black/70" : "text-zinc-500"}`}>
            {title}
          </div>
          <div className="mt-2 text-3xl font-semibold">{price}</div>
          <div className={`mt-2 text-sm ${highlight ? "text-black/70" : "text-zinc-400"}`}>
            {subtitle}
          </div>
        </div>

        {badge && (
          <div
            className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
              highlight ? "bg-black text-white" : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {badge}
          </div>
        )}
      </div>

      <div className="mt-6 grid flex-1 gap-3">
        {features.map((feature) => (
          <div
            key={feature}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              highlight
                ? "border-black/10 bg-black/5 text-black"
                : "border-zinc-800 bg-black text-zinc-300"
            }`}
          >
            {feature}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`mt-6 rounded-2xl px-4 py-3 font-medium ${
          highlight
            ? "bg-black text-white hover:bg-zinc-800"
            : "bg-white text-black hover:bg-zinc-200"
        }`}
      >
        {ctaLabel}
      </button>

      {footnote && (
        <div className={`mt-3 text-xs ${highlight ? "text-black/60" : "text-zinc-500"}`}>
          {footnote}
        </div>
      )}
    </div>
  );
}

function FeatureRow({ title, text }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-zinc-500">{text}</div>
    </div>
  );
}

function MiniFeature({ text }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-zinc-300">
      {text}
    </div>
  );
}
