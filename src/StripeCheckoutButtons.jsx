/**
 * Stripe Checkout Buttons Component
 * Reusable checkout buttons for subscription + pay-per-incident
 * Drop-in component for any page that needs Stripe checkout
 */
import { useState, useCallback } from "react";
import { trackEvent } from "./lib/track.js";

// ─── Subscription Checkout Button ────────────────────────────────────────────
export function SubscribeButton({
  plan = "pro",
  currency = "usd",
  token,
  children,
  className = "",
  onNeedLogin,
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    trackEvent("pricing_clicked", { source: "StripeCheckoutButtons", plan, cta: "subscribe" });
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }
    trackEvent("checkout_started", { source: "StripeCheckoutButtons", plan, currency });
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, currency }),
      });

      if (!res.ok) {
        const err = await res.json();
        trackEvent("checkout_failed", { source: "StripeCheckoutButtons", plan, currency, statusCode: res.status });
        throw new Error(err.error || "Checkout failed");
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      trackEvent("checkout_failed", { source: "StripeCheckoutButtons", plan, currency });
      console.error("Stripe checkout error:", err);
      alert(err.message || "Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [plan, currency, token, onNeedLogin]);

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`stripe-btn ${className} ${loading ? "opacity-60 cursor-wait" : ""}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Pay-Per-Incident Checkout Button ────────────────────────────────────────
export function PayPerLabButton({
  labId,
  currency = "usd",
  token,
  children,
  className = "",
  onNeedLogin,
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = useCallback(async () => {
    trackEvent("pricing_clicked", { source: "StripeCheckoutButtons", labId, cta: "pay_per_lab" });
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }
    trackEvent("checkout_started", { source: "StripeCheckoutButtons", labId, currency });
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/pay-per-incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currency, labId }),
      });

      if (!res.ok) {
        const err = await res.json();
        trackEvent("checkout_failed", { source: "StripeCheckoutButtons", labId, currency, statusCode: res.status });
        throw new Error(err.error || "Checkout failed");
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      trackEvent("checkout_failed", { source: "StripeCheckoutButtons", labId, currency });
      console.error("Stripe checkout error:", err);
      alert(err.message || "Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [labId, currency, token, onNeedLogin]);

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`stripe-btn ${className} ${loading ? "opacity-60 cursor-wait" : ""}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Billing Portal Button (Manage Subscription) ─────────────────────────────
export function BillingPortalButton({
  token,
  children,
  className = "",
  onNeedLogin,
}) {
  const [loading, setLoading] = useState(false);

  const handlePortal = useCallback(async () => {
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to open billing portal");
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Billing portal error:", err);
      alert(err.message || "Failed to open billing portal. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, onNeedLogin]);

  return (
    <button
      onClick={handlePortal}
      disabled={loading}
      className={`stripe-btn ${className} ${loading ? "opacity-60 cursor-wait" : ""}`}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}

// ─── Quick Checkout Card (for lab pages) ──────────────────────────────────────
export function LabCheckoutCard({ labId, token, onNeedLogin }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h4 className="text-white font-semibold mb-1">Unlock This Lab</h4>
      <p className="text-slate-400 text-sm mb-4">
        Get instant access to this scenario.
      </p>
      <div className="flex flex-wrap gap-2">
        <PayPerLabButton
          labId={labId}
          currency="usd"
          token={token}
          onNeedLogin={onNeedLogin}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Buy — $19
        </PayPerLabButton>
        <SubscribeButton
          plan="pro"
          currency="usd"
          token={token}
          onNeedLogin={onNeedLogin}
          className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Or get Pro ($19/mo)
        </SubscribeButton>
      </div>
    </div>
  );
}

// ─── Subscription Status Banner ──────────────────────────────────────────────
export function SubscriptionBanner({ token }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/api/stripe/subscription", {
      headers: { },
    })
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading || !subscription?.hasSubscription) {
    return null;
  }

  const statusColors = {
    active: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    trial: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    past_due: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    canceled: "bg-red-500/10 border-red-500/20 text-red-400",
    paused: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  };

  const statusClass = statusColors[subscription.status] || statusColors.active;

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${statusClass}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          subscription.status === "active" ? "bg-emerald-400 animate-pulse" :
          subscription.status === "trial" ? "bg-blue-400 animate-pulse" :
          "bg-currentColor"
        }`} />
        <span className="font-medium capitalize">
          {subscription.plan} plan · {subscription.status}
        </span>
        {subscription.cancelAtPeriodEnd && (
          <span className="text-xs text-slate-400">
            (cancels {new Date(subscription.periodEnd).toLocaleDateString()})
          </span>
        )}
      </div>
      <BillingPortalButton
        token={token}
        className="text-xs underline opacity-80 hover:opacity-100"
      >
        Manage
      </BillingPortalButton>
    </div>
  );
}

// Default export with all components
export default {
  SubscribeButton,
  PayPerLabButton,
  BillingPortalButton,
  LabCheckoutCard,
  SubscriptionBanner,
};
