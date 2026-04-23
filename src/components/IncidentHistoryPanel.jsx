import React, { useEffect, useState } from "react";

export default function IncidentHistoryPanel({ labId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!labId) return;
    load();
  }, [labId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-progress/attempts?labId=${encodeURIComponent(labId)}`);
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  if (!labId) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
        Select an incident to inspect its history.
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-500">Attempt history</div>
          <div className="text-xs text-zinc-600">{labId}</div>
        </div>
        {loading && <div className="text-xs text-zinc-500">Loading...</div>}
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-zinc-800 bg-black p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-white">
                {new Date(item.createdAt).toLocaleString()}
              </div>
              <div className="text-xs text-zinc-500">{item.mode}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-5 text-sm text-zinc-300">
              <span>score: {item.score ?? "-"}</span>
              <span>grade: {item.grade ?? "-"}</span>
              <span>verify: {item.verifyPassed ? "passed" : "failed"}</span>
              <span>duration: {item.durationMs ?? "-"}ms</span>
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="rounded border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No attempts recorded for this incident.
          </div>
        )}
      </div>
    </div>
  );
}
