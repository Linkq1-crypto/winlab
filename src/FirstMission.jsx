// FirstMission.jsx - Immediate real incident experience after Stripe payment
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "./services/posthog";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MISSION_SCRIPT = [
  {
    type: "briefing",
    title: "🚨 INCIDENT #001 — LDAP AUTH FAILURE",
    description:
      "Users cannot login to the production server. The LDAP authentication service is failing. Investigate and fix the issue.",
  },
  {
    type: "terminal",
    lines: [
      { text: "winlab@prod-server:~$", delay: 500 },
      { text: "> systemctl status ldap", delay: 1200 },
      {
        text: "● ldap.service - LDAP Authentication Service\n   Loaded: loaded (/lib/systemd/system/ldap.service)\n   Active: ❌ failed (Result: exit-code)\n   Main PID: 1847 (code=exited, status=1/FAILURE)",
        delay: 2400,
        color: "text-red-400",
      },
      { text: "", delay: 2600 },
      { text: "winlab@prod-server:~$", delay: 2800 },
    ],
  },
  {
    type: "ai_hint",
    text: "🤖 AI Mentor: The LDAP service is down. Check the logs to understand why it failed. Try `journalctl -u ldap` to see recent errors.",
  },
  {
    type: "terminal",
    lines: [
      { text: "> journalctl -u ldap --no-pager -n 10", delay: 800 },
      {
        text: "Apr 15 14:23:01 prod-server slapd[1847]: bind DN configuration error\nApr 15 14:23:01 prod-server slapd[1847]: ❌ authentication failed for CN=admin,DC=winlab,DC=cloud\nApr 15 14:23:02 prod-server slapd[1847]: additional info: invalid DN",
        delay: 2000,
        color: "text-orange-400",
      },
    ],
  },
  {
    type: "ai_hint",
    text: "💡 Good work checking the logs. The error says 'invalid DN'. The bind DN format in the config file is wrong. Can you find where it's configured?",
  },
  {
    type: "terminal",
    lines: [
      { text: "> cat /etc/ldap/ldap.conf | grep -i bind", delay: 1000 },
      {
        text: "BIND_DN CN=Administrator,CN=Users,DC=winlab,DC=cloud\n# Expected: BIND_DN CN=Administrator,DC=winlab,DC=cloud",
        delay: 1800,
        color: "text-yellow-300",
      },
    ],
  },
  {
    type: "challenge",
    text: "The config has 'CN=Users' in the DN but it shouldn't. How would you fix this?",
    options: [
      {
        text: "Remove CN=Users from the DN",
        correct: true,
        response: "✅ Correct! The DN should be: CN=Administrator,DC=winlab,DC=cloud",
      },
      {
        text: "Change the password",
        correct: false,
        response: "❌ The password is fine — the DN format is the issue.",
      },
      {
        text: "Restart the server",
        correct: false,
        response: "❌ Restarting won't fix a configuration error. Check the DN format.",
      },
    ],
  },
  {
    type: "terminal",
    lines: [
      { text: "> sed -i 's/CN=Users,//' /etc/ldap/ldap.conf", delay: 600 },
      { text: "> systemctl restart ldap", delay: 1400 },
      {
        text: "✅ LDAP service started successfully\n✅ Authentication restored — users can login again",
        delay: 2600,
        color: "text-green-300 font-semibold",
      },
    ],
  },
  {
    type: "success",
    title: "🎉 Incident Resolved!",
    description:
      "You just fixed your first real production incident. The LDAP bind DN had an extra 'CN=Users' component that was causing authentication failures.",
    stats: {
      timeSpent: "~3 minutes",
      commandsRun: 4,
      hintsUsed: 2,
    },
  },
];

