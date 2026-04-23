import React, { useEffect, useMemo, useRef, useState } from "react";
import AIPatchPanel from "./AIPatchPanel";
import { explainDiff } from "../services/explainDiff";

export default function ChainTerminalController({
  userId = "guest",
  tenantId = "demo",
  chainId = "web-stack-recovery",
  repoSourcePath = "/srv/winlab",
  onRequireSignup,
  onRequireUpgrade,
}) {
  const [chainState, setChainState] = useState(null);
  const [terminalLines, setTerminalLines] = useState([]);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [patchResult, setPatchResult] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [engagementScore, setEngagementScore] = useState(0);
  const terminalRef = useRef(null);

  useEffect(() => {
    bootstrapChain();
  }, [chainId]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    if (patchResult?.ok) {
      setShowSignup(true);
    } else if (engagementScore >= 3) {
      setShowSignup(true);
    }
  }, [patchResult, engagementScore]);

  async function bootstrapChain() {
    setLoading(true);
    setElapsed(0);
    setReviewResult(null);
    setPatchResult(null);
    setExplanation("");
    setShowAIPanel(false);
    setShowSignup(false);
    setShowUpgrade(false);

    try {
      const res = await fetch("/api/incident-chains/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          chainId,
        }),
      });

      const data = await res.json();
      const progress = data?.progress || null;
      const currentStep = getCurrentStep(progress);

      setChainState(progress);
      setTerminalLines([
        `[chain] ${chainId}`,
        "live recovery chain",
        "",
        "Multiple failures may be linked.",
        "Stabilize the stack step by step.",
        "",
        currentStep
          ? `[step ${currentStep.stepIndex + 1}/${progress.totalSteps}] ${currentStep.labId}`
          : "[step] no active step",
        "",
        'Type "help", "review", "patch", or "mentor".',
      ]);
    } catch (error) {
      setTerminalLines([
        "[chain] failed to initialize",
        error.message || "Unknown error",
      ]);
    } finally {
      setLoading(false);
    }
  }

  function appendTerminalLine(line) {
    setTerminalLines((prev) => [...prev, line]);
  }

  function getCurrentStep(progress) {
    if (!progress?.stepProgress?.length) return null;
    return (
      progress.stepProgress.find((step) => step.status === "IN_PROGRESS") ||
      progress.stepProgress.find((step) => step.status === "PENDING") ||
      null
    );
  }

  async function runChainStep(mode = "patch") {
    setLoading(true);
    setShowAIPanel(true);
    appendTerminalLine(
      mode === "review"
        ? "[ai] running scoped review on current step..."
        : "[ai] generating sandbox patch for current step..."
    );

    try {
      const res = await fetch("/api/incident-chain-runner/run-step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          tenantId,
          chainId,
          mode,
          repoSourcePath,
        }),
      });

      const data = await res.json();

      if (!data.ok && data?.error?.message?.toLowerCase().includes("not allowed")) {
        setShowUpgrade(true);
        onRequireUpgrade?.(data);
        appendTerminalLine("[access] this action is not available in your current plan/level");
        return;
      }

      if (!data.ok) {
        appendTerminalLine("[verify] current step failed");
        if (data?.labResult?.result?.text) {
          setReviewResult(data.labResult.result);
        }
        if (mode === "patch" && data?.labResult?.result) {
          setPatchResult(data.labResult.result);
        }
        return;
      }

      if (mode === "review" && data?.labResult?.result) {
        setReviewResult(data.labResult.result);
        appendTerminalLine("[ai] review completed");
        appendTerminalLine("[ai] root cause isolated");
        setEngagementScore((value) => value + 1);
        return;
      }

      if (mode === "patch" && data?.labResult?.result) {
        setPatchResult(data.labResult.result);
        setEngagementScore((value) => value + 2);
      }

      if (data.ok && !data.chainCompleted) {
        appendTerminalLine(`[verify] ${data.stepSuccessMessage || "Step completed."}`);
        appendTerminalLine("[incident] new failure surfaced");

        if (data.nextStep) {
          appendTerminalLine(
            `[step ${data.nextStep.stepIndex + 1}] ${data.nextStep.labId}`
          );
        }

        await refreshChainStatus();
        return;
      }

      if (data.ok && data.chainCompleted) {
        appendTerminalLine("[chain] final verification passed");
        appendTerminalLine(`[incident] ${data.finalMessage || "Recovery completed."}`);

        if (data.chainScore) {
          appendTerminalLine(
            `[score] ${data.chainScore.grade} - ${data.chainScore.score}`
          );
        }

        setShowSignup(true);
        onRequireSignup?.(data);
        await refreshChainStatus();
      }
    } catch (error) {
      appendTerminalLine(`[chain] execution error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshChainStatus() {
    try {
      const res = await fetch(
        `/api/incident-chains/progress?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const current = items.find((item) => item.chainId === chainId) || null;

      if (current) {
        setChainState(current);
      }
    } catch {
      // Best-effort refresh only; terminal state still shows latest local action.
    }
  }

  function handleExplain(diff) {
    const text = explainDiff(diff || "");
    setExplanation(text);
    appendTerminalLine("[ai] explanation generated");
  }

  function handleCommandSubmit(event) {
    event.preventDefault();

    const raw = command.trim();
    if (!raw) return;

    appendTerminalLine(`winlab@recovery-chain:~$ ${raw}`);

    const cmd = raw.toLowerCase();

    if (cmd === "help") {
      appendTerminalLine("Available commands:");
      appendTerminalLine("- help");
      appendTerminalLine("- status");
      appendTerminalLine("- review");
      appendTerminalLine("- patch");
      appendTerminalLine("- mentor");
      appendTerminalLine("- clear");
    } else if (cmd === "status") {
      const step = getCurrentStep(chainState);
      appendTerminalLine(
        step
          ? `Current step: ${step.stepIndex + 1}/${chainState?.totalSteps} - ${step.labId}`
          : "No active step."
      );
    } else if (cmd === "review") {
      runChainStep("review");
    } else if (cmd === "patch") {
      runChainStep("patch");
    } else if (cmd === "mentor") {
      setShowAIPanel(true);
      setEngagementScore((value) => value + 1);
      appendTerminalLine("AI Incident Mentor opened.");
    } else if (cmd === "clear") {
      setTerminalLines([]);
    } else {
      appendTerminalLine(`command not found: ${raw}`);
    }

    setCommand("");
  }

  const currentStep = useMemo(() => getCurrentStep(chainState), [chainState]);
  const completedSteps = useMemo(() => {
    return chainState?.stepProgress?.filter((step) => step.status === "COMPLETED").length || 0;
  }, [chainState]);

  return (
    <div className="grid min-h-[720px] overflow-hidden rounded-3xl border border-zinc-800 bg-black text-white lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col border-r border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <div className="text-sm text-zinc-400">recovery-chain - bash</div>
            <div className="text-xs text-zinc-600">{chainId}</div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-zinc-500">timer: {elapsed}s</span>
            <span className="text-zinc-500">
              progress: {completedSteps}/{chainState?.totalSteps || 0}
            </span>
          </div>
        </div>

        <div
          ref={terminalRef}
          className="flex-1 overflow-auto bg-black p-4 font-mono text-sm leading-7"
        >
          {terminalLines.map((line, idx) => (
            <div key={`${idx}-${line}`} className={lineClassName(line)}>
              {line}
            </div>
          ))}

          {reviewResult?.text && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
                AI Review
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-200">
                {reviewResult.text}
              </pre>
            </div>
          )}

          {explanation && (
            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
                Patch Explanation
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-200">
                {explanation}
              </pre>
            </div>
          )}
        </div>

        <form
          onSubmit={handleCommandSubmit}
          className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-4 py-3"
        >
          <span className="font-mono text-sm text-zinc-500">
            winlab@recovery-chain:~$
          </span>

          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-600"
            placeholder='type "help", "review", or "patch"'
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-white px-3 py-2 text-sm text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            Run
          </button>
        </form>
      </div>

      <div className="flex flex-col bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Chain status
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-black p-4">
            <StatusRow label="Chain" value={chainId} />
            <StatusRow
              label="Current step"
              value={
                currentStep
                  ? `${currentStep.stepIndex + 1}/${chainState?.totalSteps || 0} - ${currentStep.labId}`
                  : "completed"
              }
            />
            <StatusRow
              label="Completed steps"
              value={`${completedSteps}/${chainState?.totalSteps || 0}`}
            />
            <StatusRow label="State" value={chainState?.status || "IN_PROGRESS"} />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => runChainStep("review")}
              disabled={loading}
              className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              Review step
            </button>
            <button
              type="button"
              onClick={() => runChainStep("patch")}
              disabled={loading}
              className="flex-1 rounded-xl bg-white px-4 py-2 text-sm text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              Patch step
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {showAIPanel ? (
            <AIPatchPanel
              result={patchResult}
              onRunVerify={() => runChainStep("patch")}
              onExplain={handleExplain}
            />
          ) : (
            <div className="p-4 text-sm text-zinc-500">
              Open the mentor with <span className="font-mono text-zinc-200">mentor</span>,
              <span className="font-mono text-zinc-200"> review</span>, or
              <span className="font-mono text-zinc-200"> patch</span>.
            </div>
          )}
        </div>

        {showUpgrade && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="mb-2 text-sm text-zinc-500">Upgrade</div>
              <div className="mb-2 text-base font-medium">
                This level or action is locked.
              </div>
              <p className="mb-4 text-sm text-zinc-400">
                Unlock advanced chains, higher levels, and full AI actions with Pro.
              </p>
              <button
                type="button"
                onClick={() => onRequireUpgrade?.({ reason: "advanced_access" })}
                className="w-full rounded-xl bg-white px-4 py-2 text-black"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}

        {showSignup && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="mb-2 text-sm text-zinc-500">Continue</div>
              <div className="mb-2 text-base font-medium">Save your recovery run.</div>
              <p className="mb-4 text-sm text-zinc-400">
                Create your account to save chain progress, scores, and unlock advanced incident tracks.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRequireSignup?.({ reason: "save_progress" })}
                  className="flex-1 rounded-xl bg-white px-4 py-2 text-black"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignup(false)}
                  className="flex-1 rounded-xl bg-zinc-800 px-4 py-2"
                >
                  Continue as guest
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right text-zinc-200">{String(value)}</span>
    </div>
  );
}

function lineClassName(line) {
  if (/^\[verify\]/i.test(line)) return "text-yellow-400";
  if (/^\[incident\]/i.test(line)) return "text-red-400";
  if (/^\[chain\]/i.test(line)) return "text-cyan-400";
  if (/^\[score\]/i.test(line)) return "text-green-400";
  if (/^\[access\]/i.test(line)) return "text-orange-400";
  if (/^\[ai\]/i.test(line)) return "text-purple-400";
  if (/^winlab@recovery-chain:~\$/i.test(line)) return "text-zinc-200";
  return "text-zinc-400";
}
