// AIChallengeSimulator.jsx – AI-generated sysadmin challenges
// Calls /api/ai/generate-challenge (Claude Haiku + DB cache)
import { useState, useRef, useEffect } from "react";
import { useLab } from "./LabContext";

const TOPICS = [
  "Linux Server", "NGINX Configuration", "MySQL Replication",
  "SSL/TLS Certificates", "Firewall Rules", "Cron Jobs",
  "LVM Storage", "NFS / SMB Shares", "Docker Containers",
  "SSH Hardening", "Log Management", "Kernel Parameters",
  "Systemd Services", "Network Troubleshooting", "Disk Performance",
];

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function AIChallengeSimulator() {
  const { completeLab, completeObjective, setActiveLabState } = useLab();

  const [topic,      setTopic]      = useState("Linux Server");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [challenge,  setChallenge]  = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // Terminal state
  const [history,    setHistory]    = useState([]);   // { text, type }
  const [input,      setInput]      = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [cmdIdx,     setCmdIdx]     = useState(-1);
  const [solved,     setSolved]     = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Keep AI Mentor aware of current state
  useEffect(() => {
    setActiveLabState({
      labId: "ai-challenges",
      topic,
      difficulty,
      challengeTitle: challenge?.title,
      goal: challenge?.goal,
      solved,
      commandsEntered: history.filter(h => h.type === "cmd").length,
    });
  }, [challenge, solved, history, topic, difficulty, setActiveLabState]);

  // ── Generate a new challenge ─────────────────────────────────────────────
  async function generate() {
    setLoading(true);
    setError(null);
    setChallenge(null);
    setSolved(false);
    setHistory([]);

    try {
      const res = await fetch("/api/ai/generate-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty })
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setChallenge(data);

      // Welcome message
      setHistory([
        { text: `=== ${data.title} ===`, type: "head" },
        { text: data.scenario, type: "out" },
        { text: "", type: "out" },
        { text: `GOAL: ${data.goal}`, type: "warn" },
        { text: "", type: "out" },
        { text: "Type your commands below. Type 'hint' for a clue, 'solution' to reveal.", type: "dim" },
      ]);
    } catch {
      setError("Failed to generate challenge. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  // ── Command evaluation ───────────────────────────────────────────────────
  function evalCommand(cmd) {
    const trimmed = cmd.trim().toLowerCase();

    // Track command history
    setCmdHistory(h => [cmd, ...h].slice(0, 50));
    setCmdIdx(-1);

    const newLines = [{ text: `$ ${cmd}`, type: "cmd" }];

    if (!challenge) {
      newLines.push({ text: "No active challenge. Generate one first.", type: "err" });
      return setHistory(h => [...h, ...newLines]);
    }

    if (trimmed === "hint") {
      newLines.push({
        text: `HINT: Try running one of the expected commands to diagnose the issue: ${challenge.expected_commands[0]}`,
        type: "warn"
      });
      completeObjective("ai-challenges", "used_hint");
      return setHistory(h => [...h, ...newLines]);
    }

    if (trimmed === "solution") {
      newLines.push({ text: "Expected commands to solve this challenge:", type: "head" });
      challenge.expected_commands.forEach(c => newLines.push({ text: `  ${c}`, type: "ok" }));
      return setHistory(h => [...h, ...newLines]);
    }

    if (trimmed === "clear" || trimmed === "cls") {
      return setHistory([]);
    }

    // Check if command matches one of the expected commands
    const matched = challenge.expected_commands.some(expected =>
      trimmed === expected.toLowerCase() ||
      trimmed.startsWith(expected.toLowerCase().split(" ")[0])
    );

    if (matched) {
      newLines.push({ text: `[Simulated output for: ${cmd}]`, type: "ok" });
      newLines.push({ text: "Command recognized as part of the solution path.", type: "ok" });
      completeObjective("ai-challenges", cmd);

      // Check if all expected commands have been entered
      const allEntered = challenge.expected_commands.every(expected =>
        [...history, ...newLines]
          .filter(l => l.type === "cmd")
          .some(l => l.text.toLowerCase().includes(expected.toLowerCase().split(" ")[0]))
      );

      if (allEntered && !solved) {
        setSolved(true);
        newLines.push({ text: "", type: "out" });
        newLines.push({ text: "✓ Challenge Solved! Well done.", type: "ok" });
        completeLab("ai-challenges");
      }
    } else {
      newLines.push({ text: `bash: ${cmd.split(" ")[0]}: command not found (or not relevant to this challenge)`, type: "err" });
    }

    setHistory(h => [...h, ...newLines]);
  }

  function handleKey(e) {
    if (e.key === "Enter") {
      evalCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(cmdIdx + 1, cmdHistory.length - 1);
      setCmdIdx(next);
      setInput(cmdHistory[next] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(cmdIdx - 1, -1);
      setCmdIdx(next);
      setInput(next === -1 ? "" : cmdHistory[next]);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] text-white p-6 gap-4">

      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Topic</label>
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600"
          >
            {TOPICS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Difficulty</label>
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600"
          >
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
        >
          {loading ? "Generating…" : challenge ? "New Challenge ↺" : "Generate Challenge"}
        </button>

        {challenge && (
          <span className={`text-xs px-3 py-1.5 rounded-full border font-mono
            ${solved
              ? "text-green-400 border-green-600/40 bg-green-600/10"
              : "text-blue-400 border-blue-600/40 bg-blue-600/10"}`}>
            {solved ? "✓ Solved" : "In Progress"}
          </span>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Expected commands reference (collapsed) */}
      {challenge && (
        <details className="text-xs bg-slate-900 border border-slate-800 rounded-lg">
          <summary className="px-4 py-2 cursor-pointer text-slate-500 hover:text-white">
            Expected commands ({challenge.expected_commands.length})
          </summary>
          <div className="px-4 pb-3 space-y-1">
            {challenge.expected_commands.map((c, i) => (
              <code key={i} className="block text-green-400 font-mono">{c}</code>
            ))}
          </div>
        </details>
      )}

      {/* Terminal */}
      <div className="flex-1 flex flex-col bg-black border border-slate-800 rounded-xl overflow-hidden min-h-0">
        {/* Terminal output */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-0.5">
          {history.length === 0 && !loading && (
            <p className="text-slate-600">Select a topic and difficulty, then click "Generate Challenge".</p>
          )}
          {history.map((line, i) => (
            <div key={i} className={
              line.type === "cmd"  ? "text-white"
              : line.type === "ok"   ? "text-green-400"
              : line.type === "err"  ? "text-red-400"
              : line.type === "warn" ? "text-yellow-400"
              : line.type === "head" ? "text-blue-400 font-semibold"
              : line.type === "dim"  ? "text-slate-600"
              : "text-slate-300"
            }>
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-800 bg-[#050505]">
          <span className="text-green-400 font-mono text-sm shrink-0">$</span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={!challenge}
            placeholder={challenge ? "Enter command…" : "Generate a challenge to start"}
            className="flex-1 bg-transparent font-mono text-sm text-white focus:outline-none placeholder-slate-700"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
