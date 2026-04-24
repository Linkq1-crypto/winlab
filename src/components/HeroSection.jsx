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
  { tone: "muted", text: "[INFO] Connection rerouted through prod-eu-west-1." },
  { tone: "muted", text: "[INFO] Identity obfuscated. You are now Irrelevant." },
  { tone: "empty", text: "" },
  { tone: "warning", text: "[12:04:11] requests failing \u2191" },
  { tone: "danger", text: "[12:04:13] nginx healthcheck failed" },
  { tone: "danger", text: "[12:04:17] customer traffic impacted" },
  { tone: "empty", text: "" },
  { tone: "danger", text: "ERROR: operator not assigned" },
  { tone: "muted", text: ">> awaiting operator classification..." },
  { tone: "empty", text: "" },
  { tone: "muted", text: "type your level (1-5):" },
  { tone: "muted", text: "1 novice 2 junior 3 mid 4 senior 5 sre" },
];

const ROUTING_TIMELINE_MS = [
  { delay: 100, step: "assigned" },
  { delay: 300, step: "routing" },
  { delay: 520, step: "difficulty" },
  { delay: 720, step: "profile" },
  { delay: 920, step: "ready" },
  { delay: 1100, step: "handoff" },
];

export default function HeroSection({
  selectedLab = "nginx-port-conflict",
  onLevelSelected,
  onStatusChange,
  onRoutingReady,
}) {
  const [levelInput, setLevelInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [routerLines, setRouterLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const routerBodyRef = useRef(null);
  const inputRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    console.log(
      "%c[SYSTEM]: The Machine is watching you, Operator.",
      "color:#00ff00;font-family:monospace;font-weight:bold;"
    );
  }, []);

  useEffect(() => {
    routerBodyRef.current?.scrollTo({
      top: routerBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [routerLines]);

  useEffect(() => {
    setRouterLines([]);
    setBootComplete(false);
    timersRef.current = [];
    onStatusChange?.("booting");

    BASE_TERMINAL_LINES.forEach((line, index) => {
      const delay = BASE_TERMINAL_LINES
        .slice(0, index + 1)
        .reduce((total, _entry, entryIndex) => total + (entryIndex < 4 ? 80 : 120), 90);

      const timerId = window.setTimeout(() => {
        setRouterLines((prev) => [...prev, line]);
        if (index === BASE_TERMINAL_LINES.length - 1) {
          setBootComplete(true);
          onStatusChange?.("awaiting_operator");
        }
      }, delay);

      timersRef.current.push(timerId);
    });

    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (bootComplete && !selectedLevel) {
      inputRef.current?.focus();
    }
  }, [bootComplete, selectedLevel]);

  function resolveLevel(rawValue) {
    return LEVEL_MAP[rawValue.trim().toLowerCase()] || "";
  }

  function appendLine(tone, text) {
    setRouterLines((prev) => [...prev, { tone, text }]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedLevel) return;

    const rawValue = levelInput.trim();
    if (!rawValue) return;

    const level = resolveLevel(rawValue);
    if (!level) {
      setRouterLines((prev) => [
        ...prev,
        { tone: "prompt", text: `$ ${rawValue}` },
        { tone: "danger", text: "[ERROR]: invalid operator class" },
      ]);
      setLevelInput("");
      return;
    }

    const track = getOnboardingTrack(level);
    setSelectedLevel(level);
    setLevelInput("");
    appendLine("prompt", `$ ${rawValue}`);
    onLevelSelected?.(level);
    onStatusChange?.("routing");

    ROUTING_TIMELINE_MS.forEach(({ delay, step }) => {
      const timerId = window.setTimeout(() => {
        if (step === "assigned") appendLine("success", `operator assigned: ${level.toUpperCase()}`);
        if (step === "routing") appendLine("muted", "routing incident...");
        if (step === "difficulty") appendLine("ok", "[OK] difficulty calibrated");
        if (step === "profile") {
          appendLine(
            "ok",
            `[OK] incident profile: ${selectedLab || track.primaryLab?.slug || "nginx-port-conflict"}`
          );
        }
        if (step === "ready") appendLine("ok", "[OK] environment ready");
        if (step === "handoff") {
          appendLine("muted", "handoff -> calibrated terminal");
          onStatusChange?.("ready");
          window.setTimeout(() => onRoutingReady?.(), 120);
        }
      }, delay);

      timersRef.current.push(timerId);
    });
  }

  return (
    <TerminalWindow title="incident-router" subtitle="prod-eu-west-1">
      <div
        ref={routerBodyRef}
        className="h-full overflow-y-auto bg-[#05080d] p-5 font-mono text-[14px] leading-[1.65] text-zinc-200 md:text-[15px] lg:text-[16px] lg:leading-[1.75]"
      >
        {routerLines.map((line, index) => (
          <div key={`${index}-${line?.text ?? "empty"}`} className={routerLineClass(line?.tone)}>
            {line?.text || <span>&nbsp;</span>}
          </div>
        ))}

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-3">
          <span className="text-zinc-400">$</span>
          <input
            ref={inputRef}
            value={levelInput}
            onChange={(event) => setLevelInput(event.target.value)}
            disabled={!bootComplete || Boolean(selectedLevel)}
            placeholder="1 novice   2 junior   3 mid   4 senior   5 sre"
            className="flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          {!selectedLevel ? <span className="animate-pulse text-zinc-500">_</span> : null}
        </form>
      </div>
    </TerminalWindow>
  );
}

export function TerminalWindow({ title, subtitle, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0f1319] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#151a21] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#f85149]" />
          <span className="h-3 w-3 rounded-full bg-[#d29922]" />
          <span className="h-3 w-3 rounded-full bg-[#3fb950]" />
        </div>
        <div className="font-mono text-[12px] text-zinc-500">
          {title}
          {subtitle ? ` | ${subtitle}` : ""}
        </div>
        <div className="w-14" />
      </div>
      {children}
    </div>
  );
}

function routerLineClass(tone) {
  if (tone === "success" || tone === "ok") return "text-emerald-400";
  if (tone === "warning") return "text-amber-300";
  if (tone === "danger") return "text-red-400";
  if (tone === "prompt") return "text-zinc-100";
  if (tone === "empty") return "h-4";
  return "text-zinc-400";
}
