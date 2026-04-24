import React, { useEffect, useMemo, useRef, useState } from "react";
import { getOnboardingTrack } from "../data/onboardingLabTracks";
import { TerminalWindow } from "./HeroSection";

const PORT_CHECK_OUTPUT = 'LISTEN 0.0.0.0:80 users:(("apache2",pid=2041))';

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
  const [lines, setLines] = useState(() => buildPendingLines());
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("pending");
  const [finchShown, setFinchShown] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!track || labStatus === "pending") {
      setLines(buildPendingLines());
      setPhase("pending");
      setInput("");
      setFinchShown(false);
      setStreaming(false);
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
        '[H. FINCH]: The log says port 80 is already occupied by another service.',
        '[H. FINCH]: We need to see who is responsible. Type "check".',
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

  async function streamLines(nextLines, delay = 170) {
    setStreaming(true);
    for (const line of nextLines) {
      // Keep the terminal feeling sequential without adding loaders.
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

  async function runCommand(rawValue) {
    const trimmed = rawValue.trim();
    const command = normalizeCommand(trimmed);
    if (!command || streaming) return;

    appendLines([`winlab@prod-server:~$ ${trimmed}`]);

    if (command === "finch") {
      if (!finchShown) {
        appendLines([
          "[WINLAB-AUTH]: Identity confirmed.",
          "",
          '[H. FINCH]: "Eventually, everyone has a friend. If you don\'t have one, I\'ll be your friend. But I\'ll be a very, very quiet one."',
          "",
          "[SYSTEM]: Access granted to the Irrelevant List.",
          "[SYSTEM]: Loading hidden incidents...",
          "* shadow-incident-routing",
          "* ghost-node-failure",
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
        await streamLines(buildPlansSequence());
        setPhase("awaiting_unlock");
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

        appendLines([
          "[ACCESS]: upgrade trajectory initialized",
          "[PAYMENT]: validating payment trajectory...",
          "[PAYMENT]: probable outcome: successful enrollment",
          "",
          "+-------------------------------------------+",
          "| VALIDATING PAYMENT TRAJECTORY...          |",
          "| PROBABLE OUTCOME: SUCCESSFUL ENROLLMENT.  |",
          "+-------------------------------------------+",
        ]);
        setInput("");
        onUnlock?.(normalizedPlan);
        return;
      }
    }

    if (phase === "awaiting_start") {
      if (command !== "start") {
        appendLines(['[ERROR]: type "start"']);
      } else {
        appendLines([
          "attaching to node...",
          "loading service state...",
          "",
          "[SYSTEM]: live incident attached",
          "[SYSTEM]: Emergency detected in prod-eu-west-1.",
          "[SYSTEM]: Click the highlighted file to analyze the error log.",
        ]);
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
        appendLines([
          PORT_CHECK_OUTPUT,
          "[SYSTEM]: Identified conflict: apache (httpd) is blocking the web server.",
          '[TUTORIAL]: To repair the system, write "fix" and press Enter.',
        ]);
        setPhase("awaiting_fix");
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_fix") {
      if (command !== "fix") {
        appendLines(['[ERROR]: type "fix"']);
      } else {
        appendLines([
          "[SUCCESS] SERVICE RESTORED",
          "[SYSTEM]: traffic normalized",
          "[SYSTEM]: incident closed",
          "[SYSTEM]: progress not persisted",
          "[SYSTEM]: credit this resolution to your profile?",
          "",
          'type "save" to create account',
          'type "continue" to proceed without saving',
          'type "winlab plans" to inspect operator capacity',
        ]);
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

  return (
    <TerminalWindow title="live-lab-terminal" subtitle={`${routerStatus} | ${labStatus}`}>
      <div
        ref={terminalRef}
        className="h-full overflow-y-auto bg-[#05080d] p-5 font-mono text-[14px] leading-[1.65] text-zinc-200 md:text-[15px] lg:text-[16px] lg:leading-[1.75]"
      >
        {lines.map((line, index) => (
          <div key={`${index}-${line}`} className={lineClassName(line)}>
            {line || <span>&nbsp;</span>}
          </div>
        ))}

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-3">
          <span className="text-zinc-400">winlab@prod-server:~$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholderForPhase(phase, selectedFile)}
            disabled={streaming}
            className="flex-1 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600 disabled:text-zinc-500"
          />
          {!streaming ? <span className="animate-pulse text-zinc-500">_</span> : null}
        </form>

        {ghostHintForPhase(phase, selectedFile, slaSeconds) ? (
          <div className="mt-2 text-[13px] text-zinc-600">
            {ghostHintForPhase(phase, selectedFile, slaSeconds)}
          </div>
        ) : null}

        {gateLoading ? <div className="mt-3 text-amber-300">[AUTH]: persistence request in progress</div> : null}
        {gateError ? <div className="mt-3 text-red-400">[ERROR]: {gateError}</div> : null}
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
    "[SYSTEM]: Formatting operator_matrix in EUR (€)...",
    "",
    ".-------------------------------------------------------.",
    "| PLAN ID                                                   | CAPACITY | MONTHLY COST    |",
    "| --------------------------------------------------------- | -------- | --------------- |",
    "| STARTER                                                   | 01 LABS  | € 0.00          |",
    "| EARLY ACCESS                                              | 10 LABS  | € 5.00          |",
    "| PRO                                                       | 34 LABS  | € 19.00         |",
    "| LIFETIME                                                  | 34 LABS  | € 199.00 (ONCE) |",
    "| '-------------------------------------------------------' |          |                 |",
    "",
    "[INFO]: 34 production labs available for PRO/LIFETIME levels.",
    "[PROMPT]: Type 'upgrade <id>' to promote your status.",
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

function placeholderForPhase(phase, selectedFile) {
  if (phase === "awaiting_start") return "start";
  if (phase === "waiting_file") return `open ${selectedFile || "incident_nginx.err"}`;
  if (phase === "awaiting_check") return "hint: check or status";
  if (phase === "awaiting_fix") return "fix";
  if (phase === "post_success") return "save";
  if (phase === "awaiting_unlock") return "winlab plans";
  if (phase === "breached") return "restart";
  return "";
}

function ghostHintForPhase(phase, selectedFile, slaSeconds) {
  if (phase === "awaiting_start") return "[SUGGESTION]: type 'start'";
  if (phase === "waiting_file") return `[SUGGESTION]: click ${selectedFile || "incident_nginx.err"} in the file manager`;
  if (phase === "awaiting_check") return "[SUGGESTION]: type 'check' or 'status'";
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

function lineClassName(line) {
  if (!line) return "h-4";
  if (
    /^\[SUCCESS\]/.test(line) ||
    /\[SYSTEM\]: traffic normalized|\[SYSTEM\]: incident closed|^\[ACCESS\]: upgrade trajectory initialized|^\[PAYMENT\]: probable outcome/i.test(
      line
    )
  ) {
    return "text-emerald-400";
  }
  if (/^\[ERROR\]/.test(line) || /failed|unavailable|offline|degraded|bind\(\)|VALIDATING PAYMENT TRAJECTORY/i.test(line)) {
    return "text-red-400";
  }
  if (/^\[ACCESS\]|^\[AUTH\]|^\[TUTORIAL\]|^\[INFO\]|^\[PROMPT\]|^status: degraded|^impact:|^hints:|^AI mentor:|^type /i.test(line)) {
    return "text-amber-300";
  }
  if (/^\[SYSTEM\]|^\[ROUTER\]|^\[INCIDENT\]|^\[WINLAB-AUTH\]|^connected to|^operator:|^incident:|^\||^\./i.test(line)) {
    return "text-zinc-400";
  }
  if (/^\[H\. FINCH\]/.test(line)) return "text-zinc-200";
  if (/^winlab@prod-server:~\$|^\$ /.test(line)) return "text-zinc-100";
  return "text-zinc-300";
}
