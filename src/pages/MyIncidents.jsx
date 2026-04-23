import React, { useEffect, useState } from "react";
import IncidentHistoryPanel from "../components/IncidentHistoryPanel";

export default function MyIncidents({ user }) {
  const [items, setItems] = useState([]);
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLabId, setSelectedLabId] = useState("");
  const signedIn = Boolean(user?.id || user?.userId);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    load();
  }, [signedIn]);

  async function load() {
    setLoading(true);
    try {
      const [res, chainRes] = await Promise.all([
        fetch("/api/lab-progress"),
        fetch("/api/lab-progress/chains"),
      ]);
      const data = await res.json();
      const chainData = await chainRes.json();
      const nextItems = data.items || [];
      setItems(nextItems);
      setChains(chainData.items || []);
      setSelectedLabId((current) => current || nextItems[0]?.labId || "");
    } finally {
      setLoading(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-2 text-sm text-zinc-500">MY INCIDENTS</div>
            <h1 className="text-3xl font-semibold">Sign in to save progress</h1>
            <p className="mt-3 text-sm text-zinc-400">
              Guest sessions can run incidents, but saved attempts and scores are tied to an account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 text-sm text-zinc-500">MY INCIDENTS</div>
          <h1 className="text-4xl font-semibold">Your progress</h1>
        </div>

        {loading ? (
          <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-500">
            Loading incidents...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4">
              {chains.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-emerald-900/60 bg-zinc-950 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium">{item.chainId}</div>
                      <div className="mt-1 text-sm text-emerald-500">
                        chain: {item.lastStatus}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm">
                      <Metric label="Best score" value={item.bestScore ?? "-"} />
                      <Metric label="Best grade" value={item.bestGrade ?? "-"} />
                      <Metric label="Attempts" value={item.attemptsCount} />
                      <Metric label="Successes" value={item.successCount} />
                    </div>
                  </div>
                </div>
              ))}

              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium">{item.labId}</div>
                      <div className="mt-1 text-sm text-zinc-500">
                        status: {item.lastStatus}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm">
                      <Metric label="Best score" value={item.bestScore ?? "-"} />
                      <Metric label="Best grade" value={item.bestGrade ?? "-"} />
                      <Metric label="Attempts" value={item.attemptsCount} />
                      <Metric label="Successes" value={item.successCount} />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <button className="rounded bg-white px-4 py-2 text-black">
                      Resume
                    </button>
                    <button
                      onClick={() => setSelectedLabId(item.labId)}
                      className="rounded bg-zinc-800 px-4 py-2"
                    >
                      View history
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && chains.length === 0 && (
                <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-zinc-500">
                  No incidents yet.
                </div>
              )}
            </div>

            <IncidentHistoryPanel labId={selectedLabId} />
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="text-white">{String(value)}</div>
    </div>
  );
}
