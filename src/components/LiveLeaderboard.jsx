import { useState, useEffect, useRef } from "react";

/**
 * LiveLeaderboard — real-time leaderboard via WebSocket.
 * Falls back to HTTP polling if WS is unavailable.
 *
 * Props:
 *   scenarioId  — filter by scenario (optional)
 *   limit       — max rows to show (default 10)
 *   className   — extra CSS classes for the container
 */
export default function LiveLeaderboard({ scenarioId, limit = 10, className = "" }) {
  const [rows, setRows] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    let pollInterval;

    function fetchHttp() {
      const qs = scenarioId ? `?scenarioId=${scenarioId}&limit=${limit}` : `?limit=${limit}`;
      fetch(`/api/leaderboard${qs}`)
        .then((r) => r.json())
        .then((data) => Array.isArray(data) && setRows(data))
        .catch(() => {});
    }

    function connect() {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const qs = scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : "";
      ws = new WebSocket(`${proto}://${location.host}/ws/leaderboard${qs}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        clearInterval(pollInterval);
      };

      ws.onmessage = (e) => {
        try {
          const { type, rows: newRows } = JSON.parse(e.data);
          if (type === "leaderboard" && Array.isArray(newRows)) {
            setRows(newRows.slice(0, limit));
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setConnected(false);
        // fallback: poll every 15s
        fetchHttp();
        pollInterval = setInterval(fetchHttp, 15000);
      };

      ws.onerror = () => ws.close();
    }

    fetchHttp(); // immediate fetch on mount
    connect();

    return () => {
      ws?.close();
      clearInterval(pollInterval);
    };
  }, [scenarioId, limit]);

  if (!rows.length) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No scores yet — be the first!
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Leaderboard</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
          {connected ? "● LIVE" : "○ polling"}
        </span>
      </div>

      {/* Rows */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-white/5">
            <th className="px-4 py-2 text-left w-8">#</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-right">Score</th>
            <th className="px-4 py-2 text-right hidden sm:table-cell">Region</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-white/5 last:border-0 ${i === 0 ? "bg-yellow-500/5" : "hover:bg-white/3"}`}
            >
              <td className="px-4 py-2 text-gray-500 font-mono">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
              </td>
              <td className="px-4 py-2 font-medium text-white truncate max-w-[140px]">
                {row.teamName}
              </td>
              <td className="px-4 py-2 text-right font-mono text-green-400 font-bold">
                {row.leaderboardScore.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right text-gray-500 text-xs hidden sm:table-cell">
                {row.region}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
