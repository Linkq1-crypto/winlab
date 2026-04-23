import React from "react";

export default function SafeDiffViewer({ diff }) {
  const lines = String(diff || "").split("\n");

  return (
    <pre className="m-0 p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, index) => {
        let color = "text-zinc-300";

        if (line.startsWith("@@")) color = "text-violet-300";
        else if (line.startsWith("+")) color = "text-emerald-300";
        else if (line.startsWith("-")) color = "text-red-300";

        return (
          <div key={`${index}:${line.slice(0, 24)}`} className={color}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}
