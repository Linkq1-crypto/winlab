// ProgressToast.jsx – Minimal geeky feedback for progress saves & achievements
// Terminal-style, no confetti, no fluff
import { useState, useEffect, useCallback } from "react";

// ─── Progress Bar Toast (terminal style) ─────────────────────────────────────
function ProgressToast({ message, visible }) {
  if (!visible) return null;

  const bars = Math.floor(Math.random() * 3) + 7; // 7-9 bars
  const bar = "█".repeat(bars) + "░".repeat(10 - bars);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono text-xs animate-fade-in-up">
      <div className="bg-slate-900 border border-emerald-600/30 rounded-lg px-4 py-2 shadow-lg shadow-emerald-600/10">
        <span className="text-emerald-400">[{bar}]</span>
        <span className="text-emerald-300 ml-2">{message}</span>
      </div>
    </div>
  );
}

// ─── Achievement Popup (geeky, no confetti) ──────────────────────────────────
function AchievementPopup({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setVisible(true), 100);
    // Auto-dismiss after 5s
    const t2 = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  if (!achievement) return null;

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-[#0a0a0b] border border-yellow-500/40 rounded-lg overflow-hidden shadow-lg shadow-yellow-500/20 min-w-[340px]">
        {/* Header */}
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <span className="text-yellow-400 text-sm">⚡ ACHIEVEMENT UNLOCKED</span>
          <button onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }} className="ml-auto text-slate-600 hover:text-white text-xs">✕</button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{achievement.icon}</span>
            <div>
              <p className="text-sm font-bold text-white">{achievement.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{achievement.desc}</p>
            </div>
          </div>

          {/* Terminal-style footer */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-600 font-mono">
              $ unlock --badge {achievement.id}
            </span>
            <span className="text-[10px] text-green-500 font-mono">
              ✓ done
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root Component (manages both) ───────────────────────────────────────────
export default function ProgressToastManager() {
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [achievement, setAchievement] = useState(null);

  // Listen for custom events from LabContext
  const handleProgressSave = useCallback((e) => {
    setProgressMessage(e.detail.message || "Progress saved");
    setProgressVisible(true);
    setTimeout(() => setProgressVisible(false), 2000);
  }, []);

  const handleAchievement = useCallback((e) => {
    setAchievement(e.detail);
  }, []);

  useEffect(() => {
    window.addEventListener("winlab-progress", handleProgressSave);
    window.addEventListener("winlab-achievement", handleAchievement);
    return () => {
      window.removeEventListener("winlab-progress", handleProgressSave);
      window.removeEventListener("winlab-achievement", handleAchievement);
    };
  }, [handleProgressSave, handleAchievement]);

  return (
    <>
      <ProgressToast message={progressMessage} visible={progressVisible} />
      <AchievementPopup achievement={achievement} onDismiss={() => setAchievement(null)} />
    </>
  );
}
