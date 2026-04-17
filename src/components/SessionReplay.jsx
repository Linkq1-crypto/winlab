import { useState, useEffect, useRef } from "react";

/**
 * SessionReplay — plays back a recorded terminal session.
 * Usage: <SessionReplay sessionId="abc123" />
 */
export default function SessionReplay({ sessionId, onClose }) {
  const [events, setEvents] = useState([]);
  const [played, setPlayed] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const termRef = useRef(null);
  const timerRef = useRef(null);
  const idxRef = useRef(0);

  useEffect(() => {
    fetch(`/api/replay/${sessionId}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setEvents(data))
      .catch(() => {});
    return () => clearTimeout(timerRef.current);
  }, [sessionId]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [played]);

  function playNext() {
    if (idxRef.current >= events.length) {
      setPlaying(false);
      return;
    }
    const e = events[idxRef.current];
    setPlayed((prev) => [...prev, e]);
    setProgress(Math.round(((idxRef.current + 1) / events.length) * 100));
    idxRef.current += 1;
    timerRef.current = setTimeout(playNext, 800 / speed);
  }

  function start() {
    setPlaying(true);
    timerRef.current = setTimeout(playNext, 400 / speed);
  }

  function pause() {
    setPlaying(false);
    clearTimeout(timerRef.current);
  }

  function reset() {
    pause();
    idxRef.current = 0;
    setPlayed([]);
    setProgress(0);
  }

  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        Loading replay…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0d0d0d]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-gray-400 font-mono flex-1 truncate">
          Session: {sessionId.slice(0, 16)}…
        </span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="text-xs bg-transparent text-gray-400 border border-white/10 rounded px-1"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        {!playing ? (
          <button onClick={start} className="text-xs px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">
            ▶ Play
          </button>
        ) : (
          <button onClick={pause} className="text-xs px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30">
            ⏸ Pause
          </button>
        )}
        <button onClick={reset} className="text-xs px-3 py-1 bg-white/5 text-gray-400 rounded hover:bg-white/10">
          ↺
        </button>
        {onClose && (
          <button onClick={onClose} className="text-xs px-2 py-1 text-gray-500 hover:text-white">
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-1 bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className="font-mono text-sm p-4 h-64 overflow-y-auto text-green-400 leading-relaxed"
      >
        {played.map((e, i) => (
          <div key={i} className="mb-1">
            <span className="text-gray-500">$ </span>
            <span className="text-white">{e.cmd}</span>
            {e.output && (
              <div className="text-green-400/80 whitespace-pre-wrap text-xs mt-0.5">
                {e.output}
              </div>
            )}
          </div>
        ))}
        {playing && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-4 py-2 bg-white/3 border-t border-white/5 text-xs text-gray-500">
        <span>{events.length} commands</span>
        <span>{played.length} played</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}
