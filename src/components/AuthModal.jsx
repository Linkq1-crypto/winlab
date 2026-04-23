import React, { useEffect } from "react";

export default function AuthModal({
  open,
  mode = "signup",
  context = "success",
  user = null,
  score = null,
  grade = null,
  title,
  description,
  primaryLabel,
  secondaryLabel = "Not now",
  onClose,
  onPrimary,
  onSecondary,
}) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && open) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const copy = resolveModalCopy({
    mode,
    context,
    user,
    score,
    grade,
    title,
    description,
    primaryLabel,
    secondaryLabel,
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {copy.kicker}
            </div>
            <div className="mt-1 text-sm text-zinc-400">{copy.subkicker}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-zinc-500 hover:bg-zinc-900 hover:text-white"
            aria-label="Close modal"
          >
            x
          </button>
        </div>

        <div className="px-6 py-6">
          <h2 className="text-2xl font-semibold leading-tight md:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 md:text-base">
            {copy.description}
          </p>

          {(score != null || grade != null) && (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
                Run result
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Score" value={score ?? "-"} />
                <Metric label="Grade" value={grade ?? "-"} />
              </div>
            </div>
          )}

          {copy.bullets.length > 0 && (
            <div className="mt-5 grid gap-3">
              {copy.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300"
                >
                  {item}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onPrimary}
              className="flex-1 rounded-2xl bg-white px-5 py-3 font-medium text-black hover:bg-zinc-200"
            >
              {copy.primaryLabel}
            </button>
            <button
              type="button"
              onClick={onSecondary || onClose}
              className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 font-medium hover:bg-black"
            >
              {copy.secondaryLabel}
            </button>
          </div>

          <div className="mt-4 text-xs text-zinc-600">{copy.footer}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{String(value)}</div>
    </div>
  );
}

function resolveModalCopy({
  mode,
  context,
  score,
  grade,
  title,
  description,
  primaryLabel,
  secondaryLabel,
}) {
  if (title || description) {
    return {
      kicker: mode === "upgrade" ? "Upgrade" : "Continue",
      subkicker: "WinLab",
      title: title || "Continue your run",
      description: description || "Create your account to keep going.",
      bullets: [],
      primaryLabel: primaryLabel || (mode === "upgrade" ? "Upgrade" : "Create account"),
      secondaryLabel,
      footer: "You can continue later.",
    };
  }

  if (mode === "upgrade" && context === "locked_level") {
    return {
      kicker: "Level locked",
      subkicker: "Advanced access",
      title: "This level is where the real pressure starts.",
      description:
        "Unlock higher difficulty modes to get less guidance, more ambiguity, and stronger scoring.",
      bullets: [
        "Mid and Senior difficulty",
        "Harder incident conditions",
        "Deeper scoring and progression",
      ],
      primaryLabel: primaryLabel || "Upgrade to Pro",
      secondaryLabel,
      footer: "Pro unlocks advanced levels and full incident depth.",
    };
  }

  if (mode === "upgrade" && context === "locked_chain") {
    return {
      kicker: "Chain locked",
      subkicker: "Multi-step recovery",
      title: "This recovery chain is part of the paid tracks.",
      description:
        "Unlock multi-step incidents where fixing one failure reveals the next one underneath.",
      bullets: [
        "Full incident chains",
        "Save and resume progress",
        "Chain scoring and leaderboard",
      ],
      primaryLabel: primaryLabel || "Unlock Pro",
      secondaryLabel,
      footer: "Paid tracks are designed for deeper replayability.",
    };
  }

  if (mode === "signup" && context === "success") {
    return {
      kicker: "Incident stabilized",
      subkicker: "Save your run",
      title:
        grade || score != null
          ? `You recovered the incident${grade ? ` - ${grade}` : ""}.`
          : "You recovered the incident.",
      description:
        "Create your account to save this result, keep your score, and unlock the next incidents.",
      bullets: [
        "Save progress and scores",
        "Track your incident history",
        "Unlock more labs and chains",
      ],
      primaryLabel: primaryLabel || "Create free account",
      secondaryLabel,
      footer: "No videos. No theory. Just failures.",
    };
  }

  if (mode === "signup" && context === "progress") {
    return {
      kicker: "Keep going",
      subkicker: "Save your progress",
      title: "You are in the interesting part now.",
      description:
        "Create your account to keep your place, keep your history, and continue from where you left off.",
      bullets: [
        "Resume unfinished incidents",
        "Keep your recovery history",
        "Unlock tracked progression",
      ],
      primaryLabel: primaryLabel || "Create account",
      secondaryLabel,
      footer: "Your progress matters more once the system starts to open up.",
    };
  }

  return {
    kicker: mode === "upgrade" ? "Upgrade" : "Continue",
    subkicker: "WinLab",
    title: mode === "upgrade" ? "Unlock more of the system." : "Save your progress.",
    description:
      mode === "upgrade"
        ? "Upgrade to access advanced chains, higher levels, and full AI actions."
        : "Create your account to keep your run, score, and incident history.",
    bullets: [
      "Progress tracking",
      "Scoring and history",
      "More labs and deeper modes",
    ],
    primaryLabel: primaryLabel || (mode === "upgrade" ? "Upgrade" : "Create account"),
    secondaryLabel,
    footer: "Built for engineers who want signal, not hand-holding.",
  };
}
