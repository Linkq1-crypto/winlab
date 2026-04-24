import React, { useEffect, useRef, useState } from "react";
import { getOnboardingTrack } from "../data/onboardingLabTracks";

const LEVEL_MAP = {
  "1": "Novice",
  "2": "Junior",
  "3": "Mid",
  "4": "Senior",
  "5": "SRE",
  novice: "Novice",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  sre: "SRE",
};

const BASE_TERMINAL_LINES = [
  { tone: "muted", text: "WINLAB INCIDENT ROUTER v1.0" },
  { tone: "muted", text: "region: prod-eu-west-1" },
  { tone: "warning", text: "status: degraded" },
  { tone: "empty", text: "" },
  { tone: "warning", text: `[12:04:11] requests failing ${"\u2191"}` },
  { tone: "danger", text: "[12:04:13] nginx healthcheck failed" },
  { tone: "danger", text: "[12:04:17] customer traffic impacted" },
  { tone: "empty", text: "" },
  { tone: "danger", text: "ERROR: operator not assigned" },
  { tone: "muted", text: ">> awaiting operator classification..." },
  { tone: "empty", text: "" },
  { tone: "muted", text: "type your level (1-5):" },
  { tone: "muted", text: "1 novice   2 junior   3 mid   4 senior   5 sre" },
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
  const [terminalLines, setTerminalLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const terminalBodyRef = useRef(null);
  const inputRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    terminalBodyRef.current?.scrollTo({
      top: terminalBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [terminalLines]);

  useEffect(() => {
    setTerminalLines([]);
    setBootComplete(false);
    timersRef.current = [];

    BASE_TERMINAL_LINES.forEach((line, index) => {
      const delay = BASE_TERMINAL_LINES
        .slice(0, index + 1)
        .reduce((total, _entry, entryIndex) => total + (entryIndex < 4 ? 80 : 120), 90);

      const timerId = window.setTimeout(() => {
        setTerminalLines((prev) => [...prev, line]);

        if (index === BASE_TERMINAL_LINES.length - 1) {
          setBootComplete(true);
        }
      }, delay);

      timersRef.current.push(timerId);
    });

    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (bootComplete && !selectedLevel) {
      inputRef.current?.focus();
    }
  }, [bootComplete, selectedLevel]);

  function resolveLevel(rawValue) {
    const normalized = rawValue.trim().toLowerCase();
    return LEVEL_MAP[normalized] || "";
  }

  function appendLine(tone, text) {
    setTerminalLines((prev) => [...prev, { tone, text }]);
  }

  function applyLevelSelection(rawValue) {
    const level = resolveLevel(rawValue);
    if (selectedLevel) {
      return;
    }

    if (!level) {
      setTerminalLines((prev) => [
        ...prev,
        { tone: "prompt", text: `$ ${rawValue.trim()}` },
        { tone: "danger", text: "ERROR: invalid operator class" },
      ]);
      setLevelInput("");
      return;
    }

    const track = getOnboardingTrack(level);
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];

    setSelectedLevel(level);
    setLevelInput("");
    appendLine("prompt", `$ ${rawValue.trim()}`);
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
      <div className="mx-auto max-w-[1600px] px-6 py-12 lg:px-6 lg:py-14">
        <div className="grid min-h-[640px] grid-cols-1 items-stretch gap-3 md:gap-4 lg:h-[680px] lg:grid-cols-[1fr_1fr] lg:gap-5">
          <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B]">
            <div className="flex h-full flex-col justify-center px-9 py-10 lg:px-12 lg:py-12">
              <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-[#8B96A5]">
                LIVE PRODUCTION INCIDENTS
              </div>

              <h1 className="mt-6 max-w-[680px] text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] text-[#E6EDF3] md:text-[56px] lg:text-[64px] lg:leading-[0.98]">
                Your server is down. Fix it.
              </h1>

              <p className="mt-6 max-w-[580px] text-[18px] leading-[1.55] text-[#9DA7B3] lg:text-[22px]">
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

              <div className="mt-8 max-w-[620px]">
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
          </div>

          <div className="flex h-full min-h-[520px]">
            <div className="flex h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B] md:h-[560px] lg:h-full lg:min-h-[640px]">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#F85149]" />
                  <span className="h-3 w-3 rounded-full bg-[#D29922]" />
                  <span className="h-3 w-3 rounded-full bg-[#3FB950]" />
                </div>

                <div className="flex items-center gap-2 text-[13px] text-[#9DA7B3]">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[#3FB950]">
                    <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
                    live
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[#D29922]">
                    degraded
                  </span>
                  <span className="hidden rounded-full border border-white/10 bg-black/20 px-2.5 py-1 sm:inline-flex">
                    prod-eu-west-1
                  </span>
                </div>
              </div>

              <div
                ref={terminalBodyRef}
                className="flex-1 overflow-y-auto bg-[#0B0F14] p-7 pr-5 font-mono text-[14px] leading-[1.6] text-[#E6EDF3] md:text-[15px] md:leading-[1.68] lg:text-[16px] lg:leading-[1.75]"
              >
                {terminalLines.map((line, index) => (
                  <div
                    key={`${index}-${line?.text ?? "empty"}`}
                    className={terminalLineClass(line?.tone)}
                  >
                    {line?.text || <span>&nbsp;</span>}
                  </div>
                ))}

                <form onSubmit={handleLevelSubmit} className="mt-3 flex items-center gap-3">
                  <span className="font-mono text-[16px] leading-none text-[#9DA7B3]">$</span>
                  <input
                    ref={inputRef}
                    value={levelInput}
                    onChange={(event) => setLevelInput(event.target.value)}
                    disabled={!bootComplete || Boolean(selectedLevel)}
                    className="flex-1 bg-transparent font-mono text-[14px] leading-[1.6] text-[#E6EDF3] outline-none placeholder:text-[#6B7280] md:text-[15px] md:leading-[1.68] lg:text-[16px] lg:leading-[1.75]"
                  />
                  {!selectedLevel ? <span className="inline-block animate-pulse text-[#9DA7B3]">_</span> : null}
                </form>
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
