import React, { useEffect, useMemo, useState } from "react";
import AIPatchPanel from "./components/AIPatchPanel";
import { track } from "./analytics";
import { explainDiff } from "./services/explainDiff";

export default function WinLabExperience({
  labId,
  tenantId = "demo",
  userId = "guest",
  onSignup,
  onContinueGuest,
}) {
  const [phase, setPhase] = useState("incident");
  const [elapsed, setElapsed] = useState(0);
  const [reviewResult, setReviewResult] = useState(null);
  const [patchResult, setPatchResult] = useState(null);
  const [showSignup, setShowSignup] = useState(false);
  const [signupTrigger, setSignupTrigger] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiUseCount, setAiUseCount] = useState(0);

  useEffect(() => {
    track("lab_started", { labId });
  }, [labId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const score = patchResult?.quality?.score || 0;
    let trigger = null;

    if (patchResult?.ok) trigger = "verify_passed";
    else if (score >= 85) trigger = "high_quality_patch";
    else if (aiUseCount >= 2) trigger = "second_ai_use";
    else if (elapsed >= 120) trigger = "engagement_120s";

    if (trigger && !showSignup) {
      setShowSignup(true);
      setSignupTrigger(trigger);
      track("signup_shown", { labId, trigger });
    }

    if (patchResult?.ok) {
      setPhase("solved");
    }
  }, [aiUseCount, elapsed, labId, patchResult, showSignup]);

  async function runAI(mode) {
    setLoading(true);
    setError("");
    track(mode === "review" ? "ai_review_clicked" : "ai_patch_clicked", { labId });

    try {
      const res = await fetch("/api/ai/lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          userId,
          labId,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "AI request failed");
      }

      setAiUseCount((value) => value + 1);

      if (mode === "review") {
        setReviewResult(data.result || null);
        setPhase("reviewed");
      } else {
        const nextPatch = data.result || null;
        setPatchResult(nextPatch);
        setPhase(nextPatch?.ok ? "solved" : "patched");

        if (nextPatch?.ok) {
          track("patch_verify_passed", {
            labId,
            score: nextPatch?.quality?.score,
          });
        }
      }
    } catch (err) {
      setError(err?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleExplain(diff) {
    setExplanation(explainDiff(diff));
  }

  function handleSignup() {
    track("signup_clicked", { labId, trigger: signupTrigger });
    onSignup?.();
  }

  const statusText = useMemo(() => {
    if (patchResult?.ok) return "incident stabilized";
    if (loading) return "analyzing incident";
    if (phase === "reviewed") return "root cause isolated";
    if (phase === "patched") return "patch tested in sandbox";
    return "requests failing: rising";
  }, [loading, patchResult, phase]);

  return (
    <div className="grid h-screen grid-cols-1 bg-black text-white lg:grid-cols-[1.2fr_0.8fr]">
      <section className="flex min-h-0 flex-col border-r border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="text-sm text-zinc-400">prod-eu-west-1 - bash</div>
          <div className="text-xs text-red-300">live incident</div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 font-mono text-sm">
          <div className="mb-3 text-zinc-500">timer: {elapsed}s</div>
          <div className={patchResult?.ok ? "text-emerald-300" : "text-red-300"}>{statusText}</div>
          <div className="mt-3 text-zinc-300">latency critical</div>
          <div className="text-zinc-300">5xx errors increasing</div>
          <div className="mt-6 text-zinc-500">Type "help" or start debugging.</div>

          {error && (
            <div className="mt-6 rounded border border-red-900/80 bg-red-950/40 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          {reviewResult?.text && (
            <div className="mt-8 rounded border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                AI review
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-200">
                {reviewResult.text}
              </pre>
            </div>
          )}

          {explanation && (
            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                Patch explanation
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-200">
                {explanation}
              </pre>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={() => runAI("review")}
            disabled={loading}
            className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            Ask AI review
          </button>

          <button
            type="button"
            onClick={() => runAI("patch")}
            disabled={loading}
            className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            Generate patch
          </button>
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-zinc-950">
        <div className="min-h-0 flex-1">
          <AIPatchPanel
            result={patchResult}
            onRunVerify={() => runAI("patch")}
            onExplain={handleExplain}
          />
        </div>

        {showSignup && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Continue
            </div>
            <h3 className="mb-2 text-xl font-semibold">
              Save your progress and unlock full incident tracks
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              Keep your scores, unlock more labs, and train on real production failures.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSignup}
                className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-zinc-200"
              >
                Create free account
              </button>
              <button
                type="button"
                onClick={() => {
                  track("signup_skipped", { labId, trigger: signupTrigger });
                  onContinueGuest?.();
                }}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
              >
                Continue as guest
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
