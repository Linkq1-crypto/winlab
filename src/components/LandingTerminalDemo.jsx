import React, { useEffect, useMemo, useRef, useState } from "react";
import { getOnboardingTrack } from "../data/onboardingLabTracks";

const NOVICE_FIX_COMMANDS = [
  "systemctl stop apache2",
  "kill 2041",
  "systemctl restart nginx",
];

const NEXT_CHECK_COMMANDS = [
  "ss -ltnp | grep :80",
  "lsof -i :80",
  "netstat -tulpn | grep :80",
];

export default function LandingTerminalDemo({
  selectedLevel = "",
  connectionStage = "idle",
  previewIncidentSlug = "",
  onSmallWin,
  gateLoading = false,
  gateError = "",
  onCreateAccount,
  onContinueGuest,
}) {
  const track = useMemo(
    () => (selectedLevel ? getOnboardingTrack(selectedLevel) : null),
    [selectedLevel]
  );
  const [lines, setLines] = useState(() => buildWaitingLines(previewIncidentSlug));
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("waiting_level");
  const [resolved, setResolved] = useState(false);
  const [connectionMarker, setConnectionMarker] = useState("idle");
  const [portCleared, setPortCleared] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (!track) {
      setLines(buildWaitingLines(previewIncidentSlug));
      setInput("");
      setPhase("waiting_level");
      setResolved(false);
      setConnectionMarker("idle");
      setPortCleared(false);
      return;
    }

    setLines(buildTrackLines(track, previewIncidentSlug));
    setInput("");
    setPhase("waiting_connection");
    setResolved(false);
    setConnectionMarker("prepared");
    setPortCleared(false);
  }, [previewIncidentSlug, track]);

  useEffect(() => {
    if (!track) return;

    if (connectionStage === "connected" && connectionMarker === "prepared") {
      setLines((prev) => [...prev, "", "connected to prod-eu-west-1"]);
      setConnectionMarker("connected");
      return;
    }

    if (connectionStage === "prompt" && connectionMarker !== "prompt") {
      setLines((prev) => [
        ...prev,
        "winlab@prod-server:~$ _",
        'Type "start" to begin the demo.',
      ]);
      setPhase("awaiting_start");
      setConnectionMarker("prompt");
    }
  }, [connectionMarker, connectionStage, track]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [lines]);

  const helperText = useMemo(() => {
    if (!track) return "Choose your level in the hero terminal first.";
    if (phase === "waiting_connection") return "Environment routing in progress...";
    if (phase === "awaiting_start") return "start";
    if (phase === "awaiting_check") return NEXT_CHECK_COMMANDS[0];
    if (phase === "awaiting_fix") return NOVICE_FIX_COMMANDS[0];
    if (resolved) return "Create a free account to unlock the full track.";
    return track.commands[0];
  }, [phase, resolved, track]);

  function focusInput() {
    commandInputRef.current?.focus();
  }

  function appendLines(nextLines) {
    setLines((prev) => [...prev, ...nextLines]);
  }

  function runCommand(rawCommand) {
    const command = rawCommand.trim();
    if (!command) return;

    appendLines([`$ ${command}`]);

    if (!track) {
      appendLines(['[hint] Choose your operator level in the hero terminal first.']);
      setInput("");
      return;
    }

    if (phase === "waiting_connection") {
      appendLines(['[hint] Wait for the terminal handoff to finish.']);
      setInput("");
      return;
    }

    if (phase === "awaiting_start") {
      if (normalizeCommand(command) !== "start") {
        appendLines(['[hint] Type "start" to begin the demo.']);
        setInput("");
        return;
      }

      appendLines(buildDemoStartLines(track.level));
      setPhase(track.level === "Novice" || track.level === "Junior" ? "awaiting_check" : "awaiting_resolution");
      setPortCleared(false);
      setInput("");
      return;
    }

    if (phase === "awaiting_check") {
      if (NEXT_CHECK_COMMANDS.some((candidate) => normalizeCommand(candidate) === normalizeCommand(command))) {
        appendLines([
          'LISTEN 0.0.0.0:80 users:(("apache2",pid=2041))',
          "apache2 is occupying port 80.",
          "Stop the conflicting process before restarting nginx.",
        ]);
        setPhase("awaiting_fix");
      } else {
        appendLines(['[hint] Check what is already bound to port 80.']);
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_fix") {
      const normalized = normalizeCommand(command);

      if (normalized === normalizeCommand("systemctl stop apache2")) {
        appendLines([
          "Stopping apache2.service...",
          "[ok] apache2 stopped",
          "[ok] port 80 released",
          "Now restart nginx.",
        ]);
        setPortCleared(true);
        setInput("");
        return;
      }

      if (normalized === normalizeCommand("kill 2041")) {
        appendLines([
          "SIGTERM sent to pid 2041",
          "[ok] conflicting process terminated",
          "[ok] port 80 released",
          "Now restart nginx.",
        ]);
        setPortCleared(true);
        setInput("");
        return;
      }

      if (normalized === normalizeCommand("systemctl restart nginx")) {
        if (!portCleared) {
          appendLines([
            "Job for nginx.service failed because the control process exited with error code.",
            "bind() to 0.0.0.0:80 failed (98: Address already in use)",
            '[hint] apache2 is still holding port 80. Stop it first.',
          ]);
          setInput("");
          return;
        }

        appendLines(buildResolvedLines(track.level));
        setResolved(true);
        setPhase("resolved");
        onSmallWin?.(track.primaryLab?.slug || "nginx-port-conflict");
        setInput("");
        return;
      }

      appendLines(['[hint] Stop the process that already owns port 80, then restart nginx.']);
      setInput("");
      return;
    }

    if (phase === "awaiting_resolution") {
      const expected = track.commands;
      if (normalizeCommand(command) === normalizeCommand(expected[0])) {
        appendLines(levelSpecificResponse(track.level, 0));
        setPhase("awaiting_resolution_2");
        setInput("");
        return;
      }

      appendLines([`[hint] Start with "${expected[0]}".`]);
      setInput("");
      return;
    }

    if (phase === "awaiting_resolution_2") {
      const expected = track.commands;
      if (normalizeCommand(command) === normalizeCommand(expected[1])) {
        appendLines([...levelSpecificResponse(track.level, 1), ...buildResolvedLines(track.level)]);
        setResolved(true);
        setPhase("resolved");
        onSmallWin?.(track.primaryLab?.slug || "");
      } else {
        appendLines([`[hint] Now inspect with "${expected[1]}".`]);
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
    <section id="interactive-demo" className="border-t border-zinc-900 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <div className="text-sm text-zinc-400">onboarding terminal</div>
                <div className="text-xs text-zinc-600">
                  {track ? `active track: ${track.trackLabel}` : "operator assignment pending"}
                </div>
              </div>
              <button
                type="button"
                onClick={focusInput}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-black"
              >
                Focus input
              </button>
            </div>

            <div
              ref={terminalRef}
              className="h-[420px] overflow-y-auto bg-black p-4 font-mono text-sm leading-7"
            >
              {lines.map((line, index) => (
                <div key={`${index}-${line}`} className={lineClassName(line)}>
                  {renderTerminalLine(line)}
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              {track ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {phase === "awaiting_check"
                    ? NEXT_CHECK_COMMANDS.map((command) => (
                        <QuickCommand key={command} command={command} onRun={runCommand} />
                      ))
                    : phase === "awaiting_fix"
                      ? NOVICE_FIX_COMMANDS.map((command) => (
                          <QuickCommand key={command} command={command} onRun={runCommand} />
                        ))
                      : phase === "awaiting_start"
                        ? [<QuickCommand key="start" command="start" onRun={runCommand} />]
                        : phase === "awaiting_resolution" || phase === "awaiting_resolution_2"
                          ? track.commands.map((command) => (
                              <QuickCommand key={command} command={command} onRun={runCommand} />
                            ))
                          : null}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="flex items-center gap-3">
                <span className="font-mono text-sm text-zinc-500">winlab@prod-server:~$</span>
                <input
                  ref={commandInputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-600"
                  placeholder={helperText}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-white px-3 py-2 text-sm text-black hover:bg-zinc-200"
                >
                  Run
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <LevelStatusCard track={track} />
            <HowItWorksCard />
            <GateCard
              completed={resolved}
              loading={gateLoading}
              error={gateError}
              onCreateAccount={onCreateAccount}
              onContinueGuest={onContinueGuest}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickCommand({ command, onRun }) {
  return (
    <button
      type="button"
      onClick={() => onRun(command)}
      className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white"
    >
      {command}
    </button>
  );
}

function LevelStatusCard({ track }) {
  if (!track) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Operator Level</div>
        <h2 className="text-2xl font-semibold leading-tight">Awaiting router handoff</h2>
        <p className="mt-3 text-sm text-zinc-400">
          [SYSTEM]: active terminal pending operator assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Operator Level</div>
      <h2 className="text-2xl font-semibold leading-tight">{track.level}</h2>
      <p className="mt-3 text-sm text-zinc-400">
        The lab terminal is already calibrated before the handoff finishes.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <StatusChip label="level" value={track.level} tone="success" />
        <StatusChip label="incident" value={track.primaryLab?.slug || "pending"} tone="warning" />
        <StatusChip label="hints" value={track.hints} tone="muted" />
        <StatusChip label="AI mentor" value={track.aiMentor} tone="muted" />
        <StatusChip label="status" value="live" tone="success" />
      </div>
    </div>
  );
}

function StatusChip({ label, value, tone }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-zinc-800 bg-black text-zinc-300";

  return (
    <div className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
      <span className="text-zinc-500">{label}:</span> {value}
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div id="how-it-works" className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">How it works</div>
      <div className="grid gap-3">
        <FlowRow index="01" text="[SYSTEM]: operator classified in router." />
        <FlowRow index="02" text="[SYSTEM]: calibrated terminal routed live." />
        <FlowRow index="03" text='[SYSTEM]: type "start" and stabilize the incident.' />
        <FlowRow index="04" text="[SYSTEM]: authenticate only after the first recovery." />
      </div>
    </div>
  );
}

function GateCard({ completed, loading, error, onCreateAccount, onContinueGuest }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Continue</div>
      <h2 className="text-2xl font-semibold leading-tight">
        [SYSTEM]: incident routing active
      </h2>
      <p className="mt-3 text-sm text-zinc-400">
        {completed
          ? "[SYSTEM]: account gate remains offline until the first incident is stabilized."
          : "[SYSTEM]: account gate remains offline until the first incident is stabilized."}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCreateAccount}
          disabled={!completed || loading}
          className="rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting incident..." : "Create free account"}
        </button>
        <button
          type="button"
          onClick={onContinueGuest}
          disabled={!completed || loading}
          className="rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue as guest
        </button>
      </div>

      {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
    </div>
  );
}

function FlowRow({ index, text }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-zinc-300">
      <span className="mr-3 text-zinc-500">{index}</span>
      {text}
    </div>
  );
}

function buildWaitingLines(previewIncidentSlug) {
  const lines = [
    "[SYSTEM]: operator assignment pending",
    "[SYSTEM]: router standby",
    "[SYSTEM]: waiting for operator assignment",
    "winlab@prod-server:~$",
    "router handoff pending",
  ];
  if (previewIncidentSlug) {
    lines.push(`preview incident: ${previewIncidentSlug}`);
  }
  return lines;
}

function buildTrackLines(track, previewIncidentSlug) {
  const selectedIncident = previewIncidentSlug || track.primaryLab?.slug || "pending";
  return [
    "connected to prod-eu-west-1",
    `operator: ${track.level.toUpperCase()}`,
    "",
    `incident: ${selectedIncident}`,
    "status: degraded",
    "impact: public traffic unavailable",
    "",
    `hints: ${track.hints}`,
    `AI mentor: ${track.aiMentor}`,
    "",
    "[SYSTEM]: terminal active",
  ];
}

function buildDemoStartLines(level) {
  if (level === "Novice" || level === "Junior") {
    return [
      "$ systemctl status nginx",
      "nginx.service - failed",
      "bind() to 0.0.0.0:80 failed",
      "",
      "What should you check next?",
    ];
  }

  if (level === "Mid") {
    return [
      "objective loaded: permission-denied",
      "A service dependency is failing after deploy.",
      `Try "${getOnboardingTrack(level).commands[0]}".`,
    ];
  }

  if (level === "Senior") {
    return [
      "objective loaded: memory-leak",
      "The app is flapping under pressure.",
      `Try "${getOnboardingTrack(level).commands[0]}".`,
    ];
  }

  return [
    "objective loaded: real-server",
    "No hints. No AI. Full pressure.",
    `Try "${getOnboardingTrack(level).commands[0]}".`,
  ];
}

function buildResolvedLines(level) {
  if (level === "Mid") {
    return [
      "",
      "INCIDENT RESOLVED",
      "public traffic restored",
      "lesson: production debugging starts with isolating the failing permission boundary fast.",
    ];
  }

  if (level === "Senior") {
    return [
      "",
      "INCIDENT RESOLVED",
      "public traffic restored",
      "lesson: on-call recovery means stabilizing the runtime before chasing every symptom.",
    ];
  }

  if (level === "SRE") {
    return [
      "",
      "INCIDENT RESOLVED",
      "public traffic restored",
      "lesson: pressure-mode recovery is about isolating blast radius before the next cascade.",
    ];
  }

  return [
    "",
    "INCIDENT RESOLVED",
    "public traffic restored",
    "lesson: nginx failed because another process was already bound to port 80.",
  ];
}

function levelSpecificResponse(level, step) {
  if (level === "Mid") {
    return step === 0
      ? [
          "myapp.service - failed (Result: exit-code)",
          "Permission denied while opening /var/run/myapp.sock",
        ]
      : [
          "warning: service could not bind privileged socket",
          "[recovery] You isolated the permission boundary failure.",
        ];
  }

  if (level === "Senior") {
    return step === 0
      ? [
          "myapp.service - activating (auto-restart)",
          "Main PID: 2284 (code=exited, status=1/FAILURE)",
        ]
      : [
          "warning: heap usage spiked above restart threshold",
          "[recovery] You isolated the unstable production service.",
        ];
  }

  return step === 0
    ? [
        "myapp-6d4f9b-xk2p9   0/1   CrashLoopBackOff",
        "postgres-8b4d7c-p9lm1   1/1   Running",
      ]
    : [
        "Warning: Back-off restarting failed container",
        "[recovery] You isolated the SRE pressure-path failure.",
      ];
}

function normalizeCommand(command) {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function lineClassName(line) {
  if (!line) return "h-3";
  if (/\[recovery\]|INCIDENT RESOLVED|public traffic restored|connected to prod-eu-west-1/i.test(line)) return "text-emerald-400";
  if (/warning|What should you check next|hints:|AI mentor:|Type "start"|status: degraded/i.test(line)) return "text-amber-300";
  if (/failed|failing|impacted|bind\(\)|crashloopbackoff|error|permission denied/i.test(line)) return "text-red-400";
  if (/^\[SYSTEM\]|^operator:|^incident:|^impact:/i.test(line)) return "text-zinc-400";
  if (/^\$ /i.test(line) || /^winlab@prod-server:~\$/.test(line)) return "text-zinc-200";
  return "text-zinc-300";
}

function renderTerminalLine(line) {
  if (!line) return <span>&nbsp;</span>;

  if (line === "winlab@prod-server:~$ _") {
    return (
      <span>
        winlab@prod-server:~$ <span className="inline-block animate-pulse">_</span>
      </span>
    );
  }

  return line;
}
