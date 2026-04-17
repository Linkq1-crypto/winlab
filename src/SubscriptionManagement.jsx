/**
 * Subscription Management UI
 * Dashboard component for managing Stripe subscription
 * - View current plan and status
 * - Upgrade / downgrade plan
 * - Cancel / resume subscription
 * - View payment history
 * - Access billing portal
 */
import { useState, useEffect, useCallback } from "react";

// ─── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    trial: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    past_due: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    canceled: "bg-red-500/10 text-red-400 border-red-500/20",
    paused: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    none: "bg-slate-600/10 text-slate-400 border-slate-600/20",
  };

  const labels = {
    active: "Active",
    trial: "Free Trial",
    past_due: "Payment Overdue",
    canceled: "Canceled",
    paused: "Paused",
    none: "No Subscription",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.none}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Current Plan Card ───────────────────────────────────────────────────────
function CurrentPlanCard({ subscription, onManage, onCancel, onResume, onUpgrade }) {
  const periodEnd = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Current Plan</h3>
          <div className="mt-1">
            <StatusBadge status={subscription.status} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white capitalize">{subscription.plan || "Free"}</p>
          <p className="text-slate-400 text-xs">
            {subscription.status === "trial" ? "Free trial" : "Plan"}
          </p>
        </div>
      </div>

      {/* Billing Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-slate-500">Next billing date</p>
          <p className="text-white font-medium">{periodEnd}</p>
        </div>
        <div>
          <p className="text-slate-500">Auto-renewal</p>
          <p className="text-white font-medium">
            {subscription.cancelAtPeriodEnd ? (
              <span className="text-yellow-400">Canceling at period end</span>
            ) : (
              <span className="text-emerald-400">Enabled</span>
            )}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onManage}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Manage Billing
        </button>

        {subscription.status === "active" && (
          <>
            <button
              onClick={onUpgrade}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Upgrade to Business
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel Subscription
            </button>
          </>
        )}

        {subscription.cancelAtPeriodEnd && (
          <button
            onClick={onResume}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 rounded-lg text-sm font-medium transition-colors"
          >
            Resume Subscription
          </button>
        )}

        {subscription.status === "past_due" && (
          <button
            onClick={onManage}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Update Payment Method
          </button>
        )}
      </div>
    </div>
  );
}

// ─── No Subscription Card ────────────────────────────────────────────────────
function NoSubscriptionCard({ onSubscribe }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-8 text-center">
      <div className="text-4xl mb-4">🚀</div>
      <h3 className="text-xl font-bold text-white mb-2">No Active Subscription</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">
        Start with a 7-day free trial, or pay per lab scenario.
      </p>
      <button
        onClick={() => onSubscribe("pro")}
        className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-lg font-bold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/30"
      >
        Start Free Trial →
      </button>
    </div>
  );
}

// ─── Payment History Table ───────────────────────────────────────────────────
function PaymentHistory({ payments }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h4 className="text-white font-semibold mb-4">Payment History</h4>
        <p className="text-slate-500 text-sm text-center py-8">No payments yet.</p>
      </div>
    );
  }

  const statusColors = {
    succeeded: "text-emerald-400",
    failed: "text-red-400",
    pending: "text-yellow-400",
    refunded: "text-slate-400",
  };

  const typeLabels = {
    subscription: "Subscription",
    one_time: "One-time",
    invoice: "Invoice",
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h4 className="text-white font-semibold">Payment History</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase">
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-left px-6 py-3">Type</th>
              <th className="text-left px-6 py-3">Description</th>
              <th className="text-right px-6 py-3">Amount</th>
              <th className="text-right px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 10).map((payment) => (
              <tr key={payment.id} className="border-t border-slate-700/50">
                <td className="px-6 py-3 text-slate-300">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-slate-300">
                  {typeLabels[payment.type] || payment.type}
                </td>
                <td className="px-6 py-3 text-slate-400 text-xs max-w-[200px] truncate">
                  {payment.description || "—"}
                </td>
                <td className="px-6 py-3 text-white text-right font-mono">
                  {(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                </td>
                <td className={`px-6 py-3 text-right font-medium ${statusColors[payment.status] || "text-slate-400"}`}>
                  {payment.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cancel Confirmation Modal ───────────────────────────────────────────────
function CancelModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-white mb-2">Cancel Subscription?</h3>
        <p className="text-slate-400 text-sm mb-6">
          Your access will continue until the end of your current billing period.
          You won't be charged again after that.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Keep Subscription
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SubscriptionManagement({ token, onNeedLogin }) {
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [subRes, payRes] = await Promise.all([
        fetch("/api/stripe/subscription", {
          headers: { },
        }),
        fetch("/api/stripe/payments", {
          headers: { },
        }),
      ]);

      const subData = await subRes.json();
      const payData = await payRes.json();

      setSubscription(subData);
      setPayments(payData.payments || []);
    } catch (err) {
      console.error("Failed to fetch subscription data:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubscribe = async (plan) => {
    if (!token) {
      if (onNeedLogin) onNeedLogin();
      return;
    }
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, currency: "usd" }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    }
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading("portal");
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading("cancel");
      setShowCancelModal(false);
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.success) {
        await fetchData(); // Refresh data
      } else {
        alert(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading("resume");
      const res = await fetch("/api/stripe/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || "Failed to resume subscription");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async () => {
    try {
      setActionLoading("upgrade");
      const res = await fetch("/api/stripe/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPlan: "business", currency: "usd" }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || "Failed to upgrade");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="text-slate-400">Loading subscription data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Billing & Subscription</h2>
        <p className="text-slate-400">Manage your plan, view invoices, and update payment methods.</p>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {subscription?.hasSubscription ? (
          <CurrentPlanCard
            subscription={subscription}
            onManage={handleManageBilling}
            onCancel={() => setShowCancelModal(true)}
            onResume={handleResume}
            onUpgrade={handleUpgrade}
          />
        ) : (
          <NoSubscriptionCard onSubscribe={handleSubscribe} />
        )}

        {/* Payment History */}
        {token && <PaymentHistory payments={payments} />}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelModal
          onConfirm={handleCancel}
          onCancel={() => setShowCancelModal(false)}
        />
      )}

      {/* Loading overlay */}
      {actionLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl px-6 py-4 text-white">
            <svg className="animate-spin h-5 w-5 mr-2 inline" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </div>
        </div>
      )}
    </div>
  );
}
