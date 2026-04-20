// TerminalDemo.jsx - Realistic terminal with typing effect + AI mentor + interactive input
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { runBashLayer, VFS } from "../hooks/bashEngine";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const DEMO_STEPS = [
  {
    cmd: "ssh lab-server",
    output: "Connected to lab-server.winlab.cloud",
  },
  {
    cmd: "systemctl status ldap",
    output: "● ldap.service - LDAP Authentication\n   Loaded: loaded (/lib/systemd/system/ldap.service)\n   Active: ❌ failed (Result: exit-code)\n   Main PID: 1847 (code=exited, status=1/FAILURE)",
  },
  {
    cmd: "journalctl -u ldap --no-pager -n 15",
    output: "Apr 15 14:23:01 lab-server slapd[1847]: bind DN configuration error\nApr 15 14:23:01 lab-server slapd[1847]: ❌ authentication failed for CN=admin,DC=winlab,DC=cloud\nApr 15 14:23:02 lab-server slapd[1847]: additional info: invalid DN",
  },
  {
    aiThinking: true,
    aiMessages: [
      "Analyzing logs...",
      "Checking LDAP configuration...",
      "Looking for authentication errors...",
    ],
    aiHint: "💡 Hint: Check your bind DN configuration in /etc/ldap/ldap.conf. The DN format might be wrong.",
  },
  {
    cmd: "cat /etc/ldap/ldap.conf | grep BIND",
    output: "BIND_DN CN=Administrator,CN=Users,DC=winlab,DC=cloud\n# Should be: BIND_DN CN=Administrator,DC=winlab,DC=cloud",
  },
  {
    cmd: "sed -i 's/CN=Users,//' /etc/ldap/ldap.conf && systemctl restart ldap",
    output: "✅ LDAP service restarted successfully\n✅ Authentication restored — users can login again",
  },
];

export default function TerminalDemo({ onRun, onStepComplete }) {
  const [lines, setLines] = useState(["winlab@lab:~$"]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [showResume, setShowResume] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("/root");
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  // Check for saved progress on mount
  useEffect(() => {
    const savedStep = localStorage.getItem("winlab_demo_step");
    if (savedStep && parseInt(savedStep) > 0) {
      setShowResume(true);
    }
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const typeLine = async (text, callback) => {
    let current = "";
    for (let char of text) {
      current += char;
      setLines((prev) => [...prev.slice(0, -1), current]);
      await sleep(15 + Math.random() * 25);
    }
    if (callback) callback();
  };

  const runStep = async (startFrom = 0) => {
    if (running) return;
    setRunning(true);

    let currentStep = startFrom;

    for (let i = currentStep; i < DEMO_STEPS.length; i++) {
      const stepData = DEMO_STEPS[i];

      if (stepData.aiThinking) {
        // AI Mentor thinking sequence
        setLines((prev) => [...prev, ""]);
        setLines((prev) => [...prev, "🤖 AI Mentor is analyzing..."]);

        for (let msg of stepData.aiMessages) {
          await sleep(800);
          setLines((prev) => [...prev.slice(0, -1), `🤖 AI Mentor: ${msg}`]);
        }

        await sleep(1200);
        setLines((prev) => [...prev, ""]);
        await typeLine(stepData.aiHint);

        if (onStepComplete) onStepComplete("ai_hint_seen");
      } else {
        // Command execution
        setLines((prev) => [...prev, ""]);

        // Type the command
        await typeLine(`> ${stepData.cmd}`);
        await sleep(400);

        // Show output
        setLines((prev) => [...prev, ""]);
        const outputLines = stepData.output.split("\n");
        for (let line of outputLines) {
          setLines((prev) => [...prev, line]);
          await sleep(100);
        }
      }

      // Add prompt after each step
      setLines((prev) => [...prev, ""]);
      setLines((prev) => [...prev, "winlab@lab:~$"]);

      currentStep = i + 1;
      setStep(currentStep);

      // Save progress
      localStorage.setItem("winlab_demo_step", currentStep.toString());

      if (onRun) onRun(currentStep);
    }

    setRunning(false);
    setInteractive(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleInput = (e) => {
    if (e.key !== "Enter") return;
    const cmd = input.trim();
    if (!cmd) return;
    const prompt = `winlab@lab:${cwd === "/root" ? "~" : cwd}$`;
    const { out, newCwd } = runBashLayer(cmd, cwd, "demo", () => {});
    setCwd(newCwd || cwd);
    setLines((prev) => [
      ...prev.slice(0, -1),
      `${prompt} ${cmd}`,
      ...out.map((o) => o.text),
      `winlab@lab:${(newCwd || cwd) === "/root" ? "~" : newCwd || cwd}$`,
    ]);
    setInput("");
    if (onRun) onRun(step);
  };

  const resumeSession = () => {
    const savedStep = parseInt(localStorage.getItem("winlab_demo_step") || "0");
    setShowResume(false);
    runStep(savedStep);
  };

  const resetProgress = () => {
    localStorage.removeItem("winlab_demo_step");
    setLines(["winlab@lab:~$"]);
    setStep(0);
    runStep(0);
  };

  return (
    <div className="relative">
      {/* Resume banner */}
      {showResume && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-12 left-0 right-0 bg-blue-600/20 border border-blue-600/30 rounded-lg px-4 py-2 flex items-center justify-between z-10"
        >
          <span className="text-sm text-blue-300">
            Continue your last session? (step {step}/6)
          </span>
          <div className="flex gap-2">
            <button
              onClick={resumeSession}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Resume
            </button>
            <button
              onClick={resetProgress}
              className="text-xs px-3 py-1 text-slate-400 hover:text-white"
            >
              Restart
            </button>
          </div>
        </motion.div>
      )}

      {/* Terminal */}
      <div className="bg-[#0a0a0a] border border-green-500/30 rounded-xl overflow-hidden shadow-2xl shadow-green-500/10">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20 bg-[#050505]">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-green-400/60 font-mono">
            winlab@lab-server:~ — Incident #001
          </span>
        </div>

        {/* Terminal body */}
        <div
          ref={terminalRef}
          className="p-5 font-mono text-sm leading-6 min-h-[320px] max-h-[400px] overflow-y-auto text-green-400"
        >
          <AnimatePresence>
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`${
                  line.includes("❌")
                    ? "text-red-400"
                    : line.includes("✅")
                      ? "text-green-300 font-semibold"
                      : line.includes("🤖 AI Mentor")
                        ? "text-blue-300"
                        : line.includes("💡")
                          ? "text-yellow-300"
                          : line.startsWith(">")
                            ? "text-white"
                            : "text-green-400"
                }`}
              >
                {line}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Cursor */}
          {!running && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2 h-4 bg-green-400 ml-1 align-middle"
            />
          )}
        </div>

        {/* Input / Run button */}
        <div className="px-5 py-4 border-t border-green-500/20 bg-[#050505]">
          {interactive ? (
            <div className="flex items-center gap-2 font-mono text-sm text-green-400">
              <span className="shrink-0 text-green-500">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInput}
                placeholder="type a command…"
                className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-800 caret-green-400"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : (
            <button
              onClick={() => (step === 0 ? runStep(0) : runStep(step))}
              disabled={running || step >= DEMO_STEPS.length}
              className="w-full py-3 bg-green-500/10 border border-green-500/40 text-green-400 font-mono text-sm rounded-lg hover:bg-green-500/20 hover:border-green-500/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {running
                ? "Running..."
                : step === 0
                  ? "▶ Run simulation"
                  : `▶ Continue (step ${step + 1}/6)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
