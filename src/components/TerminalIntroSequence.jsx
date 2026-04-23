import React, { useEffect, useState } from "react";

const DEFAULT_LINES = [
  "[12:04:11] requests failing up",
  "[12:04:13] upstream timeout detected",
  "[12:04:17] customer traffic impacted",
  "",
  'Type "help" or start debugging.',
  "winlab@prod-server:~$",
];

export default function TerminalIntroSequence({
  lines = DEFAULT_LINES,
  speed = 850,
  onComplete,
}) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [criticalPulse, setCriticalPulse] = useState(false);

  useEffect(() => {
    setVisibleLines([]);
    setCriticalPulse(false);

    let index = 0;

    const intervalId = window.setInterval(() => {
      const line = lines[index];
      setVisibleLines((prev) => [...prev, line]);

      if (isCriticalLine(line)) {
        setCriticalPulse(true);
        window.setTimeout(() => setCriticalPulse(false), 250);
      }

      index += 1;

      if (index >= lines.length) {
        window.clearInterval(intervalId);
        onComplete?.();
      }
    }, speed);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lines, speed, onComplete]);

  return (
    <div
      className={`mb-4 rounded border border-zinc-800 bg-zinc-950/40 p-3 transition ${
        criticalPulse ? "ring-1 ring-red-500/50" : ""
      }`}
    >
      <div className="font-mono text-sm leading-7">
        {visibleLines.map((line, index) => (
          <div key={`${index}-${line}`} className={lineClassName(line)}>
            {line || <span>&nbsp;</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function isCriticalLine(line) {
  return /failing|timeout|impacted/i.test(line);
}

function lineClassName(line) {
  if (isCriticalLine(line)) return "text-red-400";
  if (/^Type "help"/i.test(line)) return "text-zinc-500";
  if (/^winlab@prod-server:~\$/i.test(line)) return "text-zinc-200";
  return "text-zinc-400";
}
