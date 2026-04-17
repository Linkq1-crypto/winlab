// PricingTable.jsx – Region-aware pricing: India (₹) + Global (€/$)
import { useState, useEffect } from "react";
import { useLab } from "./LabContext";

// Region detection via timezone + locale (fallback for IP-based)
function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Mumbai")) return "IN";
  } catch {}
  try {
    const lang = navigator.language || navigator.languages?.[0] || "";
    if (lang.toLowerCase().includes("in")) return "IN";
  } catch {}
  return "GLOBAL";
}

const PRICING_IN = {
  starter:  { id: "starter",  name: "Starter",  price: 0,      currency: "₹", label: "Free forever",
    features: ["✓  Linux Terminal lab", "✓  3 AI Mentor hints", "✓  Basic progress tracking", "✗  RAID, vSphere, SSSD labs", "✗  AI Challenge Generator", "✗  Certification"],
    cta: "Current plan", ctaActive: true },
  pro:      { id: "pro",      name: "Pro",      price: 999,    currency: "₹", label: "/month",
    features: ["✓  All 8 labs unlocked", "✓  Unlimited AI Mentor hints", "✓  AI Challenge Generator", "✓  Certification of Excellence", "✓  Progress saved in cloud", "✗  Team Dashboard"],
    cta: "Upgrade to Pro" },
  business: { id: "business", name: "Business", price: 4999,   currency: "₹", label: "/month",
    features: ["✓  Everything in Pro", "✓  All 10 labs (Network + Security)", "✓  Team Dashboard", "✓  Track employee progress", "✓  Bulk seat management", "✓  Priority support + SLA"],
    cta: "Contact Sales" },
};

const PRICING_GLOBAL = {
  starter:  { id: "starter",  name: "Starter",  price: 0,   currency: "€", label: "Free forever",
    features: ["✓  Linux Terminal lab", "✓  3 AI Mentor hints", "✓  Basic progress tracking", "✗  RAID, vSphere, SSSD labs", "✗  AI Challenge Generator", "✗  Certification"],
    cta: "Current plan", ctaActive: true },
  pro:      { id: "pro",      name: "Pro",      price: 19,  currency: "€", label: "/month",
    features: ["✓  All 8 labs unlocked", "✓  Unlimited AI Mentor hints", "✓  AI Challenge Generator", "✓  Certification of Excellence", "✓  Progress saved in cloud", "✗  Team Dashboard"],
    cta: "Upgrade to Pro" },
  business: { id: "business", name: "Business", price: 99,  currency: "€", label: "/month",
    features: ["✓  Everything in Pro", "✓  All 10 labs (Network + Security)", "✓  Team Dashboard", "✓  Track employee progress", "✓  Bulk seat management", "✓  Priority support + SLA"],
    cta: "Contact Sales" },
};

// Dynamic PLANS array based on detected region — set below in component

