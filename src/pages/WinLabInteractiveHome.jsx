import React, { useEffect, useMemo, useRef, useState } from "react";
import AIPatchPanel from "../components/AIPatchPanel";
import { listIncidentChains } from "../config/incidentChains";
import { LEVEL_OPTIONS, getLevelConfig } from "../config/levels";
import {
  completeCurrentStep,
  createIncidentChainSession,
  getCurrentChainStep,
  markCurrentStepAttempt,
  startCurrentStep,
} from "../services/incidentChainEngine";
import { generateIncident, hasIncidentTemplate } from "../services/incidentGenerator";
import { explainDiff } from "../services/explainDiff";

const INCIDENTS = [
  {
    id: "api-timeout",
    labId: "memory-leak",
    title: "API Timeout",
    difficulty: "medium",
    status: "degraded",
    prompt: "Investigate rising latency and upstream timeouts.",
    logs: [
      "[12:04:11] requests failing: rising",
      "[12:04:13] p95 latency: 3241ms",
      "[12:04:14] upstream timeout detected",
      "[12:04:17] customer traffic impacted",
      "[12:04:19] retry storm observed",
      "[12:04:24] queue depth rising",
    ],
  },
  {
    id: "permission-denied",
    labId: "permission-denied",
    title: "Permission Denied",
    difficulty: "easy",
    status: "failing",
    prompt: "A service cannot write critical state safely.",
    logs: [
      "[09:17:02] worker failed to write checkpoint",
      "[09:17:05] permission denied: /var/lib/app/state.json",
      "[09:17:08] service degraded",
      "[09:17:11] recovery loop entered",
      "[09:17:15] write attempts blocked",
    ],
  },
  {
    id: "nginx-port-conflict",
    labId: "nginx-port-conflict",
    title: "Nginx Port Conflict",
    difficulty: "medium",
    status: "down",
    prompt: "The stack will not boot cleanly under load.",
    logs: [
      "[15:21:44] nginx start requested",
      "[15:21:45] bind() to 0.0.0.0:80 failed",
      "[15:21:45] address already in use",
      "[15:21:46] healthcheck failed",
      "[15:21:49] public traffic unavailable",
    ],
  },
];

const COMMAND_RESPONSES = {
  help: [
    "Available commands:",
    "- help",
    "- status",
    "- logs",
    "- mentor",
    "- clear",
    "- Type review or patch to use AI",
  ],
  status: ["Incident active. Pressure rising. Investigate before applying changes."],
  logs: ["Streaming latest incident logs..."],
  mentor: ["AI Incident Mentor available: review repo | generate patch | verify fix"],
  clear: [],
};