export default function FirstMission() {
  const [currentStep, setCurrentStep] = useState(0);
  const [terminalLines, setTerminalLines] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showAiHint, setShowAiHint] = useState(false);

  useEffect(() => {
    trackEvent("first_mission_started", { mission_id: "001", type: "ldap_auth_failure" });

    // Auto-run initial briefing and terminal
    runStep(0);
  }, []);

  const runStep = async (stepIndex) => {
    const step = MISSION_SCRIPT[stepIndex];
    if (!step) return;

    if (step.type === "briefing") {
      setCurrentStep(stepIndex + 1);
      setTimeout(() => runStep(stepIndex + 1), 2000);
    } else if (step.type === "terminal") {
      setTerminalLines([]);
      for (let line of step.lines) {
        await sleep(line.delay - (step.lines.indexOf(line) > 0 ? step.lines[step.lines.indexOf(line) - 1].delay : 0));
        setTerminalLines((prev) => [...prev, line]);
      }
      setCurrentStep(stepIndex + 1);
      setTimeout(() => runStep(stepIndex + 1), 1000);
    } else if (step.type === "ai_hint") {
      setShowAiHint(true);
      setCurrentStep(stepIndex + 1);
      trackEvent("ai_hint_seen", { mission_id: "001", step: stepIndex });
    } else if (step.type === "challenge") {
      setSelectedAnswer(null);
      setCurrentStep(stepIndex + 1);
    } else if (step.type === "success") {
      trackEvent("first_mission_completed", { mission_id: "001" });
    }
  };

  const handleAnswer = (optionIndex, isCorrect) => {
    setSelectedAnswer({ index: optionIndex, correct: isCorrect });
    trackEvent("mission_answer", {
      mission_id: "001",
      correct: isCorrect,
      answer_index: optionIndex,
    });

    if (isCorrect) {
      setTimeout(() => {
        runStep(currentStep + 1);
      }, 2000);
    }
  };

  const currentMissionStep = MISSION_SCRIPT[currentStep];

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Mission header */}
        {currentMissionStep?.type === "briefing" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 border-2 border-red-500/30 bg-red-500/5 rounded-xl"
          >
            <h1 className="text-xl md:text-2xl font-bold text-red-400 mb-3">
              {currentMissionStep.title}
            </h1>
            <p className="text-slate-300 leading-relaxed">{currentMissionStep.description}</p>
          </motion.div>
        )}

        {/* Terminal */}
        {(currentMissionStep?.type === "terminal" || terminalLines.length > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 bg-[#050505] border border-green-500/30 rounded-xl overflow-hidden"
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-green-500/20 bg-[#050505]">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-green-400/60">winlab@prod-server:~</span>
            </div>

            {/* Terminal body */}
            <div className="p-5 min-h-[280px]">
              <AnimatePresence>
                {terminalLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`mb-1 ${line.color || "text-green-400"}`}
                  >
                    {line.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Blinking cursor */}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="inline-block w-2 h-4 bg-green-400 ml-1 align-middle"
              />
            </div>
          </motion.div>
        )}

        {/* AI Mentor hint */}
        {showAiHint && currentMissionStep?.type !== "ai_hint" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
          >
            <p className="text-sm text-blue-300">{MISSION_SCRIPT.find((s) => s.type === "ai_hint")?.text}</p>
          </motion.div>
        )}

        {/* Challenge question */}
        {currentMissionStep?.type === "challenge" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-6 border border-yellow-500/30 bg-yellow-500/5 rounded-xl"
          >
            <h3 className="text-lg font-bold text-yellow-400 mb-4">{currentMissionStep.text}</h3>
            <div className="space-y-3">
              {currentMissionStep.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i, option.correct)}
                  disabled={selectedAnswer !== null}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedAnswer?.index === i
                      ? option.correct
                        ? "bg-green-500/20 border-green-500 text-green-300"
                        : "bg-red-500/20 border-red-500 text-red-300"
                      : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600"
                  } disabled:cursor-not-allowed`}
                >
                  {option.text}
                  {selectedAnswer?.index === i && (
                    <span className="ml-2 font-semibold">{option.correct ? "✓" : "✗"}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Answer feedback */}
            {selectedAnswer && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mt-4 p-3 rounded-lg ${
                  selectedAnswer.correct
                    ? "bg-green-500/10 text-green-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {currentMissionStep.options[selectedAnswer.index].response}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Success screen */}
        {currentMissionStep?.type === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 border-2 border-green-500/30 bg-green-500/5 rounded-xl text-center"
          >
            <span className="text-5xl mb-4 block">🎉</span>
            <h2 className="text-2xl font-bold text-green-400 mb-3">
              {currentMissionStep.title}
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              {currentMissionStep.description}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {currentMissionStep.stats.timeSpent}
                </p>
                <p className="text-xs text-slate-400">Time</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {currentMissionStep.stats.commandsRun}
                </p>
                <p className="text-xs text-slate-400">Commands</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {currentMissionStep.stats.hintsUsed}
                </p>
                <p className="text-xs text-slate-400">Hints</p>
              </div>
            </div>

            {/* Next steps */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all"
              >
                Go to Dashboard →
              </button>
              <button
                onClick={() => (window.location.href = "/lab/real-server")}
                className="px-6 py-3 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 font-semibold rounded-lg transition-all"
              >
                Next Incident →
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
