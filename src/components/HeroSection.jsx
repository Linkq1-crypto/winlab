import React, { useEffect, useRef, useState } from "react";

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
  { tone: "warning", text: "[12:04:11] requests failing ↑" },
  { tone: "danger", text: "[12:04:13] nginx healthcheck failed" },
  { tone: "danger", text: "[12:04:17] customer traffic impacted" },
  { tone: "empty", text: "" },
  { tone: "danger", text: "ERROR: operator not assigned" },
  { tone: "muted", text: ">> awaiting operator classification..." },
  { tone: "empty", text: "" },
  { tone: "muted", text: "type your level (1-5):" },
  { tone: "muted", text: "1 novice 2 junior 3 mid 4 senior 5 sre" },
];

const LEFT_PANEL_LINES = [
  "[SYSTEM]: production fabric unstable",
  "[INCIDENT]: public edge degraded",
  "[ACCESS]: operator session ephemeral",
  "[AUTH]: persistence offline until incident closure",
  "",
  "[ROUTER]: queued incidents",
  "[INCIDENT]: nginx-port-conflict",
  "[INCIDENT]: disk-full",
  "[INCIDENT]: permission-denied",
  "[INCIDENT]: memory-leak",
  "[INCIDENT]: db-dead",
  "[INCIDENT]: api-timeout",
  "[ACCESS]: +29 additional incidents restricted",
];

const ROUTING_TIMELINE_MS = [
  { delay: 100, text: "operator assigned: {LEVEL}", tone: "success" },
  { delay: 300, text: "routing incident...", tone: "muted" },
  { delay: 520, text: "[OK] difficulty calibrated", tone: "ok" },
  { delay: 720, text: "[OK] incident profile: nginx-port-conflict", tone: "ok" },
  { delay: 920, text: "[OK] environment ready", tone: "ok" },
  { delay: 1100, text: "handoff → calibrated terminal", tone: "muted" },
];

export default function HeroSection({ onLevelSelected, onRoutingReady }) {
  const [levelInput, setLevelInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [routerLines, setRouterLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const routerBodyRef = useRef(null);
  const inputRef = useRef(null);
  const timersRef = useRef([]);

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

    BASE_TERMINAL_LINES.forEach((line, index) => {
      const delay = BASE_TERMINAL_LINES
        .slice(0, index + 1)
        .reduce((total, _entry, entryIndex) => total + (entryIndex < 4 ? 80 : 120), 90);

      const timerId = window.setTimeout(() => {
        setRouterLines((prev) => [...prev, line]);
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
    return LEVEL_MAP[rawValue.trim().toLowerCase()] || "";
  }

  function appendLine(tone, text) {
    setRouterLines((prev) => [...prev, { tone, text }]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedLevel) return;

    const rawValue = levelInput.trim();
    const level = resolveLevel(rawValue);

    if (!rawValue) return;

    if (!level) {
      setRouterLines((prev) => [
        ...prev,
        { tone: "prompt", text: `$ ${rawValue}` },
        { tone: "danger", text: "[ERROR]: invalid operator class" },
      ]);
      setLevelInput("");
      return;
    }

    setSelectedLevel(level);
    setLevelInput("");
    appendLine("prompt", `$ ${rawValue}`);
    onLevelSelected?.(level);

    ROUTING_TIMELINE_MS.forEach(({ delay, text, tone }) => {
      const timerId = window.setTimeout(() => {
        appendLine(tone, text.replace("{LEVEL}", level.toUpperCase()));
        if (delay === 1100) {
          window.setTimeout(() => onRoutingReady?.(), 100);
        }
      }, delay);

      timersRef.current.push(timerId);
    });
  }

  return (
    <section className="bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:py-8">
        <div className="grid min-h-[640px] grid-cols-1 items-stretch gap-4 lg:h-[680px] lg:grid-cols-[0.92fr_1.08fr]">
          <TerminalShell
            title="[SYSTEM]: incident fabric"
            subtitle="[ROUTER]: live production state"
          >
            <div className="h-[520px] overflow-y-auto bg-[#05080d] p-6 font-mono text-[14px] leading-[1.65] text-zinc-200 md:h-[560px] md:text-[15px] lg:h-full lg:text-[16px] lg:leading-[1.75]">
              {LEFT_PANEL_LINES.map((line, index) => (
                <div key={`${index}-${line}`} className={systemLineClass(line)}>
                  {line || <span>&nbsp;</span>}
                </div>
              ))}
            </div>
          </TerminalShell>

          <TerminalShell
            title="[ROUTER]: operator assignment"
            subtitle="[SYSTEM]: prod-eu-west-1 degraded"
          >
            <div
              ref={routerBodyRef}
              className="h-[520px] overflow-y-auto bg-[#05080d] p-6 font-mono text-[14px] leading-[1.65] text-zinc-200 md:h-[560px] md:text-[15px] lg:h-full lg:text-[16px] lg:leading-[1.75]"
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
                  className="flex-1 bg-transparent text-zinc-100 outline-none"
                />
                {!selectedLevel ? <span className="animate-pulse text-zinc-500">_</span> : null}
              </form>
            </div>
          </TerminalShell>
        </div>
      </div>
    </section>
  );
}

function TerminalShell({ title, subtitle, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-zinc-400">{title}</div>
          <div className="mt-1 font-mono text-[12px] text-zinc-600">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#F85149]" />
          <span className="h-3 w-3 rounded-full bg-[#D29922]" />
          <span className="h-3 w-3 rounded-full bg-[#3FB950]" />
        </div>
      </div>
      {children}
    </div>
  );
}

function systemLineClass(line) {
  if (!line) return "h-4";
  if (/^\[ERROR\]/.test(line)) return "text-red-400";
  if (/^\[ACCESS\]/.test(line)) return "text-amber-300";
  if (/^\[SYSTEM\]|^\[ROUTER\]/.test(line)) return "text-zinc-400";
  if (/^\[INCIDENT\]/.test(line)) return "text-zinc-200";
  if (/^\[AUTH\]/.test(line)) return "text-zinc-500";
  return "text-zinc-300";
}

function routerLineClass(tone) {
  if (tone === "success" || tone === "ok") return "text-emerald-400";
  if (tone === "warning") return "text-amber-300";
  if (tone === "danger") return "text-red-400";
  if (tone === "prompt") return "text-zinc-100";
  if (tone === "empty") return "h-4";
  return "text-zinc-400";
}
