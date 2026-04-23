import React, { useMemo, useState } from "react";
import ChainTerminalController from "./ChainTerminalController";
import { getLevelConfig, LEVELS } from "../config/levels";
import { INCIDENT_CHAINS } from "../config/incidentChains";

const FREE_LEVELS = new Set(["NOVICE", "JUNIOR"]);
const FREE_CHAINS = new Set(["web-stack-recovery"]);

export default function ChainLaunchExperience({
  user = null,
  repoSourcePath = "/srv/winlab",
  onSignup,
  onUpgrade,
}) {
  const [selectedLevel, setSelectedLevel] = useState("JUNIOR");
  const [selectedChainId, setSelectedChainId] = useState("web-stack-recovery");
  const [started, setStarted] = useState(false);

  const isLoggedIn = Boolean(user?.id);
  const plan = user?.plan || "FREE";
  const level = useMemo(() => getLevelConfig(selectedLevel), [selectedLevel]);
  const chain = INCIDENT_CHAINS[selectedChainId] || INCIDENT_CHAINS["web-stack-recovery"];
  const access = useMemo(() => {
    return evaluateAccess({
      plan,
      levelId: selectedLevel,
      chainId: selectedChainId,
    });
  }, [plan, selectedLevel, selectedChainId]);

  function handleStart() {
    if (!access.allowed) {
      const payload = {
        reason: access.reason,
        levelId: selectedLevel,
        chainId: selectedChainId,
      };

      if (!isLoggedIn) {
        onSignup?.(payload);
      } else {
        onUpgrade?.(payload);
      }
      return;
    }

    setStarted(true);
  }

  if (started) {
    return (
      <div className="min-h-screen bg-black p-4 md:p-6">
        <ChainTerminalController
          userId={user?.id || "guest"}
          tenantId="demo"
          chainId={selectedChainId}
          repoSourcePath={repoSourcePath}
          onRequireSignup={(payload) =>
            onSignup?.({
              ...payload,
              reason: payload?.reason || "save_progress",
              levelId: selectedLevel,
              chainId: selectedChainId,
            })
          }
          onRequireUpgrade={(payload) =>
            onUpgrade?.({
              ...payload,
              reason: payload?.reason || "advanced_access",
              levelId: selectedLevel,
              chainId: selectedChainId,
            })
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <div className="text-sm text-zinc-400">WINLAB</div>
                <div className="text-xs text-zinc-600">interactive incident chains</div>
              </div>
              <div className="text-xs text-zinc-500">{plan}</div>
            </div>

            <div className="p-5 md:p-6">
              <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
                Start a recovery run
              </div>

              <h1 className="text-4xl font-semibold leading-[0.95] tracking-tight md:text-6xl">
                Production is already broken.
                <br />
                Recover it.
              </h1>

              <p className="mt-4 max-w-2xl text-zinc-400">
                Choose your level, pick an incident chain, and work through the recovery
                step by step from a live terminal.
              </p>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm text-zinc-500">Choose your level</div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.values(LEVELS).map((item) => {
                      const locked = !isLevelAvailableForPlan(plan, item.id);
                      const active = item.id === selectedLevel;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedLevel(item.id)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-white bg-black"
                              : "border-zinc-800 bg-zinc-950 hover:bg-black"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{item.label}</div>
                            {locked && (
                              <span className="text-[10px] uppercase tracking-wide text-orange-400">
                                locked
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-zinc-500">
                            {item.description || `Difficulty ${item.difficulty}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-sm text-zinc-500">Choose a chain</div>
                  <div className="grid gap-3">
                    {Object.values(INCIDENT_CHAINS).map((item) => {
                      const locked = !isChainAvailableForPlan(plan, item.id);
                      const active = item.id === selectedChainId;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedChainId(item.id)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-white bg-black"
                              : "border-zinc-800 bg-zinc-950 hover:bg-black"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{item.title}</div>
                            {locked && (
                              <span className="text-[10px] uppercase tracking-wide text-orange-400">
                                Pro
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-zinc-500">
                            {item.steps.length} steps - {item.difficulty}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200"
                >
                  Start recovery run
                </button>

                {!access.allowed && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLoggedIn) onSignup?.({ reason: access.reason });
                      else onUpgrade?.({ reason: access.reason });
                    }}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 hover:bg-black"
                  >
                    {!isLoggedIn ? "Create account" : "Upgrade to Pro"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SelectionSummary
              level={level}
              chain={chain}
              access={access}
              isLoggedIn={isLoggedIn}
              plan={plan}
            />
            <TerminalPreview level={level} chain={chain} />
            <PricingHint
              plan={plan}
              onSignup={onSignup}
              onUpgrade={onUpgrade}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionSummary({ level, chain, access, isLoggedIn, plan }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
        Run summary
      </div>

      <div className="grid gap-3">
        <SummaryRow label="Level" value={level.label} />
        <SummaryRow label="Chain" value={chain.title} />
        <SummaryRow label="Steps" value={chain.steps.length} />
        <SummaryRow label="Current plan" value={plan} />
        <SummaryRow
          label="Access"
          value={access.allowed ? "allowed" : access.reason || "locked"}
          valueClassName={access.allowed ? "text-green-400" : "text-orange-400"}
        />
      </div>

      {!access.allowed && (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
          {isLoggedIn
            ? "This selection is above your current plan."
            : "Create an account to save progress and unlock more modes."}
        </div>
      )}
    </div>
  );
}

function TerminalPreview({ level, chain }) {
  const previewLines = buildPreviewLines(level, chain);

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="text-sm text-zinc-400">preview - bash</div>
        <div className="text-xs text-red-400">live</div>
      </div>

      <div className="bg-black p-4 font-mono text-sm leading-7">
        {previewLines.map((line, idx) => (
          <div key={`${idx}-${line}`} className={previewLineClass(line)}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingHint({ plan, onSignup, onUpgrade, isLoggedIn }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
        Access
      </div>

      <div className="space-y-3">
        <PriceRow
          title="Free"
          price="5 labs"
          detail="Novice + Junior - limited chains"
          active={plan === "FREE"}
        />
        <PriceRow
          title="Pro"
          price="$19/mo"
          detail="All labs - Mid + Senior - full AI - chains"
          active={plan === "PRO"}
        />
        <PriceRow
          title="Lifetime"
          price="$199"
          detail="Everything included - advanced modes - future expansions"
          active={plan === "LIFETIME"}
        />
      </div>

      <div className="mt-5 flex gap-2">
        {!isLoggedIn ? (
          <button
            type="button"
            onClick={() => onSignup?.({ reason: "entry" })}
            className="flex-1 rounded-xl bg-white px-4 py-2 text-black"
          >
            Create account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpgrade?.({ reason: "pricing" })}
            className="flex-1 rounded-xl bg-white px-4 py-2 text-black"
          >
            Upgrade now
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueClassName = "text-zinc-200" }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={valueClassName}>{String(value)}</span>
    </div>
  );
}

function PriceRow({ title, price, detail, active }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-white bg-black" : "border-zinc-800 bg-black"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-zinc-300">{price}</div>
      </div>
      <div className="mt-2 text-sm text-zinc-500">{detail}</div>
    </div>
  );
}

function buildPreviewLines(level, chain) {
  const base = [
    `[chain] ${chain.id}`,
    "live recovery chain",
    `level: ${level.label}`,
    "",
    `[step 1/${chain.steps.length}] ${chain.steps[0]?.labId || "unknown"}`,
    "[12:04:11] requests failing up",
  ];

  if (level.id === "NOVICE") {
    return [
      ...base,
      "[hint] start from service logs",
      '[hint] use "review" if you need help',
    ];
  }

  if (level.id === "JUNIOR") {
    return [
      ...base,
      "[12:04:13] upstream timeout detected",
      "[hint] inspect the first failing component",
    ];
  }

  if (level.id === "MID") {
    return [
      ...base,
      "[12:04:13] upstream timeout detected",
      "[12:04:17] queue depth rising",
    ];
  }

  if (level.id === "SENIOR") {
    return [
      ...base,
      "[12:04:13] bind() failed on listener",
      "[12:04:17] healthcheck unstable",
      "[noise] unrelated background event",
    ];
  }

  return [
    ...base,
    "[12:04:13] listener unstable",
    "[12:04:17] dependency degraded",
    "[12:04:20] retry storm observed",
    "[noise] unrelated host activity",
    "[noise] background process ok",
  ];
}

function previewLineClass(line) {
  if (/\[hint\]/i.test(line)) return "text-cyan-400";
  if (/\[noise\]/i.test(line)) return "text-zinc-600";
  if (/\bfailing|timeout|degraded|unstable|storm\b/i.test(line)) return "text-red-400";
  if (/^\[chain\]/i.test(line)) return "text-purple-400";
  return "text-zinc-400";
}

function evaluateAccess({ plan, levelId, chainId }) {
  const levelAllowed = isLevelAvailableForPlan(plan, levelId);
  const chainAllowed = isChainAvailableForPlan(plan, chainId);

  if (!levelAllowed) {
    return {
      allowed: false,
      reason: "level_locked",
    };
  }

  if (!chainAllowed) {
    return {
      allowed: false,
      reason: "chain_locked",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

function isLevelAvailableForPlan(plan, levelId) {
  if (plan === "LIFETIME") return true;
  if (plan === "PRO") return levelId !== "SRE";
  return FREE_LEVELS.has(levelId);
}

function isChainAvailableForPlan(plan, chainId) {
  if (plan === "LIFETIME" || plan === "PRO") return true;
  return FREE_CHAINS.has(chainId);
}
