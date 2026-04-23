import React, { useEffect, useMemo, useRef, useState } from "react";

const DEMO_COMMANDS = [
  "systemctl status nginx",
  "journalctl -u nginx -n 20 --no-pager",
];

export default function LandingTerminalDemo({
  onSmallWin,
  gateLoading = false,
  gateError = "",
  onContinue,
}) {
  const [lines, setLines] = useState(() => initialLines());
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const terminalRef = useRef(null);
  const commandInputRef = useRef(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
  }, [lines]);

  const helperText = useMemo(() => {
    if (completed) return 'You found the failure signal. Sign in to continue.';
    if (step === 0) return 'Try "systemctl status nginx"';
    return 'Now inspect the logs with "journalctl -u nginx -n 20 --no-pager"';
  }, [completed, step]);

  function focusInput() {
    commandInputRef.current?.focus();
  }

  function runCommand(rawCommand) {
    const command = rawCommand.trim();
    if (!command) return;

    setLines((prev) => [...prev, `$ ${command}`]);

    if (step === 0 && normalizeCommand(command) === DEMO_COMMANDS[0]) {
      setLines((prev) => [
        ...prev,
        "nginx.service - failed (Result: exit-code)",
        "Main PID: 1823 (code=exited, status=1/FAILURE)",
        "[hint] The service is down. Pull the recent logs.",
      ]);
      setStep(1);
      setInput("");
      return;
    }

    if (step === 1 && normalizeCommand(command) === DEMO_COMMANDS[1]) {
      setLines((prev) => [
        ...prev,
        "warning: upstream timeout threshold exceeded",
        "bind() to 0.0.0.0:80 failed",
        "[recovery] Nice. You isolated the failure signal.",
      ]);
      setCompleted(true);
      setStep(2);
      setInput("");
      onSmallWin?.();
      return;
    }

    setLines((prev) => [
      ...prev,
      '[hint] Stay on the golden path. Start with "systemctl status nginx".',
    ]);
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
                <div className="text-sm text-zinc-400">interactive terminal demo</div>
                <div className="text-xs text-zinc-600">dopamine first - no login required</div>
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
              className="min-h-[420px] bg-black p-4 font-mono text-sm leading-7"
            >
              {lines.map((line, index) => (
                <div key={`${index}-${line}`} className={lineClassName(line)}>
                  {line}
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="mb-3 flex flex-wrap gap-2">
                {DEMO_COMMANDS.map((command) => (
                  <button
                    key={command}
                    type="button"
                    onClick={() => runCommand(command)}
                    className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white"
                  >
                    {command}
                  </button>
                ))}
              </div>

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
            <HowItWorksCard />
            <GateCard
              completed={completed}
              loading={gateLoading}
              error={gateError}
              onContinue={onContinue}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksCard() {
  return (
    <div id="how-it-works" className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">How it works</div>
      <div className="grid gap-3">
        <FlowRow index="01" text="Land on a broken production-style incident." />
        <FlowRow index="02" text="Use one or two commands to get a small win." />
        <FlowRow index="03" text="Sign in only when you want the full incident." />
        <FlowRow index="04" text="Hit the real terminal, then pay only after value is clear." />
      </div>
    </div>
  );
}

function GateCard({ completed, loading, error, onContinue }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Continue</div>
      <h2 className="text-2xl font-semibold leading-tight">
        {completed ? "Nice. Want to try the full incident?" : "Get a quick win first."}
      </h2>
      <p className="mt-3 text-sm text-zinc-400">
        {completed
          ? "Sign in to continue."
          : "You do not need login to feel the product. Use the demo terminal, then unlock the full run."}
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={!completed || loading}
        className="mt-6 rounded-2xl bg-white px-5 py-3 text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting incident..." : "Sign in to continue"}
      </button>

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

function initialLines() {
  return [
    "prod-eu-west-1 - live incident",
    `[12:04:11] requests failing ${"\u2191"}`,
    "[12:04:13] nginx healthcheck failed",
    "[12:04:17] customer traffic impacted",
    "",
    '[hint] Start with "systemctl status nginx".',
  ];
}

function normalizeCommand(command) {
  return command.trim().replace(/\s+/g, " ").toLowerCase();
}

function lineClassName(line) {
  if (!line) return "h-3";
  if (/requests failing|failed|impacted|bind\(\)/i.test(line)) return "text-red-400";
  if (/\[hint\]/i.test(line)) return "text-cyan-400";
  if (/\[recovery\]/i.test(line)) return "text-emerald-400";
  if (/^\$ /i.test(line)) return "text-zinc-200";
  return "text-zinc-400";
}
