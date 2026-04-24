import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOnboardingTrack } from "../data/onboardingLabTracks";
import { TerminalWindow } from "./HeroSection";

const PORT_CHECK_OUTPUT = 'LISTEN 0.0.0.0:80 users:(("apache2",pid=2041))';
const ASSIST_LEVELS = new Set(["Novice", "Junior"]);

export default function LandingTerminalDemo({
  selectedLevel = "",
  selectedLab = "nginx-port-conflict",
  labStatus = "pending",
  routerStatus = "awaiting_operator",
  selectedFile = "",
  fileOpened = false,
  slaSeconds = 299,
  gateLoading = false,
  gateError = "",
  onLabStateChange,
  onTrafficRecovering,
  onSmallWin,
  onCreateAccount,
  onContinueGuest,
  onUnlock,
}) {
  const track = useMemo(
    () => (selectedLevel ? getOnboardingTrack(selectedLevel) : null),
    [selectedLevel]
  );
  const assistEnabled = ASSIST_LEVELS.has(selectedLevel);
  const [lines, setLines] = useState(() => buildPendingLines());
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("pending");
  const [finchShown, setFinchShown] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!track || labStatus === "pending") {
      setLines(buildPendingLines());
      setPhase("pending");
      setInput("");
      setFinchShown(false);
      setStreaming(false);
      setAnalysisActive(false);
      return;
    }

    if (labStatus === "ready") {
      setLines(buildReadyLines(track, selectedLab));
      setPhase("awaiting_start");
      setInput("");
      return;
    }

    if (labStatus === "breached") {
      setLines((prev) => [
        ...prev,
        "",
        "[ERROR]: SLA breached",
        "[SYSTEM]: customer traffic remained unavailable",
        '[SYSTEM]: session terminated. Type "restart" to retry.',
      ]);
      setPhase("breached");
      setInput("");
    }
  }, [track, labStatus, selectedLab]);

  useEffect(() => {
    if (phase === "waiting_file" && fileOpened) {
      setLines((prev) => [
        ...prev,
        "[kernel-assistant]: port_collision detected. target_pid: 2041.",
        '[kernel-assistant]: type "check" or click [CHECK_STATUS].',
      ]);
      onTrafficRecovering?.();
      setPhase("awaiting_check");
      setInput("");
    }
  }, [fileOpened, onTrafficRecovering, phase]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus();
    }
  }, [phase, streaming]);

  function appendLines(nextLines) {
    setLines((prev) => [...prev, ...nextLines]);
  }

  async function withAnalysis(task, duration = 520) {
    setAnalysisActive(true);
    try {
      await task();
    } finally {
      window.setTimeout(() => setAnalysisActive(false), duration);
    }
  }

  async function streamLines(nextLines, delay = 90) {
    setStreaming(true);
    for (const line of nextLines) {
      // Keep staggered amber output deterministic.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        window.setTimeout(() => {
          setLines((prev) => [...prev, line]);
          resolve();
        }, delay);
      });
    }
    setStreaming(false);
  }

  function executeSuggestedCommand(command) {
    if (!command || streaming) return;
    setInput(command);
    window.setTimeout(() => {
      runCommand(command);
      setInput("");
    }, 40);
  }

  async function runCommand(rawValue) {
    const trimmed = rawValue.trim();
    const command = normalizeCommand(trimmed);
    if (!command || streaming) return;

    appendLines([`winlab@prod-server:~$ ${trimmed}`]);

    if (command === "finch") {
      if (!finchShown) {
        appendLines([
          "[WINLAB-AUTH]: Identity confirmed.",
          '[H. FINCH]: "Eventually, everyone has a friend..."',
          "[SYSTEM]: Access granted to the Irrelevant List.",
          "[SYSTEM]: Loading hidden incidents: shadow-incident-routing, ghost-node-failure.",
        ]);
        setFinchShown(true);
      }
      setInput("");
      return;
    }

    if (!track || labStatus === "pending") {
      appendLines(["[SYSTEM]: router standby", "[SYSTEM]: awaiting operator assignment"]);
      setInput("");
      return;
    }

    if (phase === "post_success" || phase === "awaiting_unlock") {
      if (command === "winlab plans") {
        await withAnalysis(async () => {
          await streamLines(buildPlansSequence(), 50);
        }, 400);
        setPhase("awaiting_unlock");
        setInput("");
        return;
      }

      if (command === "upgrade") {
        appendLines(["[PROMPT]: specify target with upgrade early-access | upgrade pro | upgrade lifetime"]);
        setInput("");
        return;
      }

      if (command.startsWith("upgrade ")) {
        const normalizedPlan = normalizeUpgradePlan(command.slice("upgrade ".length).trim());
        if (!normalizedPlan) {
          appendLines(['[ERROR]: type "upgrade starter", "upgrade early-access", "upgrade pro", or "upgrade lifetime"']);
          setInput("");
          return;
        }

        if (normalizedPlan === "starter") {
          appendLines([
            "[ACCESS]: starter status already available",
            "[SYSTEM]: continue routing in free capacity",
          ]);
          setInput("");
          return;
        }

        await withAnalysis(async () => {
          appendLines([
            "[ACCESS]: upgrade trajectory initialized",
            "[PAYMENT]: validating payment trajectory...",
            "[PAYMENT]: probable outcome: successful enrollment",
          ]);
        }, 700);
        setInput("");
        onUnlock?.(normalizedPlan);
        return;
      }
    }

    if (phase === "awaiting_start") {
      if (command !== "start") {
        appendLines(['[ERROR]: type "start"']);
      } else {
        await withAnalysis(async () => {
          appendLines([
            "attaching to node...",
            "loading service state...",
            "[SYSTEM]: live incident attached",
            "[SYSTEM]: Emergency detected in prod-eu-west-1.",
            "[SYSTEM]: Click the highlighted file to analyze the error log.",
          ]);
        });
        onLabStateChange?.("active");
        setPhase("waiting_file");
      }
      setInput("");
      return;
    }

    if (phase === "waiting_file") {
      appendLines([`[ERROR]: open ${selectedFile || "incident_nginx.err"} first`]);
      setInput("");
      return;
    }

    if (phase === "awaiting_check") {
      if (command !== "check" && command !== "status") {
        appendLines(['[ERROR]: type "check" or "status"']);
      } else {
        await withAnalysis(async () => {
          appendLines([
            PORT_CHECK_OUTPUT,
            "[kernel-assistant]: port_collision confirmed. target_pid: 2041.",
            '[kernel-assistant]: type "fix" or click [RESOLVE].',
          ]);
        });
        setPhase("awaiting_fix");
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_fix") {
      if (command !== "fix") {
        appendLines(['[ERROR]: type "fix"']);
      } else {
        await withAnalysis(async () => {
          appendLines([
            "[SUCCESS] SERVICE RESTORED",
            "[SYSTEM]: traffic normalized",
            "[SYSTEM]: incident closed",
            "[SYSTEM]: progress not persisted",
            "[SYSTEM]: credit this resolution to your profile?",
            'type "save" to create account',
            'type "continue" to proceed without saving',
            'type "winlab plans" to inspect operator capacity',
          ]);
        }, 820);
        setPhase("post_success");
        onSmallWin?.(selectedLab);
      }
      setInput("");
      return;
    }

    if (phase === "post_success") {
      if (command === "save") {
        appendLines([
          "[ACCESS]: additional incidents locked",
          '[SYSTEM]: type "winlab plans" to inspect operator capacity.',
        ]);
        setPhase("awaiting_unlock");
        onCreateAccount?.();
      } else if (command === "continue") {
        appendLines(["[ACCESS]: guest session acknowledged"]);
        onContinueGuest?.();
      } else {
        appendLines(['[ERROR]: type "save", "continue", or "winlab plans"']);
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_unlock") {
      if (command === "continue") {
        appendLines(["[ACCESS]: guest session acknowledged"]);
        onContinueGuest?.();
      } else {
        appendLines(['[ERROR]: type "winlab plans", "upgrade <id>", or "continue"']);
      }
      setInput("");
      return;
    }

    if (phase === "breached") {
      if (command === "restart") {
        setLines(buildReadyLines(track, selectedLab));
        setPhase("awaiting_start");
      } else {
        appendLines(['[ERROR]: type "restart"']);
      }
      setInput("");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runCommand(input);
  }

  function handleKeyDown(event) {
    if (event.key === "Tab" && assistEnabled) {
      const suggestion = ghostSuggestion(phase, selectedFile, assistEnabled);
      if (suggestion) {
        event.preventDefault();
        setInput(suggestion);
      }
    }
  }

  const ghostText = !input ? ghostSuggestion(phase, selectedFile, assistEnabled) : "";

  return (
    <TerminalWindow
      title="live-lab-terminal"
      subtitle={`${routerStatus} | ${labStatus}`}
      accent={analysisActive ? "red" : "amber"}
      overlay={
        <AnimatePresence>
          {analysisActive ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="pointer-events-none absolute right-5 top-16 w-64 border border-[#ff0000] bg-black/90 p-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#ff3b3b]"
              style={{ fontFamily: '"Courier New", "Lucida Console", monospace' }}
            >
              <div>Calculating data trajectory....</div>
              <div className="mt-3 space-y-2 text-[10px] text-[#ff6b6b]">
                <div>/\\/\\/\\/\\/\\/\\/\\/\\</div>
                <div>&gt; vector: prod-eu-west-1</div>
                <div>&gt; matrix: operator_shell</div>
                <div>&gt; secure_bridge: active</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      }
    >
      <div
        ref={terminalRef}
        className="h-full overflow-y-auto bg-black p-5 font-mono text-[14px] leading-[1.7] text-[#ffb000] md:text-[15px] lg:text-[16px]"
        style={{ fontFamily: '"Courier New", "Lucida Console", monospace' }}
      >
        {lines.map((line, index) => (
          <motion.div
            key={`${index}-${line}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
            className={lineClassName(line)}
          >
            <InteractiveLine line={line} onCommand={executeSuggestedCommand} />
          </motion.div>
        ))}

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-3">
          <span className="text-[#ffb000]">winlab@prod-server:~$</span>
          <div className="relative flex-1">
            {ghostText ? (
              <div className="pointer-events-none absolute inset-0 flex items-center text-[#5b3e00]">
                {ghostText}
              </div>
            ) : null}
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              className="relative w-full bg-transparent text-[#ffd36d] outline-none disabled:text-[#8f6b23]"
            />
          </div>
          {!streaming ? <span className="animate-pulse text-[#ffb000]">_</span> : null}
        </form>

        {phaseHint(phase, selectedFile, slaSeconds, assistEnabled) ? (
          <div className="mt-2 text-[13px] text-[#8f6b23]">
            {phaseHint(phase, selectedFile, slaSeconds, assistEnabled)}
          </div>
        ) : null}

        {gateLoading ? <div className="mt-3 text-[#ffb000]">[AUTH]: persistence request in progress</div> : null}
        {gateError ? <div className="mt-3 text-[#ff3b3b]">[ERROR]: {gateError}</div> : null}
      </div>
    </TerminalWindow>
  );
}

function buildPendingLines() {
  return [
    "[SYSTEM]: router standby",
    "[SYSTEM]: awaiting operator assignment",
    "[SYSTEM]: environment offline",
  ];
}

function buildReadyLines(track, selectedLab) {
  return [
    "connected to prod-eu-west-1",
    `operator: ${track.level.toUpperCase()}`,
    "",
    `incident: ${selectedLab || track.primaryLab?.slug || "nginx-port-conflict"}`,
    "status: degraded",
    "impact: public traffic unavailable",
    "",
    `hints: ${track.hints}`,
    `AI mentor: ${track.aiMentor}`,
    "",
    "[SYSTEM]: terminal active",
    'type "start"',
  ];
}

function buildPlansSequence() {
  return [
    "[SYSTEM]: Accessing encrypted billing_nodes...",
    "[SYSTEM]: Connection established with Central Billing API.",
    "[SYSTEM]: Formatting operator_matrix in EUR (\u20ac)...",
    "",
    ".-------------------------------------------------------.",
    "| PLAN ID                                                   | CAPACITY | MONTHLY COST    |",
    "| --------------------------------------------------------- | -------- | --------------- |",
    "| STARTER                                                   | 01 LABS  | \u20ac 0.00          |",
    "| EARLY ACCESS                                              | 10 LABS  | \u20ac 5.00          |",
    "| PRO OPERATOR                                              | 34 LABS  | \u20ac 19.00         |",
    "| LIFETIME                                                  | 34 LABS  | \u20ac 199.00 (ONCE) |",
    "| '-------------------------------------------------------' |          |                 |",
    "",
    "[INFO]: 34 production labs available for PRO/LIFETIME levels.",
    "[PROMPT]: Type upgrade to initiate secure_bridge (Stripe integration).",
  ];
}

function normalizeUpgradePlan(planId) {
  if (planId === "starter") return "starter";
  if (planId === "early" || planId === "early-access") return "early-access";
  if (planId === "pro") return "pro";
  if (planId === "lifetime") return "lifetime";
  return "";
}

function normalizeCommand(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function ghostSuggestion(phase, selectedFile, assistEnabled) {
  if (!assistEnabled) return "";
  if (phase === "awaiting_start") return "start";
  if (phase === "waiting_file") return `open ${selectedFile || "incident_nginx.err"}`;
  if (phase === "awaiting_check") return "check";
  if (phase === "awaiting_fix") return "fix";
  if (phase === "post_success") return "save";
  if (phase === "awaiting_unlock") return "winlab plans";
  if (phase === "breached") return "restart";
  return "";
}

function phaseHint(phase, selectedFile, slaSeconds, assistEnabled) {
  if (!assistEnabled && phase !== "awaiting_unlock") return "";
  if (phase === "waiting_file") return `[kernel-assistant]: open ${selectedFile || "incident_nginx.err"} to inspect port collision`;
  if (phase === "awaiting_unlock") return `[ACCESS]: escalation window ${formatSlaSeconds(slaSeconds)} | type 'winlab plans'`;
  return "";
}

function formatSlaSeconds(totalSeconds) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function InteractiveLine({ line, onCommand }) {
  const tokens = [];
  const regex = /"([^"]+)"|\[([A-Z_]+)\]/g;
  let lastIndex = 0;
  let match = regex.exec(line);

  while (match) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }

    const quoted = match[1];
    const bracketed = match[2];
    const command = quoted || bracketToCommand(bracketed);
    tokens.push({ type: "command", label: quoted ? `"${quoted}"` : `[${bracketed}]`, command });
    lastIndex = regex.lastIndex;
    match = regex.exec(line);
  }

  if (lastIndex < line.length) {
    tokens.push({ type: "text", value: line.slice(lastIndex) });
  }

  if (!tokens.some((token) => token.type === "command")) {
    return line || <span>&nbsp;</span>;
  }

  return tokens.map((token, index) =>
    token.type === "command" ? (
      <button
        key={`${token.label}-${index}`}
        type="button"
        onClick={() => onCommand(token.command)}
        className="mx-0.5 border border-[#ffb000]/30 px-1 text-[#ffd36d] hover:border-[#ffb000] hover:bg-[#1b1200]"
      >
        {token.label}
      </button>
    ) : (
      <React.Fragment key={`${token.value}-${index}`}>{token.value}</React.Fragment>
    )
  );
}

function bracketToCommand(value) {
  if (value === "CHECK_STATUS") return "status";
  if (value === "RESOLVE") return "fix";
  return value.toLowerCase();
}

function lineClassName(line) {
  if (!line) return "h-4";
  if (/^\[SUCCESS\]/.test(line) || /\[SYSTEM\]: traffic normalized|\[SYSTEM\]: incident closed/.test(line)) {
    return "text-[#ffd36d]";
  }
  if (/^\[ERROR\]/.test(line) || /failed|offline|degraded|bind\(\)|trajectory/i.test(line)) {
    return "text-[#ff3b3b]";
  }
  if (/^\[kernel-assistant\]|^\[INFO\]|^\[PROMPT\]|^hints:|^AI mentor:/i.test(line)) {
    return "text-[#d3961a]";
  }
  if (/^\[SYSTEM\]|^\[ACCESS\]|^\[PAYMENT\]|^connected to|^operator:|^incident:|^\||^\./i.test(line)) {
    return "text-[#ffb000]";
  }
  if (/^\[H\. FINCH\]/.test(line)) return "text-[#ffe1a3]";
  if (/^winlab@prod-server:~\$/.test(line)) return "text-[#ffd36d]";
  return "text-[#ffb000]";
}
