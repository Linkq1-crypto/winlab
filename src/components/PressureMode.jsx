// PressureMode.jsx - Timer + stress UI for immersive experience
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function PressureMode({ initialTime = 90, onComplete }) {
  const [time, setTime] = useState(initialTime);
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (time <= 0) {
      setActive(false);
      setCompleted(true);
      if (onComplete) onComplete();
      return;
    }

    const interval = setInterval(() => {
      setTime((t) => t - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [active, time, onComplete]);

  const startPressure = () => {
    setActive(true);
    setTime(initialTime);
    setCompleted(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const percentage = (time / initialTime) * 100;
  const isCritical = time < 20;
  const isUrgent = time < 10;

  if (!active && !completed) {
    return (
      <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-6 text-center">
        <h3 className="text-lg font-bold text-yellow-400 mb-2">⏱️ Pressure Mode</h3>
        <p className="text-sm text-slate-400 mb-4">
          Simulate real production pressure. You have 90 seconds to diagnose and fix the issue.
        </p>
        <button
          onClick={startPressure}
          className="px-6 py-2.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-semibold rounded-lg hover:bg-yellow-500/30 transition-all"
        >
          Start Pressure Test →
        </button>
      </div>
    );
  }

  if (completed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border border-red-500/30 bg-red-500/5 rounded-xl p-6 text-center"
      >
        <span className="text-3xl mb-2 block">⏰</span>
        <h3 className="text-lg font-bold text-red-400 mb-2">Time's Up!</h3>
        <p className="text-sm text-slate-400">
          In production, this would be a real outage. Practice more to get faster.
        </p>
      </motion.div>
    );
  }

  return (
    <div
      className={`border rounded-xl p-6 transition-all ${
        isUrgent
          ? "border-red-500/60 bg-red-500/10 animate-pulse"
          : isCritical
            ? "border-orange-500/50 bg-orange-500/10"
            : "border-yellow-500/30 bg-yellow-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className={`text-lg font-bold ${
            isUrgent ? "text-red-400" : isCritical ? "text-orange-400" : "text-yellow-400"
          }`}
        >
          ⏱️ Pressure Mode Active
        </h3>
        <span
          className={`text-2xl font-black font-mono ${
            isUrgent ? "text-red-400" : isCritical ? "text-orange-400" : "text-yellow-400"
          }`}
        >
          {formatTime(time)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className={`h-full rounded-full transition-all ${
            isUrgent
              ? "bg-red-500"
              : isCritical
                ? "bg-orange-500"
                : "bg-yellow-500"
          }`}
          initial={{ width: "100%" }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1 }}
        />
      </div>

      {/* Status messages */}
      <div className="text-sm font-mono space-y-1">
        {isUrgent && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400"
          >
            ⚠️ CRITICAL — Users are reporting issues!
          </motion.p>
        )}
        {isCritical && !isUrgent && (
          <p className="text-orange-400">⚡ Time running low — focus on the fix</p>
        )}
        {!isCritical && (
          <p className="text-yellow-400">🔍 Investigate the issue — check logs first</p>
        )}
      </div>

      {/* AI Mentor hint under pressure */}
      {isCritical && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg"
        >
          <p className="text-xs text-blue-300">
            🤖 <strong>AI Mentor:</strong> Under pressure, focus on fundamentals. Check the error
            logs first, then verify configuration.
          </p>
        </motion.div>
      )}
    </div>
  );
}