export default function PricingTable({ onClose, onNeedLogin }) {
  const { plan, token, user } = useLab();
  const [loading, setLoading] = useState(null);
  const [region, setRegion] = useState("GLOBAL");

  useEffect(() => {
    const detected = detectRegion();
    setRegion(detected);
  }, []);

  // Build plans with region-specific pricing
  const source = region === "IN" ? PRICING_IN : PRICING_GLOBAL;
  const PLANS = [
    { ...source.starter,  color: "border-slate-700", accent: "text-slate-300", btnClass: "bg-slate-700 hover:bg-slate-600 text-white", highlight: false },
    { ...source.pro,      color: "border-blue-600",  accent: "text-blue-400",  btnClass: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30", highlight: true, badge: "Most Popular" },
    { ...source.business, color: "border-purple-600", accent: "text-purple-400", btnClass: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30", badge: "B2B" },
  ];

  async function handleUpgrade(planId) {
    if (planId === "starter") return;
    if (planId === "business") {
      window.location.href = "mailto:sales@winlab.cloud?subject=Business Plan Inquiry&body=Hello WinLab Team,%0A%0AI'd like to learn more about the Business plan for my organization.%0A%0ACompany: %0ATeam Size: %0A%0AThank you.";
      return;
    }
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }

    // Razorpay for India, Stripe for global
    if (region === "IN") {
      // Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: source[planId].price * 100, // paise
        currency: "INR",
        name: "WINLAB",
        description: `${source[planId].name} Plan`,
        handler: function(response) {
          // Verify on backend
          fetch("/api/billing/verify-razorpay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, plan: planId })
          }).then(r => r.json()).then(data => {
            if (data.success) window.location.reload();
          });
        },
        prefill: { email: user?.email || "", name: user?.name || "" },
        theme: { color: "#2563eb" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
      return;
    }

    // Stripe for global
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">Choose your plan</h2>
        <p className="text-slate-400">
          Start free. Upgrade when you're ready to go deeper.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map(p => (
          <div
            key={p.id}
            className={`
              relative flex flex-col rounded-2xl border p-7
              ${p.highlight
                ? "bg-blue-600/5 border-blue-600 scale-[1.02]"
                : "bg-slate-900/80 " + p.color}
            `}
          >
            {/* Badge */}
            {p.badge && (
              <span className={`
                absolute -top-3 left-1/2 -translate-x-1/2
                text-xs font-semibold px-3 py-1 rounded-full
                ${p.highlight ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}
              `}>
                {p.badge}
              </span>
            )}

            {/* Header */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">{p.name}</h3>
              <div className="flex items-end gap-1 mt-2">
                <span className={`text-4xl font-black ${p.accent}`}>
                  {p.price === 0 ? "Free" : `${p.currency}${p.price}`}
                </span>
                {p.price > 0 && (
                  <span className="text-slate-500 text-sm mb-1">{p.label}</span>
                )}
              </div>
            </div>

            {/* Features */}
            <ul className="flex-1 space-y-2.5 mb-8">
              {p.features.map((f, i) => (
                <li
                  key={i}
                  className={`text-sm ${f.startsWith("✓") ? "text-slate-300" : "text-slate-600"}`}
                >
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => handleUpgrade(p.id)}
              disabled={plan === p.id || loading === p.id}
              className={`
                w-full py-3 rounded-lg font-semibold text-sm transition-all
                ${plan === p.id
                  ? "bg-slate-800 text-slate-500 cursor-default"
                  : p.btnClass}
                ${loading === p.id ? "opacity-60 cursor-wait" : ""}
              `}
            >
              {loading === p.id
                ? "Loading…"
                : plan === p.id
                  ? "Current plan ✓"
                  : p.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Trust line */}
      <p className="text-center text-slate-600 text-xs mt-8">
        Secure payments via Stripe · Cancel anytime · No hidden fees
      </p>

      {/* Referral Section */}
      <div className="mt-12 bg-slate-900/80 border border-green-600/20 rounded-xl p-6 font-mono">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white mb-1">
            <span className="text-green-400">$</span> Referral Program
          </h3>
          <p className="text-slate-400 text-sm">Deploy discounts through peer networking or corporate escalation</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Peer Referral */}
          <div className="bg-slate-800/60 border border-green-600/30 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👥</span>
              <h4 className="text-sm font-semibold text-green-400">Peer Peering</h4>
              <span className="ml-auto text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">-20%</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Invite a friend. When they deploy a PRO plan, you get a <span className="text-yellow-400">-20% discount</span> on your next renewal.
            </p>
            <div className="text-xs text-slate-500">
              <div className="text-slate-400 mb-1">Token format:</div>
              <code className="bg-slate-900 px-2 py-1 rounded text-green-400">WIN-REF-88-20OFF</code>
            </div>
          </div>

          {/* Corporate Referral */}
          <div className="bg-slate-800/60 border border-purple-600/30 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏢</span>
              <h4 className="text-sm font-semibold text-purple-400">Corporate Escalation</h4>
              <span className="ml-auto text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">-30%</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Refer WINLAB to your company. When your Organization activates a Business plan, you get <span className="text-yellow-400">-30% Root Privilege</span> discount.
            </p>
            <div className="text-xs text-slate-500">
              <div className="text-slate-400 mb-1">Token format:</div>
              <code className="bg-slate-900 px-2 py-1 rounded text-purple-400">WIN-CORP-A1B2-30OFF</code>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            💡 Already have a referral code? Apply it at checkout or in your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
