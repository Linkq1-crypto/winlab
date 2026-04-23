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
  const [lines, setLines] = useState(() => buildWaitingLines());
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("waiting_level");
  const [resolved, setResolved] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (!track) {
      setLines(buildWaitingLines());
      setInput("");
      setPhase("waiting_level");
      setResolved(false);
      return;
    }

    setLines(buildTrackLines(track));
    setInput("");
    setPhase("awaiting_start");
    setResolved(false);
  }, [track]);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [lines]);

  const helperText = useMemo(() => {
    if (!track) return "Choose your level in the hero terminal first.";
    if (phase === "awaiting_start") return 'Type "start" to begin the demo.';
    if (phase === "awaiting_check") return `Try "${NEXT_CHECK_COMMANDS[0]}"`;
    if (phase === "awaiting_fix") return `Try "${NOVICE_FIX_COMMANDS[0]}"`;
    if (resolved) return "Create a free account to unlock the full track.";
    return `Try "${track.commands[0]}"`;
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

    if (phase === "awaiting_start") {
      if (normalizeCommand(command) !== "start") {
        appendLines(['[hint] Type "start" to begin the demo.']);
        setInput("");
        return;
      }

      appendLines(buildDemoStartLines(track.level));
      setPhase(track.level === "Novice" || track.level === "Junior" ? "awaiting_check" : "awaiting_resolution");
      setInput("");
      return;
    }

    if (phase === "awaiting_check") {
      if (NEXT_CHECK_COMMANDS.some((candidate) => normalizeCommand(candidate) === normalizeCommand(command))) {
        appendLines([
          'LISTEN 0.0.0.0:80 users:(("apache2",pid=2041))',
          "What should you fix next?",
        ]);
        setPhase("awaiting_fix");
      } else {
        appendLines(['[hint] Check what is already bound to port 80.']);
      }
      setInput("");
      return;
    }

    if (phase === "awaiting_fix") {
      if (NOVICE_FIX_COMMANDS.some((candidate) => normalizeCommand(candidate) === normalizeCommand(command))) {
        appendLines(buildResolvedLines(track.level));
        setResolved(true);
        setPhase("resolved");
        onSmallWin?.(track.primaryLab?.slug || "nginx-port-conflict");
      } else {
        appendLines(['[hint] Stop the process that already owns port 80, then restart nginx.']);
      }
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
                  {track ? `active track: ${track.trackLabel}` : "waiting for operator level"}
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
                  {line || <span>&nbsp;</span>}
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
                        : track.commands.map((command) => (
                            <QuickCommand key={command} command={command} onRun={runCommand} />
                          ))}
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
        <h2 className="text-2xl font-semibold leading-tight">Awaiting selection</h2>
        <p className="mt-3 text-sm text-zinc-400">
          Choose a level in the hero terminal to build a personalized incident track.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Level Active</div>
      <h2 className="text-2xl font-semibold leading-tight">{track.level}</h2>
      <p className="mt-3 text-sm text-zinc-400">
        The terminal below is calibrated to this operator level before any real backend incident starts.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <StatusChip label="live" value={track.trackLabel} tone="success" />
        <StatusChip label="incident" value={track.primaryLab?.slug || "pending"} tone="warning" />
        <StatusChip label="hints" value={track.hints} tone="muted" />
        <StatusChip label="AI mentor" value={track.aiMentor} tone="muted" />
        <StatusChip label="status" value="degraded" tone="warning" />
      </div>
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-sm text-zinc-300">
        difficulty: <span className="text-white">{track.difficulty}</span>
      </div>
      <div className="mt-4 grid gap-3">
        {track.previewLabs.map((lab) => (
          <div key={lab.id} className="rounded-2xl border border-zinc-800 bg-black px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{lab.title}</div>
              <div className="rounded-full border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
                {lab.source}
              </div>
            </div>
            <div className="mt-2 text-xs text-zinc-400">{lab.slug}</div>
            <div className="mt-2 text-sm text-zinc-300">{lab.summary}</div>
          </div>
        ))}
        {track.metrics.map((metric) => (
          <div key={metric.label} className="text-sm text-zinc-500">
            {metric.label}: {metric.value}
          </div>
        ))}
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
        <FlowRow index="01" text="Choose your level in the live incident router." />
        <FlowRow index="02" text="Review the personalized track built from the real catalog." />
        <FlowRow index="03" text="Type start, resolve a short incident, and get a small win." />
        <FlowRow index="04" text="Sign up only after value, then start the real incident." />
      </div>
    </div>
  );
}

function GateCard({ completed, loading, error, onCreateAccount, onContinueGuest }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Continue</div>
      <h2 className="text-2xl font-semibold leading-tight">
        {completed ? "Nice work." : "Get a quick win first."}
      </h2>
      <p className="mt-3 text-sm text-zinc-400">
        {completed
          ? "You just resolved your first production incident. Create a free account to save progress and unlock your full track."
          : "The system will offer signup only after you resolve the onboarding incident."}
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

function buildWaitingLines() {
  return [
    'Select a level in the hero terminal to build your first incident track.',
  ];
}

function buildTrackLines(track) {
  const lines = [
    "WINLAB INCIDENT ROUTER v1.0",
    "region: prod-eu-west-1",
    "status: degraded",
    "",
    "level set: " + track.level,
    "calibrating difficulty...",
    "loading incident catalog...",
    "building your incident track...",
    "",
    `track: ${track.trackLabel}`,
    `hints: ${track.hints}`,
    `AI mentor: ${track.aiMentor}`,
  ];

  track.metrics.forEach((metric) => {
    lines.push(`${metric.label}: ${metric.value}`);
  });

  lines.push("");
  track.previewLabs.forEach((lab) => {
    lines.push(`- ${lab.slug}`);
  });
  lines.push("");
  lines.push("first recommended incident:");
  lines.push(track.primaryLab?.title || "Incident pending");
  lines.push("");
  lines.push("objective:");
  lines.push("restore public traffic before the incident escalates.");
  lines.push("");
  lines.push('Type "start" to begin the demo.');
  return lines;
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
  if (/resolved|public traffic restored/i.test(line)) return "text-emerald-400";
  if (/status: degraded|warning|what should you check next|track:|hints:|AI mentor:|objective:/i.test(line)) return "text-amber-300";
  if (/failed|failing|impacted|bind\(\)|crashloopbackoff|error|permission denied/i.test(line)) return "text-red-400";
  if (/^\[12:|^WINLAB INCIDENT ROUTER|^region:|^level set:|^calibrating|^loading|^building|^first recommended incident|^Type "start"|^Select a level/i.test(line)) return "text-zinc-400";
  if (/^\$ /i.test(line)) return "text-zinc-200";
  return "text-zinc-300";
}
