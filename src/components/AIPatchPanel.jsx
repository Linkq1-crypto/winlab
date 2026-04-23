import React, { useMemo } from "react";
import SafeDiffViewer from "./SafeDiffViewer";

export default function AIPatchPanel({ result, onRunVerify, onExplain }) {
  const quality = result?.quality || {};
  const grade = quality.grade || "?";
  const diff = result?.final?.diff || "";

  const badgeColor = useMemo(() => {
    if (grade === "A") return "bg-emerald-600";
    if (grade === "B") return "bg-emerald-500 text-black";
    if (grade === "C") return "bg-yellow-500 text-black";
    if (grade === "D") return "bg-orange-500 text-black";
    return "bg-red-600";
  }, [grade]);

  if (!result || !result.final) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-4 text-sm text-zinc-500">
        No patch available
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm text-zinc-400">AI Patch</span>
          <span className={`min-w-7 rounded px-2 py-1 text-center text-xs font-semibold ${badgeColor}`}>
            {grade}
          </span>
          <span className="text-xs text-zinc-500">
            score: {quality.score ?? "-"}
          </span>
          <span className={result.ok ? "text-xs text-emerald-300" : "text-xs text-red-300"}>
            {result.ok ? "Fix works" : "Still failing"}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onRunVerify}
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            Run Verify
          </button>

          <button
            type="button"
            onClick={() => onExplain?.(diff)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            Explain
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <SafeDiffViewer diff={diff} />
      </div>

      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
        Files touched: {result.final.filesTouched?.length || 0} - Attempt {result.finalAttempt || result.final.attempt || 1}
      </div>
    </div>
  );
}
