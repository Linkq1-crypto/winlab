import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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

const BOOT_LINES = [
  "] PR#6",
  "APPLE IIe // WINLAB-KERNEL v1.0",
  "-----------------------------------",
  "STORAGE: 1313.4 TB (IFT MOUNT)",
  "NODES: 34 SABRE BLADES (DELL SC1425)",
  "CAPACITY: 1.31 PB / 1,344,921.6 GB",
  "HARDWARE: IFT SABRE BLADE 2437 / DELL POWEREDGE SC1425",
  "-----------------------------------",
  "[INFO] Connection rerouted through prod-eu-west-1.",
  "[INFO] Identity obfuscated. You are now Irrelevant.",
  "",
  "[12:04:11] requests failing ↑",
  "[12:04:13] nginx healthcheck failed",
  "[12:04:17] customer traffic impacted",
  "",
  "ERROR: operator not assigned",
  ">> awaiting operator classification...",
  "",
  "type your level (1-5):",
  "1 novice 2 junior 3 mid 4 senior 5 sre",
];

const ROUTING_TIMELINE = [
  { delay: 120, text: (level) => `operator assigned: ${level.toUpperCase()}`, tone: "success" },
  { delay: 280, text: () => "routing incident...", tone: "muted" },
  { delay: 470, text: () => "[OK] difficulty calibrated", tone: "success" },
  { delay: 650, text: (_level, slug) => `[OK] incident profile: ${slug}`, tone: "success" },
  { delay: 850, text: () => "[OK] environment ready", tone: "success" },
  { delay: 1050, text: () => "handoff -> calibrated terminal", tone: "muted" },
];

export default function HeroSection({
  selectedLab = "nginx-port-conflict",
  onLevelSelected,
  onStatusChange,
  onRoutingReady,
}) {
  const [levelInput, setLevelInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [lines, setLines] = useState([]);
  const [bootComplete, setBootComplete] = useState(false);
  const [flickerIndex, setFlickerIndex] = useState(-1);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    console.log(
      "%c[SYSTEM]: The Machine is watching you, Operator.",
      "color:#FFB000;font-family:monospace;font-weight:bold;"
    );
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    setLines([]);
    setBootComplete(false);
    timersRef.current = [];
    onStatusChange?.("booting");

    BOOT_LINES.forEach((text, index) => {
      const timerId = window.setTimeout(() => {
        setLines((prev) => [...prev, { tone: resolveTone(text), text }]);
        setFlickerIndex(index);
        window.setTimeout(() => setFlickerIndex(-1), 90);
        if (index === BOOT_LINES.length - 1) {
          setBootComplete(true);
          onStatusChange?.("awaiting_operator");
        }
      }, 80 + index * 85);

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

  function appendLine(tone, text) {
    setLines((prev) => [...prev, { tone, text }]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (selectedLevel) return;

    const raw = levelInput.trim();
    if (!raw) return;

    const resolved = LEVEL_MAP[raw.toLowerCase()] || "";
    if (!resolved) {
      appendLine("prompt", `$ ${raw}`);
      appendLine("danger", "[ERROR]: invalid operator class");
      setLevelInput("");
      return;
    }

    const track = getOnboardingTrack(resolved);
    const incidentSlug = selectedLab || track.primaryLab?.slug || "nginx-port-conflict";

    setSelectedLevel(resolved);
    setLevelInput("");
    appendLine("prompt", `$ ${raw}`);
    onLevelSelected?.(resolved);
    onStatusChange?.("routing");

    ROUTING_TIMELINE.forEach(({ delay, text, tone }, index) => {
      const timerId = window.setTimeout(() => {
        appendLine(tone, text(resolved, incidentSlug));
        if (index === ROUTING_TIMELINE.length - 1) {
          onStatusChange?.("ready");
          window.setTimeout(() => onRoutingReady?.(), 120);
        }
      }, delay);
      timersRef.current.push(timerId);
    });
  }

  return (
    <TerminalWindow title="incident-router" subtitle="prod-eu-west-1" accent="amber">
      <div
        ref={bodyRef}
        className="h-full overflow-y-auto bg-black p-5 font-mono text-[14px] leading-[1.7] text-[#ffb000] md:text-[15px] lg:text-[16px]"
        style={{ fontFamily: '"Courier New", "Lucida Console", monospace' }}
      >
        {lines.map((line, index) => (
          <motion.div
            key={`${index}-${line.text}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14 }}
            className={`${routerLineClass(line.tone)} ${flickerIndex === index ? "opacity-80" : ""}`}
          >
            {line.text || <span>&nbsp;</span>}
          </motion.div>
        ))}

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-3">
          <span className="text-[#ffb000]">$</span>
          <input
            ref={inputRef}
            value={levelInput}
            onChange={(event) => setLevelInput(event.target.value)}
            disabled={!bootComplete || Boolean(selectedLevel)}
            placeholder="1 novice   2 junior   3 mid   4 senior   5 sre"
            className="flex-1 bg-transparent text-[#ffcf6b] outline-none placeholder:text-[#5b3e00]"
            style={{ fontFamily: '"Courier New", "Lucida Console", monospace' }}
          />
          {!selectedLevel ? <span className="animate-pulse text-[#ffb000]">_</span> : null}
        </form>
      </div>
    </TerminalWindow>
  );
}

export function TerminalWindow({ title, subtitle, accent = "amber", children, overlay }) {
  const borderClass = accent === "red" ? "border-[#ff0000]/70" : "border-[#ffb000]/30";
  const titleClass = accent === "red" ? "text-[#ff3b3b]" : "text-[#ffb000]";

  return (
    <div className={`relative overflow-hidden rounded-none border ${borderClass} bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]`}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,176,0,0.18) 0px, rgba(255,176,0,0.18) 1px, transparent 2px, transparent 4px)" }} />
      <div className="relative flex items-center justify-between border-b border-[#ffb000]/20 bg-[#070707] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-none border border-[#ff0000] bg-[#190000]" />
          <span className="h-2.5 w-2.5 rounded-none border border-[#ffb000] bg-[#1c1300]" />
          <span className="h-2.5 w-2.5 rounded-none border border-[#ffb000] bg-[#102000]" />
        </div>
        <div
          className={`font-mono text-[12px] uppercase tracking-[0.22em] ${titleClass}`}
          style={{ fontFamily: '"Courier New", "Lucida Console", monospace' }}
        >
          {title}
          {subtitle ? ` | ${subtitle}` : ""}
        </div>
        <div className="w-14" />
      </div>
      <div className="relative h-full">{children}</div>
      {overlay}
    </div>
  );
}

function resolveTone(text) {
  if (!text) return "empty";
  if (/ERROR|failed|impacted/i.test(text)) return "danger";
  if (/^\[INFO\]|STORAGE|NODES|CAPACITY|HARDWARE|APPLE IIe|PR#6|type your level/i.test(text)) return "muted";
  if (/status: degraded|requests failing/i.test(text)) return "warning";
  return "amber";
}

function routerLineClass(tone) {
  if (tone === "success") return "text-[#ffd36d]";
  if (tone === "warning") return "text-[#ffbf3c]";
  if (tone === "danger") return "text-[#ff3b3b]";
  if (tone === "prompt") return "text-[#ffe1a3]";
  if (tone === "empty") return "h-4";
  if (tone === "muted") return "text-[#d3961a]";
  return "text-[#ffb000]";
}
