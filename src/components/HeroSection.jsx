import React, { useEffect, useMemo, useRef, useState } from "react";

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
  { tone: "muted", text: "[12:04:11] requests failing ↑" },
  { tone: "danger", text: "[12:04:13] nginx healthcheck failed" },
  { tone: "danger", text: "[12:04:17] customer traffic impacted" },
  { tone: "empty", text: "" },
  { tone: "muted", text: "Before assigning your first incident, choose your operator level:" },
  ...LEVEL_OPTIONS.map((text) => ({ tone: "neutral", text })),
  { tone: "empty", text: "" },
  { tone: "muted", text: "Type your level:" },
];

export default function HeroSection({
  onStart,
  onSeeHowItWorks,
  onLevelSelected,
  stats,
  socialProof,
}) {
  const [levelInput, setLevelInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [terminalLines, setTerminalLines] = useState(BASE_TERMINAL_LINES);
  const [selectionError, setSelectionError] = useState("");
  const terminalBodyRef = useRef(null);

  useEffect(() => {
    terminalBodyRef.current?.scrollTo({
      top: terminalBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [terminalLines]);

  const levelPrompt = useMemo(() => {
    return selectedLevel ? `level locked: ${selectedLevel}` : "Type your level";
  }, [selectedLevel]);

  function resolveLevel(rawValue) {
    const normalized = rawValue.trim().toLowerCase();
    return LEVELS.find((level) => level.toLowerCase() === normalized) || "";
  }

  function applyLevelSelection(rawValue) {
    const level = resolveLevel(rawValue);
    if (!level || selectedLevel) {
      if (!level) {
        setSelectionError("Choose Novice, Junior, Mid, Senior, or SRE.");
      }
      return;
    }

    setSelectionError("");
    setSelectedLevel(level);
    setLevelInput(level);
    setTerminalLines((prev) => [
      ...prev,
      { tone: "prompt", text: `$ ${level}` },
      { tone: "success", text: `level set: ${level}` },
      { tone: "muted", text: "calibrating difficulty..." },
      { tone: "muted", text: "loading incident catalog..." },
      { tone: "muted", text: "building your incident track..." },
    ]);

    window.setTimeout(() => {
      onLevelSelected?.(level);
    }, 320);
  }

  function handleLevelSubmit(event) {
    event.preventDefault();
    applyLevelSelection(levelInput);
  }

  return (
    <section className="bg-[#0B0F14] text-[#E6EDF3]">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#9DA7B3]">
            <span className="h-2 w-2 rounded-full bg-[#3FB950]" />
            Live production incidents
          </div>

          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-[#E6EDF3] sm:text-5xl lg:text-6xl">
            Your server is down. Fix it.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-[#9DA7B3] sm:text-lg">
            Break real servers. Get hired. No simulations.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center justify-center rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110"
            >
              Start first incident
            </button>

            <button
              type="button"
              onClick={onSeeHowItWorks}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#E6EDF3] transition hover:bg-white/10"
            >
              See how it works
            </button>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-sm text-[#9DA7B3]">{socialProof.headline}</p>
          </div>

          <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Engineers" value={formatCount(stats.engineers)} />
            <StatPill label="Countries" value={`${stats.countries}+`} />
            <StatPill label="Labs" value={String(stats.labs)} />
            <StatPill label="Rating" value={`${stats.avgRating}*`} />
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B] shadow-2xl shadow-black/30">
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

            <div className="bg-[#0B0F14] p-5">
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
                  <div className="mt-3 text-sm text-[#F85149]">{selectionError}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[#9DA7B3]">{label}</div>
      <div className="mt-1 text-sm font-medium text-[#E6EDF3]">{value}</div>
    </div>
  );
}

function formatCount(value) {
  if (typeof value !== "number") return String(value);
  return value >= 1000 ? `${Math.round(value / 100) / 10}k+` : String(value);
}

function terminalLineClass(tone) {
  if (tone === "success") return "text-[#3FB950]";
  if (tone === "warning") return "text-[#D29922]";
  if (tone === "danger") return "text-[#F85149]";
  if (tone === "prompt") return "text-[#E6EDF3]";
  if (tone === "neutral") return "text-[#D1D5DB]";
  if (tone === "empty") return "h-3";
  return "text-[#9DA7B3]";
}
