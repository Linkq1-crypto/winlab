import React, { useEffect, useMemo, useRef, useState } from "react";
import { getOnboardingTrack } from "../data/onboardingLabTracks";

const PORT_CHECK_COMMANDS = [
  "ss -ltnp | grep :80",
  "lsof -i :80",
  "netstat -tulpn | grep :80",
];

const FIX_COMMANDS = [
  "systemctl stop apache2",
  "kill 2041",
  "systemctl restart nginx",
];

export default function LandingTerminalDemo({
  selectedLevel = "",
  connectionStage = "idle",
  onSmallWin,
  gateLoading = false,
  gateError = "",
  onCreateAccount,
  onContinueGuest,
  onUnlock,
}) {
  const track = useMemo(
    () => (selectedLevel ? getOnboardingTrack(selectedLevel) : null),
    [selectedLevel]
  );
  const [lines, setLines] = useState(() => buildStandbyLines());
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("waiting_level");
  const [finchShown, setFinchShown] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!track) {
      setLines(buildStandbyLines());
      setInput("");
      setPhase("waiting_level");
      setFinchShown(false);
      setShowAccess(false);
      return;
    }

    setLines(buildWaitingHandoffLines());
    setInput("");
    setPhase("waiting_connection");
    setFinchShown(false);
    setShowAccess(false);
  }, [track]);

  useEffect(() => {
    if (track && connectionStage === "prompt") {
      setLines(buildActiveTerminalLines(track));
      setPhase("awaiting_start");
    }
  }, [connectionStage, track]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase]);

  function appendLines(nextLines) {
    setLines((prev) => [...prev, ...nextLines]);
  }

  function runCommand(rawValue) {
    const trimmed = rawValue.trim();
    const command = normalizeCommand(trimmed);
    if (!command) return;

    appendLines([`winlab@prod-server:~$ ${trimmed}`]);

    if (command === "finch") {
      if (!finchShown) {
        appendLines(buildFinchLines());
        setFinchShown(true);
      }
      setInput("");
      return;
    }

    if (!track) {
      appendLines(["[ERROR]: operator assignment required"]);
      setInput("");
      return;
    }

    if (phase === "waiting_connection") {
      appendLines(["[ROUTER]: handoff in progress"]);
      setInput("");
      return;
    }

    if (phase === "awaiting_start") {
      if (command !== "start") {
        appendLines(['[ERROR]: type "start"']);
      } else {
        appendLines(buildIncidentAttachLines());
        setPhase("awaiting_check");
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_check") {
      if (PORT_CHECK_COMMANDS.includes(command)) {
        appendLines([
          'LISTEN 0.0.0.0:80 users:(("apache2",pid=2041))',
          "[INCIDENT]: conflicting process detected",
        ]);
        setPhase("awaiting_fix");
      } else {
        appendLines(["[ERROR]: inspect port 80 ownership"]);
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_fix") {
      if (FIX_COMMANDS.includes(command)) {
        appendLines(buildSuccessLines());
        setPhase("post_success");
        onSmallWin?.("nginx-port-conflict");
      } else {
        appendLines(["[ERROR]: release port 80 and recover nginx"]);
      }
      setInput("");
      return;
    }

    if (phase === "post_success") {
      if (command === "save") {
        appendLines(["[AUTH]: persistence requested"]);
        appendLines(buildAccessLines());
        setShowAccess(true);
        setPhase("awaiting_unlock");
        onCreateAccount?.();
      } else if (command === "continue") {
        appendLines(["[ACCESS]: guest session acknowledged"]);
        onContinueGuest?.();
      } else {
        appendLines(['[ERROR]: type "save" or "continue"']);
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_unlock") {
      if (command === "unlock") {
        appendLines(["[ACCESS]: upgrade path selected"]);
        onUnlock?.();
      } else if (command === "continue") {
        appendLines(["[ACCESS]: guest session acknowledged"]);
        onContinueGuest?.();
      } else {
        appendLines(['[ERROR]: type "unlock" or "continue"']);
      }
      setInput("");
      return;
    }

    setInput("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    runCommand(input);
  }

  return (
    <section className="border-t border-zinc-900 bg-black text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:py-8">
        <div className="grid gap-4">
          <TerminalFrame
            title="[INCIDENT]: live system terminal"
            subtitle={track ? `[ROUTER]: operator ${track.level.toLowerCase()}` : "[ROUTER]: standby"}
          >
            <div
              ref={terminalRef}
              className="h-[520px] overflow-y-auto bg-[#05080d] p-6 font-mono text-[14px] leading-[1.65] text-zinc-200 md:text-[15px] lg:text-[16px] lg:leading-[1.75]"
            >
              {lines.map((line, index) => (
                <div key={`${index}-${line}`} className={lineClassName(line)}>
                  {renderLine(line)}
                </div>
              ))}

              <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-3">
                <span className="text-zinc-400">winlab@prod-server:~$</span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="flex-1 bg-transparent text-zinc-100 outline-none"
                />
                <span className="animate-pulse text-zinc-500">_</span>
              </form>

              {gateLoading ? <div className="mt-3 text-amber-300">[AUTH]: persistence request in progress</div> : null}
              {gateError ? <div className="mt-3 text-red-400">[ERROR]: {gateError}</div> : null}
            </div>
          </TerminalFrame>

          {showAccess ? (
            <TerminalFrame
              title="[ACCESS]: routing control"
              subtitle="[SYSTEM]: restricted incident set"
            >
              <div className="bg-[#05080d] p-6 font-mono text-[14px] leading-[1.65] text-zinc-200 md:text-[15px] lg:text-[16px] lg:leading-[1.75]">
                {buildAccessLines().map((line, index) => (
                  <div key={`${index}-${line}`} className={lineClassName(line)}>
                    {renderLine(line)}
                  </div>
                ))}
              </div>
            </TerminalFrame>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TerminalFrame({ title, subtitle, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F141B]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
        <div>
          <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-zinc-400">{title}</div>
          <div className="mt-1 font-mono text-[12px] text-zinc-600">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#F85149]" />
          <span className="h-3 w-3 rounded-full bg-[#D29922]" />
          <span className="h-3 w-3 rounded-full bg-[#3FB950]" />
        </div>
      </div>
      {children}
    </div>
  );
}

function buildStandbyLines() {
  return [
    "[SYSTEM]: router standby",
    "[SYSTEM]: awaiting operator assignment",
    "[SYSTEM]: environment offline",
  ];
}

function buildWaitingHandoffLines() {
  return [
    "[SYSTEM]: router standby",
    "[SYSTEM]: awaiting operator assignment",
    "[SYSTEM]: environment offline",
  ];
}

function buildActiveTerminalLines(track) {
  return [
    "connected to prod-eu-west-1",
    `operator: ${track.level.toUpperCase()}`,
    "",
    `incident: ${track.primaryLab?.slug || "nginx-port-conflict"}`,
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

function buildIncidentAttachLines() {
  return [
    "attaching to node...",
    "loading service state...",
    "",
    "[SYSTEM]: live incident attached",
    "",
    "$ systemctl status nginx",
    "",
    "nginx.service - failed",
    "bind() to 0.0.0.0:80 failed",
  ];
}

function buildSuccessLines() {
  return [
    "",
    "[SUCCESS] service restored",
    "[SYSTEM]: traffic normalized",
    "[SYSTEM]: incident closed",
    "[SYSTEM]: progress not persisted",
    "",
    'type "save" to create account',
    'type "continue" to proceed without saving',
  ];
}

function buildAccessLines() {
  return [
    "[ACCESS]: additional incidents locked",
    "",
    "available incidents:",
    "* disk-full",
    "* permission-denied",
    "* memory-leak",
    "* db-dead",
    "* api-timeout",
    "+29 more",
    "",
    "[ACCESS]: restricted",
    "",
    "plans:",
    "* starter: free",
    "* early-access: €5/month",
    "* pro: €19/month",
    "* lifetime: €199",
    "",
    'type "unlock" to continue',
  ];
}

function buildFinchLines() {
  return [
    "[WINLAB-AUTH]: identity confirmed",
    "",
    "[H. FINCH]:",
    '"Eventually, everyone has a friend.',
    "If you don't have one,",
    "I'll be your friend.",
    'But I\'ll be a very, very quiet one."',
    "",
    "[SYSTEM]: access granted to the irrelevant list",
  ];
}

function normalizeCommand(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function lineClassName(line) {
  if (!line) return "h-4";
  if (/^\[SUCCESS\]/.test(line) || /\[SYSTEM\]: traffic normalized|\[SYSTEM\]: incident closed/.test(line)) return "text-emerald-400";
  if (/^\[ERROR\]/.test(line) || /failed|unavailable|offline|degraded|bind\(\)/i.test(line)) return "text-red-400";
  if (/^\[ACCESS\]|^\[AUTH\]|^status: degraded|^impact:|^hints:|^AI mentor:|^type "start"|^type "unlock"|^type "save"|^type "continue"/i.test(line)) return "text-amber-300";
  if (/^\[SYSTEM\]|^\[ROUTER\]|^connected to|^operator:|^incident:|^plans:|^available incidents:/i.test(line)) return "text-zinc-400";
  if (/^\[H\. FINCH\]|^\[WINLAB-AUTH\]/.test(line)) return "text-zinc-200";
  if (/^winlab@prod-server:~\$|^\$ /.test(line)) return "text-zinc-100";
  return "text-zinc-300";
}

function renderLine(line) {
  if (!line) return <span>&nbsp;</span>;
  return line;
}
