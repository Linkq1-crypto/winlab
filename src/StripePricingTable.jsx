/**
 * Stripe Pricing Table Component
 * Modern pricing page with region-aware pricing (USD/INR)
 * Supports both subscription and pay-per-incident models
 */
import { useState, useEffect, useCallback } from "react";

// ─── Region Detection ────────────────────────────────────────────────────────
function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Mumbai")) return "IN";
  } catch {}
  try {
    const lang = navigator.language || navigator.languages?.[0] || "";
    if (lang.toLowerCase().includes("in")) return "IN";
  } catch {}
  return "US";
}

// ─── Pricing Data ────────────────────────────────────────────────────────────
const PRICING = {
  US: {
    subscriptions: [
      {
        id: "pro",
        name: "Pro",
        price: 19,
        currency: "$",
        period: "/month",
        description: "For individual engineers who want unlimited practice.",
        features: [
          "All lab scenarios unlocked",
          "Unlimited AI Mentor hints",
          "AI Challenge Generator",
          "Certificate of Excellence",
          "Progress saved in cloud",
          "7-day free trial",
        ],
        badge: "Most Popular",
        highlight: true,
        cta: "Start Free Trial →",
      },
      {
        id: "business",
        name: "Business",
        price: 99,
        currency: "$",
        period: "/month",
        description: "For teams that need management dashboards and tracking.",
        features: [
          "Everything in Pro",
          "All premium labs (Network, Security)",
          "Team Dashboard",
          "Track employee progress",
          "Bulk seat management",
          "Priority support + SLA",
        ],
        badge: "B2B",
        highlight: false,
        cta: "Contact Sales",
        isEmail: true,
      },
    ],
    payPerIncident: { price: 19, currency: "$", period: "/lab" },
  },
  IN: {
    subscriptions: [
      {
        id: "pro",
        name: "Pro",
        price: 199,
        currency: "₹",
        period: "/month",
        description: "Individual engineers — practice real skills, get real jobs.",
        features: [
          "All lab scenarios unlocked",
          "Unlimited AI Mentor hints",
          "AI Challenge Generator",
          "Certificate of Excellence",
          "Progress saved in cloud",
          "7-day free trial",
        ],
        badge: "Most Popular",
        highlight: true,
        cta: "Start Free Trial →",
      },
      {
        id: "business",
        name: "Business",
        price: 999,
        currency: "₹",
        period: "/month",
        description: "Team training with management dashboards.",
        features: [
          "Everything in Pro",
          "All premium labs (Network, Security)",
          "Team Dashboard",
          "Track employee progress",
          "Bulk seat management",
          "Priority support + SLA",
        ],
        badge: "B2B",
        highlight: false,
        cta: "Contact Sales",
        isEmail: true,
      },
    ],
    payPerIncident: { price: 20, currency: "₹", period: "/lab" },
  },
};

// ─── Subscription Card ───────────────────────────────────────────────────────
function SubscriptionCard({ plan, region, token, onNeedLogin }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (plan.isEmail) {
      window.location.href = "mailto:sales@winlab.cloud?subject=Business Plan Inquiry&body=Hello WinLab Team,%0A%0AI'd like to learn more about the Business plan for my organization.%0A%0ACompany: %0ATeam Size: %0A%0AThank you.";
      return;
    }
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }
    setLoading(true);
    try {
      const currency = region === "IN" ? "inr" : "usd";
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: plan.id, currency }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [plan, region, token, onNeedLogin]);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 ${
        plan.highlight
          ? "bg-emerald-600/5 border-emerald-500/50 scale-[1.02] shadow-lg shadow-emerald-500/10"
          : "bg-slate-900/80 border-slate-700/50 hover:border-slate-600"
      }`}
    >
      {plan.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full ${
            plan.highlight
              ? "bg-emerald-500 text-white"
              : "bg-purple-600 text-white"
          }`}
        >
          {plan.badge}
        </span>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
        <p className="text-slate-400 text-sm mt-1">{plan.description}</p>
        <div className="flex items-end gap-1 mt-4">
          <span className={`text-5xl font-black ${plan.highlight ? "text-emerald-400" : "text-white"}`}>
            {plan.currency}{plan.price}
          </span>
          <span className="text-slate-500 text-sm mb-1.5">{plan.period}</span>
        </div>
      </div>

      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full py-3.5 rounded-lg font-semibold text-sm transition-all ${
          plan.highlight
            ? "bg-emerald-500 hover:bg-emerald-400 text-slate-900 hover:shadow-lg hover:shadow-emerald-500/30"
            : "bg-slate-700 hover:bg-slate-600 text-white"
        } ${loading ? "opacity-60 cursor-wait" : ""}`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </span>
        ) : (
          plan.cta
        )}
      </button>
    </div>
  );
}

// ─── Pay-Per-Incident Banner ─────────────────────────────────────────────────
function PayPerIncidentBanner({ region, token, labId }) {
  const [loading, setLoading] = useState(false);
  const pricing = PRICING[region];
  const { price, currency, period } = pricing.payPerIncident;

  const handleCheckout = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const curr = region === "IN" ? "inr" : "usd";
      const res = await fetch("/api/stripe/pay-per-incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currency: curr, labId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-700/50 bg-slate-900/60 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div>
        <h4 className="text-white font-semibold">Don't want a subscription?</h4>
        <p className="text-slate-400 text-sm">
          Pay only for what you use — {currency}{price}{period}
        </p>
      </div>
      <button
        onClick={handleCheckout}
        disabled={loading || !token}
        className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        {loading ? "Loading..." : `Buy Lab Access — ${currency}${price}`}
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function StripePricingTable({ token, onNeedLogin, labId, currentPlan }) {
  const [region, setRegion] = useState("US");

  useEffect(() => {
    const detected = detectRegion();
    setRegion(detected);
  }, []);

  const pricing = PRICING[region];
  const plans = pricing.subscriptions;

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-4">
          Pricing
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
          {region === "IN" ? "Choose Your Plan" : "Invest in Your Skills"}
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-lg">
          {region === "IN"
            ? "Real practice. Real jobs. Start with free labs, upgrade when you're ready."
            : "Stop reading docs. Fix real-world incidents in a live sandbox."}
        </p>
      </div>

      {/* Plan Toggle (Monthly / Pay-per-use) */}
      <div className="flex justify-center gap-4 mb-10">
        <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-1">
          <span className="px-4 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 text-sm font-medium">
            Monthly
          </span>
          <span className="px-4 py-1.5 text-slate-500 text-sm">Pay-per-use</span>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {plans.map((plan) => (
          <SubscriptionCard
            key={plan.id}
            plan={plan}
            region={region}
            token={token}
            onNeedLogin={onNeedLogin}
          />
        ))}
      </div>

      {/* Pay-Per-Incident */}
      {token && (
        <PayPerIncidentBanner region={region} token={token} labId={labId} />
      )}

      {/* Trust signals */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-slate-500 text-sm">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Secure payments via Stripe
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          7-day free trial
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Cancel anytime
        </span>
      </div>

      {/* Billing support */}
      <div className="mt-6 text-center text-xs text-slate-600">
        <span>Payment issues? </span>
        <a href="mailto:billing@winlab.cloud" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">billing@winlab.cloud</a>
        <span className="mx-2">·</span>
        <span>General inquiries? </span>
        <a href="mailto:hello@winlab.cloud" className="text-slate-400 hover:text-slate-300 underline underline-offset-2">hello@winlab.cloud</a>
      </div>
    </div>
  );
}
