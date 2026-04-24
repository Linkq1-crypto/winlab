const PRICING_PLANS = [
  {
    title: "Free",
    price: "\u20AC0",
    detail: (freeLabs) => `${freeLabs} free labs depending on backend config`,
    features: ["Real terminal environment", "No login before value", "Start with a real incident"],
  },
  {
    title: "Early Access Pro",
    price: "\u20AC5/month",
    badge: "Best entry",
    features: ["Locked early price", "All labs", "AI Mentor", "Certificates", "New incidents monthly"],
  },
  {
    title: "Regular Pro",
    price: "\u20AC19/month",
    features: ["Full access", "For users after early access period", "All labs and mentor tooling"],
  },
  {
    title: "Lifetime",
    price: "\u20AC199 one-time",
    features: ["Lifetime access", "Best value", "Own the training stack forever"],
  },
];

export default function LandingPricingSection({ freeLabs = 5, onPricing }) {
  return (
    <section className="border-t border-zinc-900 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Pricing</div>
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            [SYSTEM]: additional incidents locked
          </h2>
          <p className="mt-4 text-zinc-400">
            [SYSTEM]: upgrade required to continue routing.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.title}
              className={`rounded-3xl border p-5 ${
                plan.title === "Early Access Pro"
                  ? "border-white bg-white text-black"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-sm ${plan.title === "Early Access Pro" ? "text-black/70" : "text-zinc-500"}`}>
                    {plan.title}
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{plan.price}</div>
                  {plan.title === "Free" ? (
                    <div className="mt-2 text-sm text-zinc-400">{plan.detail(freeLabs)}</div>
                  ) : null}
                </div>
                {plan.badge ? (
                  <div className="rounded-full bg-black px-2 py-1 text-[10px] uppercase tracking-wide text-white">
                    {plan.badge}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <div
                    key={feature}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      plan.title === "Early Access Pro"
                        ? "border-black/10 bg-black/5 text-black"
                        : "border-zinc-800 bg-black text-zinc-300"
                    }`}
                  >
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onPricing}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black"
          >
            [SYSTEM]: view pricing
          </button>
        </div>
      </div>
    </section>
  );
}
