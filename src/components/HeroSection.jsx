import React, { useEffect, useMemo, useRef, useState } from "react";
import { getOnboardingTrack } from "../data/onboardingLabTracks";

const LEVEL_OPTIONS = [
  "1. Novice - I know basic Linux commands",
  "2. Junior - I can read logs and restart services",
  "3. Mid - I debug production issues sometimes",
  "4. Senior - I have been on-call before",
  "5. SRE - No hints. No AI. Full pressure.",
];

const LEVELS = ["Novice", "Junior", "Mid", "Senior", "SRE"];

const BASE_TERMINAL_LINES = [
  { tone: "muted", text: "WINLAB INCIDENT ROUTER v1.0" },
  { tone: "muted", text: "region: prod-eu-west-1" },
  { tone: "warning", text: "status: degraded" },
  { tone: "empty", text: "" },
  { tone: "warning", text: `[12:04:11] requests failing ${"\u2191"}` },
  { tone: "danger", text: "[12:04:13] nginx healthcheck failed" },
  { tone: "danger", text: "[12:04:17] customer traffic impacted" },
  { tone: "empty", text: "" },
  { tone: "muted", text: "Before assigning your first incident, choose your operator level:" },
  ...LEVEL_OPTIONS.map((text) => ({ tone: "neutral", text })),
  { tone: "empty", text: "" },
  { tone: "muted", text: "Type your level:" },
];

const ROUTING_TIMELINE_MS = [
  { delay: 100, step: "assigned" },
  { delay: 300, step: "routing" },
  { delay: 520, step: "difficulty" },
  { delay: 720, step: "profile" },
  { delay: 920, step: "ready" },
  { delay: 1100, step: "scrolling" },
  { delay: 1200, step: "handoff" },
];

const HERO_INCIDENT_PREVIEWS = [
  {
    id: "nginx-port-conflict",
    tier: "starter",
    status: "degraded",
    signal: "port 80 already bound",
  },
  {
    id: "disk-full",
    tier: "starter",
    status: "critical",
    signal: "/var at 100%",
  },
  {
    id: "permission-denied",
    tier: "pro",
    status: "failing",
    signal: "write path blocked",
  },
  {
    id: "memory-leak",
    tier: "pro",
    status: "unstable",
    signal: "RSS climbing",
  },
  {
    id: "db-dead",
    tier: "pro",
    status: "offline",
    signal: "database unreachable",
  },
  {
    id: "api-timeout",
    tier: "codex",
    status: "degraded",
    signal: "p95 latency high",
  },
];