export default function WinLabInteractiveHome({
  tenantId = "demo-tenant",
  userId = "guest-user",
}) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(INCIDENTS[0].id);
  const [elapsed, setElapsed] = useState(0);
  const [terminalLines, setTerminalLines] = useState([]);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [patchResult, setPatchResult] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [engagementScore, setEngagementScore] = useState(0);
  const [levelId, setLevelId] = useState("JUNIOR");
  const [incidentSeed, setIncidentSeed] = useState(() => createSessionSeed("incident"));
  const [incidentVariant, setIncidentVariant] = useState(null);
  const [chainSession, setChainSession] = useState(null);

  const terminalRef = useRef(null);

  const incident = useMemo(
    () => INCIDENTS.find((item) => item.id === selectedIncidentId) || INCIDENTS[0],
    [selectedIncidentId]
  );
  const level = useMemo(() => getLevelConfig(levelId), [levelId]);
  const currentChainStep = useMemo(() => getCurrentChainStep(chainSession), [chainSession]);
  const activeLabId = currentChainStep?.labId || incident.labId;
  const activeVariantLabId = currentChainStep?.variantLabId || (incident.id === "api-timeout" ? "api-timeout" : incident.labId);

  useEffect(() => {
    setElapsed(0);
    setReviewResult(null);
    setPatchResult(null);
    setExplanation("");
    setShowAIPanel(false);
    setTerminalLines([
      `prod-eu-west-1 - ${incident.title}`,
      "live incident",
      "",
      currentChainStep ? `[chain] ${chainSession.title}` : incident.prompt,
      "",
      currentChainStep
        ? `[step ${currentChainStep.index + 1}/${chainSession.steps.length}] ${currentChainStep.labId}`
        : 'Type "help" or start debugging.',
    ]);
  }, [incident, chainSession, currentChainStep]);

  useEffect(() => {
    const nextVariant = hasIncidentTemplate(activeVariantLabId)
      ? generateIncident({
        labId: activeVariantLabId,
        seed: incidentSeed,
        level,
      })
      : null;

    setIncidentVariant(nextVariant);
  }, [activeVariantLabId, incidentSeed, levelId]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const signupTrigger =
      !!patchResult?.ok ||
      (patchResult?.quality?.score || 0) >= 85 ||
      engagementScore >= 3 ||
      elapsed >= 120;

    if (signupTrigger) {
      setShowSignup(true);
    }
  }, [patchResult, engagementScore, elapsed]);

  useEffect(() => {
    const stream = setInterval(() => {
      const sourceLogs = incidentVariant?.logs?.length ? incidentVariant.logs : incident.logs;
      appendTerminalLine(applyLevelNoise(pickRandom(sourceLogs), level));
    }, Math.max(2500, 5200 - level.difficulty * 450));

    return () => clearInterval(stream);
  }, [incident, incidentVariant, level]);

  useEffect(() => {
    if (!level.hintsEnabled || !level.hintFrequency) return undefined;

    const hint = setInterval(() => {
      appendTerminalLine("[hint] check logs for the first repeated failure signal");
    }, level.hintFrequency * 1000);

    return () => clearInterval(hint);
  }, [level]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  function appendTerminalLine(line) {
    setTerminalLines((prev) => [...prev, line]);
  }

  function handleCommandSubmit(event) {
    event.preventDefault();

    const raw = command.trim();
    if (!raw) return;

    appendTerminalLine(`winlab@prod-server:~$ ${raw}`);
    const normalized = raw.toLowerCase();

    if (normalized === "clear") {
      setTerminalLines([]);
      setCommand("");
      return;
    }

    if (normalized === "review") {
      if (!level.ai.allowReview) {
        appendTerminalLine(`[ai] review disabled at ${level.label} level`);
        setCommand("");
        return;
      }
      setShowAIPanel(true);
      setEngagementScore((value) => value + 1);
      runReview();
      setCommand("");
      return;
    }

    if (normalized === "patch") {
      if (!level.ai.allowPatch) {
        appendTerminalLine(`[ai] patch disabled at ${level.label} level`);
        setCommand("");
        return;
      }
      setShowAIPanel(true);
      setEngagementScore((value) => value + 1);
      runPatch();
      setCommand("");
      return;
    }

    const response = COMMAND_RESPONSES[normalized];
    if (response) {
      response.forEach((line) => appendTerminalLine(line));
      if (normalized === "mentor") {
        setShowAIPanel(true);
      }
      setEngagementScore((value) => value + 1);
    } else {
      appendTerminalLine(`command not found: ${raw}`);
    }

    setCommand("");
  }

  async function runReview() {
    setLoading(true);
    appendTerminalLine("[ai] running scoped review...");

    try {
      const result = await runLabAI({
        tenantId,
        userId,
        labId: activeLabId,
        mode: "review",
        level: level.id,
        incidentSeed,
        variantLabId: activeVariantLabId,
      });

      setReviewResult(result);
      setShowAIPanel(true);

      if (result?.text) {
        appendTerminalLine("[ai] review completed");
        appendTerminalLine("[ai] root cause isolated");
      } else {
        appendTerminalLine("[ai] no review content returned");
      }
    } catch (error) {
      appendTerminalLine(`[ai] review failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runPatch() {
    setLoading(true);
    appendTerminalLine("[ai] generating sandbox patch...");
    setTimeout(() => appendTerminalLine("[verify] executing checks..."), 400);

    try {
      const result = await runLabAI({
        tenantId,
        userId,
        labId: activeLabId,
        mode: "patch",
        level: level.id,
        incidentSeed,
        variantLabId: activeVariantLabId,
      });

      setPatchResult(result);
      setShowAIPanel(true);

      if (result?.ok) {
        appendTerminalLine("[verify] patch passed");
        handleStepSuccess();
      } else {
        appendTerminalLine("[verify] patch failed or partial");
      }
    } catch (error) {
      appendTerminalLine(`[ai] patch failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function startChain(chainId) {
    const session = createIncidentChainSession(chainId, {
      seed: createSessionSeed(chainId),
    });
    startCurrentStep(session);
    setChainSession({ ...session });
    setIncidentSeed(`${session.seed}:0`);
    setShowSignup(false);
    appendTerminalLine(`[chain] ${session.title}`);
    appendTerminalLine(`[step 1/${session.steps.length}] ${session.steps[0].labId}`);
  }

  function handleStepSuccess() {
    if (!chainSession) {
      appendTerminalLine("[incident] service stabilized");
      return;
    }

    const updated = structuredClone(chainSession);
    markCurrentStepAttempt(updated, { usedAI: true });
    const completedStep = getCurrentChainStep(updated);
    completeCurrentStep(updated);

    appendTerminalLine(`[verify] ${completedStep?.successMessage || "step restored"}`);

    if (updated.completed) {
      appendTerminalLine("[chain] final verification passed");
      appendTerminalLine(`[incident] ${updated.finalMessage}`);
      setShowSignup(true);
      recordChain(updated);
    } else {
      const nextStep = getCurrentChainStep(updated);
      appendTerminalLine("[incident] new failure surfaced");
      appendTerminalLine(`[next] ${nextStep.labId}`);
      setIncidentSeed(`${updated.seed}:${nextStep.index}`);
    }

    setChainSession({ ...updated });
  }

  async function recordChain(session) {
    try {
      await fetch("/api/lab-progress/chains/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
    } catch {
      // Guest sessions still complete locally.
    }
  }

  function handleExplain(diff) {
    const text = explainDiff(diff);
    setExplanation(text);
    appendTerminalLine("[ai] patch explanation generated");
  }

  function handleOpenIncident(id) {
    setSelectedIncidentId(id);
    setEngagementScore((value) => value + 1);
  }

  const liveStatus = useMemo(() => {
    if (patchResult?.ok) return "stabilized";
    if (loading) return "analyzing";
    return incident.status;
  }, [patchResult, loading, incident.status]);

  return (
    <div className="min-h-screen bg-black text-white">
      <TopBar />

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="min-h-[640px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <div className="text-sm text-zinc-400">prod-eu-west-1 - bash</div>
                <div className="text-xs text-zinc-600">{incident.title}</div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-zinc-500">{level.label}</span>
                {incidentVariant && (
                  <span className="text-zinc-500">seed: {incidentVariant.seed}</span>
                )}
                <span className={statusBadgeClass(liveStatus)}>{liveStatus}</span>
                <span className="text-zinc-500">timer: {elapsed}s</span>
              </div>
            </div>

            <div
              ref={terminalRef}
              className="h-[470px] overflow-auto bg-black p-4 font-mono text-sm leading-7"
            >
              {terminalLines.map((line, index) => (
                <div key={`${index}-${line}`} className={lineClassName(line)}>
                  {line}
                </div>
              ))}

              {reviewResult?.text && (
                <TerminalPanel title="AI Review">
                  {reviewResult.text}
                </TerminalPanel>
              )}

              {explanation && (
                <TerminalPanel title="Patch Explanation">
                  {explanation}
                </TerminalPanel>
              )}
            </div>

            <form
              onSubmit={handleCommandSubmit}
              className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-4 py-3"
            >
              <span className="font-mono text-sm text-zinc-500">winlab@prod-server:~$</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-600"
                placeholder='type "help", "review", or "patch"'
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-white px-3 py-2 text-sm text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                Run
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4">
            <HeroSideCard
              incident={incident}
              liveStatus={liveStatus}
              elapsed={elapsed}
              onReview={() => {
                if (!level.ai.allowReview) {
                  appendTerminalLine(`[ai] review disabled at ${level.label} level`);
                  return;
                }
                setShowAIPanel(true);
                setEngagementScore((value) => value + 1);
                runReview();
              }}
              onPatch={() => {
                if (!level.ai.allowPatch) {
                  appendTerminalLine(`[ai] patch disabled at ${level.label} level`);
                  return;
                }
                setShowAIPanel(true);
                setEngagementScore((value) => value + 1);
                runPatch();
              }}
              loading={loading}
              level={level}
            />

            <LevelSelector levelId={level.id} onChange={setLevelId} />

            <ChainSelector
              activeChainId={chainSession?.chainId || ""}
              onStartChain={startChain}
            />

            <IncidentSelector
              incidents={INCIDENTS}
              selectedIncidentId={selectedIncidentId}
              onOpenIncident={handleOpenIncident}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-h-[420px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="text-sm text-zinc-400">AI Incident Mentor</div>
              <div className="text-xs text-zinc-600">review repo - generate patch - verify fix</div>
            </div>

            {showAIPanel ? (
              <AIPatchPanel
                result={patchResult}
                onRunVerify={runPatch}
                onExplain={handleExplain}
              />
            ) : (
              <div className="p-6 text-sm text-zinc-500">
                Open the mentor with <span className="font-mono text-zinc-300">mentor</span>,
                <span className="font-mono text-zinc-300"> review</span>, or
                <span className="font-mono text-zinc-300"> patch</span>.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Why this feels real
            </div>

            <h3 className="mb-3 text-2xl font-semibold leading-tight">
              Real pressure. Real reasoning. Real validation.
            </h3>

            <p className="mb-6 text-sm text-zinc-400">
              Broken services, incomplete clues, scoped AI review, sandbox patches,
              and verification that either passes or fails.
            </p>

            <div className="grid gap-3">
              <MiniMetric label="Live status" value={liveStatus} />
              <MiniMetric label="Difficulty" value={incident.difficulty} />
              <MiniMetric label="Level" value={level.label} />
              <MiniMetric label="Variant" value={incidentVariant?.rootCauseId || "-"} />
              <MiniMetric label="Chain" value={chainSession?.title || "single lab"} />
              <MiniMetric label="AI quality" value={patchResult?.quality?.grade || "-"} />
              <MiniMetric label="Verify" value={patchResult?.ok ? "passed" : "pending"} />
            </div>
          </div>
        </section>

        {showSignup && (
          <section className="mt-6">
            <SignupCTA patchResult={patchResult} />
          </section>
        )}
      </main>
    </div>
  );
}

async function runLabAI(payload) {
  const res = await fetch("/api/ai/lab/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error || "AI request failed");
  }

  return data?.result || null;
}

function TopBar() {
  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <div className="text-sm tracking-wide text-zinc-400">WINLAB</div>
        <div className="flex items-center gap-3">
          <button className="text-sm text-zinc-400 hover:text-white">Sign in</button>
          <button className="rounded bg-white px-4 py-2 text-sm text-black hover:bg-zinc-200">
            Start Free
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSideCard({ incident, liveStatus, elapsed, onReview, onPatch, loading, level }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
        Live Incident
      </div>

      <h1 className="text-4xl font-semibold leading-none tracking-tight md:text-5xl">
        Your server is down.
        <br />
        Fix it.
      </h1>

      <p className="mt-4 text-sm text-zinc-400">
        Real production failures. Real terminals. Real fixes.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <InfoPill label="Incident" value={incident.title} />
        <InfoPill label="Difficulty" value={incident.difficulty} />
        <InfoPill label="Status" value={liveStatus} />
        <InfoPill label="Timer" value={`${elapsed}s`} />
        <InfoPill label="AI" value={level.ai.allowPatch ? "review + patch" : level.ai.allowReview ? "review only" : "off"} />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onReview}
          disabled={loading || !level.ai.allowReview}
          className="rounded bg-zinc-800 px-4 py-3 text-sm hover:bg-zinc-700 disabled:opacity-50"
        >
          Ask AI review
        </button>
        <button
          onClick={onPatch}
          disabled={loading || !level.ai.allowPatch}
          className="rounded bg-white px-4 py-3 text-sm text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          Generate patch
        </button>
      </div>
    </div>
  );
}

function LevelSelector({ levelId, onChange }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 text-xs uppercase tracking-wide text-zinc-500">
        Operator Level
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LEVEL_OPTIONS.map((item) => {
          const active = item === levelId;
          const config = getLevelConfig(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`rounded border px-3 py-2 text-left text-sm transition ${
                active
                  ? "border-white bg-black text-white"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-black"
              }`}
            >
              <div className="font-medium">{config.label}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {config.ai.allowPatch ? "AI patch" : config.ai.allowReview ? "review only" : "no AI"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChainSelector({ activeChainId, onStartChain }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 text-xs uppercase tracking-wide text-zinc-500">
        Incident Chains
      </div>
      <div className="grid gap-2">
        {listIncidentChains().map((chain) => (
          <button
            key={chain.id}
            type="button"
            onClick={() => onStartChain(chain.id)}
            className={`rounded border px-3 py-2 text-left text-sm transition ${
              activeChainId === chain.id
                ? "border-white bg-black text-white"
                : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-black"
            }`}
          >
            <div className="font-medium">{chain.title}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {chain.steps.length} steps - {chain.difficulty}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function IncidentSelector({ incidents, selectedIncidentId, onOpenIncident }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 text-xs uppercase tracking-wide text-zinc-500">
        Incident Tracks
      </div>

      <div className="grid gap-3">
        {incidents.map((incident) => {
          const active = incident.id === selectedIncidentId;
          return (
            <button
              key={incident.id}
              onClick={() => onOpenIncident(incident.id)}
              className={`rounded border p-4 text-left transition ${
                active
                  ? "border-white bg-black"
                  : "border-zinc-800 bg-zinc-950 hover:bg-black"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{incident.title}</div>
                <div className="text-xs text-zinc-500">{incident.difficulty}</div>
              </div>
              <div className="mt-2 text-sm text-zinc-400">{incident.prompt}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SignupCTA({ patchResult }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 md:p-8">
      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
        Continue
      </div>

      <h2 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
        {patchResult?.ok
          ? "Incident stabilized. Save your progress."
          : "Unlock full incident tracks and keep going."}
      </h2>

      <p className="mt-4 max-w-2xl text-zinc-400">
        Create your account to save scores, unlock more labs, and continue from
        where you left off.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded bg-white px-5 py-3 text-black hover:bg-zinc-200">
          Create free account
        </button>
        <button className="rounded border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black">
          Continue as guest
        </button>
      </div>
    </div>
  );
}

function TerminalPanel({ title, children }) {
  return (
    <div className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <pre className="whitespace-pre-wrap text-xs text-zinc-200">
        {children}
      </pre>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded border border-zinc-800 bg-black px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded border border-zinc-800 bg-black px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-200">{String(value)}</div>
    </div>
  );
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createSessionSeed(prefix) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function applyLevelNoise(line, level) {
  if (Math.random() < level.noiseLevel) {
    return pickRandom([
      "[noise] unrelated cron job completed",
      "[noise] background metric scrape delayed",
      "[noise] rotated access log",
      "[noise] stale health probe ignored",
    ]);
  }

  if (level.logClarity < 0.5 && Math.random() > level.logClarity) {
    return line.replace(/\b(timeout|failed|denied|conflict)\b/gi, "signal");
  }

  return line;
}

function statusBadgeClass(status) {
  if (status === "stabilized") return "text-emerald-400";
  if (status === "analyzing") return "text-yellow-400";
  if (status === "degraded") return "text-orange-400";
  if (status === "failing" || status === "down") return "text-red-400";
  return "text-zinc-400";
}

function lineClassName(line) {
  if (/\b(failing|timeout|degraded|impacted|denied|failed|down)\b/i.test(line)) {
    return "text-red-400";
  }
  if (/\b(stabilized|passed|healthy|recovered)\b/i.test(line)) {
    return "text-emerald-400";
  }
  if (/^\[ai\]/i.test(line)) return "text-violet-300";
  if (/^\[verify\]/i.test(line)) return "text-yellow-300";
  if (/^\[incident\]/i.test(line)) return "text-cyan-300";
  if (/^winlab@prod-server:~\$/i.test(line)) return "text-zinc-200";
  return "text-zinc-400";
}
