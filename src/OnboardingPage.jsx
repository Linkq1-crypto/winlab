// OnboardingFlow.jsx - Post-Stripe onboarding (auto-redirect to first mission)
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { trackEvent } from "./services/posthog";

export default function OnboardingPage({ onDone }) {
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    // Extract Stripe session ID from URL
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    if (sid) setSessionId(sid);

    // Track onboarding started
    trackEvent("onboarding_started", { session_id: sid });

    // Auto-progress through onboarding steps
    const steps = [
      () => setStep(1),
      () => setStep(2),
      () => setStep(3),
      () => {
        trackEvent("onboarding_completed");
        if (onDone) onDone();
        else window.location.href = "/lab/first-mission";
      },
    ];

    let delay = 500;
    steps.forEach((fn, i) => {
      setTimeout(fn, delay + i * 800);
    });
  }, [onDone]);

  const steps = [
    { icon: "✅", text: "Payment confirmed" },
    { icon: "🔧", text: "Setting up your lab environment..." },
    { icon: "🖥️", text: "Provisioning server instance..." },
    { icon: "🚀", text: "Launching your first mission..." },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-2xl font-black text-white mb-2">Welcome to WINLAB</h1>
          {sessionId && (
            <p className="text-xs text-slate-500 font-mono">Session: {sessionId.slice(0, 12)}...</p>
          )}
        </motion.div>

        {/* Progress steps */}
        <div className="space-y-6">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.2 }}
              className="flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                  i < step
                    ? "bg-green-500/20 border-2 border-green-500"
                    : i === step
                      ? "bg-blue-500/20 border-2 border-blue-500 animate-pulse"
                      : "bg-slate-800 border-2 border-slate-700"
                }`}
              >
                {i < step ? "✓" : s.icon}
              </div>
              <p
                className={`text-sm font-medium ${
                  i <= step ? "text-white" : "text-slate-600"
                }`}
              >
                {s.text}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Loading bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-10"
        >
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-green-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Footer message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-xs text-slate-500 mt-8"
        >
          Preparing your first real incident scenario...
        </motion.p>
      </div>
    </div>
  );
}