export default function HeroSection({
  onStart,
  onSeeHowItWorks,
  onLevelSelected,
  onRoutingReady,
  onPreviewIncident,
  stats,
}) {
  const [levelInput, setLevelInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [terminalLines, setTerminalLines] = useState(BASE_TERMINAL_LINES);
  const [selectionError, setSelectionError] = useState("");
  const terminalBodyRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    terminalBodyRef.current?.scrollTo({
      top: terminalBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [terminalLines]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const levelPrompt = useMemo(() => {
    return selectedLevel ? `operator locked: ${selectedLevel.toUpperCase()}` : "Type your level";
  }, [selectedLevel]);

  function resolveLevel(rawValue) {
    const normalized = rawValue.trim().toLowerCase();
    return LEVELS.find((level) => level.toLowerCase() === normalized) || "";
  }

  function appendLine(tone, text) {
    setTerminalLines((prev) => [...prev, { tone, text }]);
  }

  function applyLevelSelection(rawValue) {
    const level = resolveLevel(rawValue);
    if (!level || selectedLevel) {
      if (!level) {
        setSelectionError("Choose Novice, Junior, Mid, Senior, or SRE.");
      }
      return;
    }

    const track = getOnboardingTrack(level);
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];

    setSelectionError("");
    setSelectedLevel(level);
    setLevelInput(level);
    onLevelSelected?.(level);

    ROUTING_TIMELINE_MS.forEach(({ delay, step }) => {
      const timerId = window.setTimeout(() => {
        if (step === "assigned") appendLine("success", `operator assigned: ${level.toUpperCase()}`);
        if (step === "routing") appendLine("muted", "routing incident...");
        if (step === "difficulty") appendLine("ok", "[OK] difficulty calibrated");
        if (step === "profile") appendLine("ok", `[OK] incident profile: ${track.primaryLab?.slug || "pending"}`);
        if (step === "ready") appendLine("ok", "[OK] environment ready");
        if (step === "scrolling") appendLine("muted", "scrolling to active terminal...");
        if (step === "handoff") onRoutingReady?.();
      }, delay);
      timersRef.current.push(timerId);
    });
  }

  function handleLevelSubmit(event) {
    event.preventDefault();
    applyLevelSelection(levelInput);
  }

  return (
    <section className="bg-[#0B0F14] text-[#E6EDF3]">
      <div className="mx-auto grid min-h-[620px] max-w-7xl items-stretch gap-12 px-6 py-20 sm:py-24 lg:grid-cols-[1fr_1.02fr] lg:gap-16 lg:px-8 lg:py-28">
        <div className="flex min-h-[560px] flex-col justify-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-[#8B96A5]">
            Live production incidents
          </div>

          <h1 className="mt-6 max-w-[11ch] text-[42px] font-semibold tracking-[-0.04em] text-[#E6EDF3] sm:text-[52px] sm:leading-[1.02] lg:text-[68px] lg:leading-[0.96]">
            Your server is down. Fix it.
          </h1>

          <p className="mt-6 max-w-[560px] text-[18px] leading-8 text-[#9DA7B3] lg:text-[20px]">
            Break real servers. Get hired. No simulations.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#4F8CFF] px-5 text-sm font-medium text-white transition hover:brightness-110"
            >
              Start first incident
            </button>

            <button
              type="button"
              onClick={onSeeHowItWorks}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-[#E6EDF3] transition hover:bg-white/10"
            >
              See how it works
            </button>
          </div>

          <div className="mt-8 max-w-[580px]">
            <div className="text-[12px] uppercase tracking-[0.18em] text-[#8B96A5]">
              Active incidents
            </div>
            <p className="mt-2 text-sm text-[#9DA7B3]">
              Choose your level. WinLab assigns the right outage.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {HERO_INCIDENT_PREVIEWS.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => onPreviewIncident?.(incident.id)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#E6EDF3]">
                      {incident.id}
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${incidentChipClass(incident)}`}>
                      {incident.tier}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-[#8B96A5]">status: {incident.status}</div>
                  <div className="mt-1 text-sm text-[#C5CED8]">signal: {incident.signal}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-[#8B96A5]">
              {Math.max(0, stats.labs - HERO_INCIDENT_PREVIEWS.length)} more labs
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-[560px]">
          <div className="flex h-[580px] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#F85149]" />
                <span className="h-3 w-3 rounded-full bg-[#D29922]" />
                <span className="h-3 w-3 rounded-full bg-[#3FB950]" />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#9DA7B3]">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[#3FB950]">
                  <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
                  live
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[#D29922]">
                  degraded
                </span>
                <span className="hidden rounded-full border border-white/10 bg-black/20 px-2 py-1 sm:inline-flex">
                  prod-eu-west-1
                </span>
              </div>
            </div>

            <div className="flex-1 bg-[#0B0F14] p-5">
              <div
                ref={terminalBodyRef}
                className="h-[360px] overflow-y-auto pr-1 font-mono text-[13px] leading-6 text-[#E6EDF3] sm:h-[400px] sm:text-sm"
              >
                {terminalLines.map((line, index) => (
                  <div key={`${index}-${line.text}`} className={terminalLineClass(line.tone)}>
                    {line.text || <span>&nbsp;</span>}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="text-xs uppercase tracking-wide text-[#9DA7B3]">
                  choose your level:
                </div>

                <div className="mt-3 grid gap-2">
                  {LEVEL_OPTIONS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applyLevelSelection(LEVELS[index])}
                      disabled={Boolean(selectedLevel)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        selectedLevel === LEVELS[index]
                          ? "border-[#3FB950] bg-[#3FB950]/10 text-[#E6EDF3]"
                          : "border-white/10 bg-white/5 text-[#9DA7B3] hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-80`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleLevelSubmit} className="mt-4 flex items-center gap-3">
                  <span className="font-mono text-sm text-[#9DA7B3]">$</span>
                  <input
                    value={levelInput}
                    onChange={(event) => setLevelInput(event.target.value)}
                    disabled={Boolean(selectedLevel)}
                    placeholder={levelPrompt}
                    className="flex-1 bg-transparent font-mono text-sm text-[#E6EDF3] outline-none placeholder:text-[#6B7280]"
                  />
                  <button
                    type="submit"
                    disabled={Boolean(selectedLevel)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#E6EDF3] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Set level
                  </button>
                </form>

                {selectionError ? (
                  <div className="mt-3 animate-pulse text-sm text-[#F85149]">{selectionError}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function terminalLineClass(tone) {
  if (tone === "success" || tone === "ok") return "text-[#3FB950]";
  if (tone === "warning") return "text-[#D29922]";
  if (tone === "danger") return "text-[#F85149]";
  if (tone === "prompt") return "text-[#E6EDF3]";
  if (tone === "neutral") return "text-[#D1D5DB]";
  if (tone === "empty") return "h-3";
  return "text-[#9DA7B3]";
}

function incidentChipClass(incident) {
  if (incident.tier === "starter") return "border-emerald-500/20 text-emerald-300";
  if (incident.tier === "pro") return "border-amber-500/20 text-amber-300";
  return "border-zinc-700 text-zinc-300";
}
