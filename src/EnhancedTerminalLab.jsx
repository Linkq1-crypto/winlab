// EnhancedTerminalLab.jsx – AI-powered terminal with invisible guide, adaptive difficulty & analytics
import { useState, useEffect, useRef, useCallback } from "react";
import { getAdaptiveLoader } from "./network/adaptiveLoader";
import { getInvisibleGuide } from "./network/invisibleGuide";
import { getAnalytics, getOptimizedPaywall } from "./network/analyticsEngine";

// ── Region detection (IP-based, fallback to browser) ──────────────────────────
async function detectRegion() {
  try {
    const res = await fetch("https://ipapi.co/json", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (["IN", "BD", "LK", "NP", "PK"].includes(data.country_code)) return "IN";
    if (["NG", "KE", "ZA", "GH", "EG", "ET", "TZ", "UG", "SD", "CD"].includes(data.country_code)) return "AF";
    return "GLOBAL";
  } catch {
    const lang = (navigator.language || "en").toLowerCase();
    if (lang.includes("hi") || lang.includes("in")) return "IN";
    if (lang.includes("sw") || lang.includes("yo") || lang.includes("am")) return "AF";
    return "GLOBAL";
  }
}

// ── Realistic error messages ─────────────────────────────────────────────────
const REAL_ERRORS = {
  systemctl: "Failed to connect to bus: No such file or directory",
  service: "Unit {svc} not found.",
  permission: "Permission denied (you must be root)",
  connection: "Connection refused on port 80",
  timeout: "Operation timed out after 5000ms",
  notfound: "Command not found: {cmd}",
  network: "Network is unreachable",
  auth: "Authentication failed – check credentials",
};

// ── AI Mentor hint database (intelligent, context-aware) ─────────────────────
const AI_HINTS = {
  "lab-1-webdown": {
    level1: "💡 AI Mentor: The web server is down. What service manages Apache?",
    level2: "💡 AI Mentor: Try checking the service status first → systemctl status httpd",
    level3: "💡 AI Mentor: Once you confirm it's down, start it → systemctl start httpd",
    solution: "Run: systemctl status httpd → systemctl start httpd",
  },
  "lab-2-diskfull": {
    level1: "💡 AI Mentor: When servers run out of space, check disk usage first.",
    level2: "💡 AI Mentor: Use 'df -h' to see which partition is full.",
    level3: "💡 AI Mentor: Journal logs can consume massive space. Vacuum them → journalctl --vacuum-size=100M",
    solution: "Run: df -h → journalctl --vacuum-size=100M",
  },
  "lab-3-security": {
    level1: "💡 AI Mentor: A secure server needs an active firewall. Check firewalld status.",
    level2: "💡 AI Mentor: Try → systemctl status firewalld",
    level3: "💡 AI Mentor: Enable the firewall → systemctl start firewalld",
    solution: "Run: systemctl status firewalld → systemctl start firewalld",
  },
};

// ── Adaptive difficulty engine ───────────────────────────────────────────────
const DIFFICULTY_LEVELS = {
  easy: {
    hintDelay: 5000,
    hintCount: 3,
    latency: 600,
    showErrorHints: true,
    showCommandHints: true,
  },
  medium: {
    hintDelay: 10000,
    hintCount: 2,
    latency: 800,
    showErrorHints: true,
    showCommandHints: false,
  },
  hard: {
    hintDelay: 15000,
    hintCount: 1,
    latency: 1000,
    showErrorHints: false,
    showCommandHints: false,
  },
  expert: {
    hintDelay: 30000,
    hintCount: 0,
    latency: 1200,
    showErrorHints: false,
    showCommandHints: false,
  },
};

// ── Lab scenarios with adaptive difficulty ───────────────────────────────────
const LABS = [
  {
    id: "lab-1-webdown",
    title: "Lab 1 of 3: Apache is Down",
    baseDifficulty: "easy",
    hint: "Try: systemctl status httpd",
    successCmds: ["systemctl status httpd", "systemctl start httpd"],
    successMessages: [
      "🎉 Server fixed!",
      "+1 Real Skill Unlocked: Linux Service Management",
      "You just solved a real production incident.",
    ],
    nextLab: "lab-2-diskfull",
    paywallText: "🔥 Next: Advanced Debugging (Pro) — Unlock the full lab series →",
  },
  {
    id: "lab-2-diskfull",
    title: "Lab 2 of 3: Disk Full Crisis",
    baseDifficulty: "medium",
    hint: "Try: df -h to check disk usage",
    successCmds: ["df -h", "journalctl --vacuum-size=100M"],
    successMessages: [
      "🎉 Disk space recovered!",
      "+1 Real Skill Unlocked: Storage Management",
      "Production servers depend on this skill daily.",
    ],
    nextLab: "lab-3-security",
    paywallText: "🔥 Next: Security Audit Mastery (Business) — Get unlimited labs →",
  },
  {
    id: "lab-3-security",
    title: "Lab 3 of 3: Security Misconfiguration",
    baseDifficulty: "hard",
    hint: "Try: systemctl status firewalld",
    successCmds: ["systemctl status firewalld", "systemctl start firewalld"],
    successMessages: [
      "🎉 Security hardened!",
      "+1 Real Skill Unlocked: Security Configuration",
      "Enterprise-grade skills unlocked.",
    ],
    nextLab: null,
    paywallText: "🏆 All labs completed! Upgrade for advanced scenarios →",
  },
];

// ── Terminal Component ───────────────────────────────────────────────────────
export default function EnhancedTerminalLab({ labId = "lab-1-webdown", plan = "starter", onUpgrade = () => {} }) {
  const analytics = getAnalytics();
  const [region, setRegion] = useState("GLOBAL");
  const [currentLabIndex, setCurrentLabIndex] = useState(0);
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [labCompleted, setLabCompleted] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [skillUnlocked, setSkillUnlocked] = useState(null);
  const [latency, setLatency] = useState(800);
  const [difficulty, setDifficulty] = useState("easy");
  const [hintLevel, setHintLevel] = useState(0);
  const [aiMentorOpen, setAiMentorOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiNudge, setShowAiNudge] = useState(false);
  const [commandCount, setCommandCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [labStartTime] = useState(Date.now());
  const [adaptiveMode, setAdaptiveMode] = useState(true);
  const [networkProfile, setNetworkProfile] = useState("standard");
  const [invisibleHint, setInvisibleHint] = useState(null);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const aiInputRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const hintTimerRef = useRef(null);

  const currentLab = LABS[currentLabIndex] || LABS[0];
  const diffSettings = DIFFICULTY_LEVELS[difficulty];

  // ── Init: region detection + boot sequence + analytics + invisible guide ───
  useEffect(() => {
    detectRegion().then((detectedRegion) => {
      setRegion(detectedRegion);
      analytics.conversionData.region = detectedRegion;
    });

    // Track lab start
    analytics.track("lab_start", { labId: currentLab.id, region });

    // Start adaptive network loader
    const loader = getAdaptiveLoader();
    loader.start().then((profile) => {
      setNetworkProfile(profile);
    });
    const unsub = loader.subscribe(({ profile }) => {
      setNetworkProfile(profile);
      // Adjust latency based on network profile
      const profileLatency = { minimal: 1500, standard: 800, full: 600 };
      setLatency(profileLatency[profile] || 800);
    });

    // Start invisible guide
    const guide = getInvisibleGuide();
    guide.start(currentLab.id, ({ hint, type }) => {
      setInvisibleHint({ text: hint, type });
      analytics.track("invisible_hint_shown", { labId: currentLab.id, type, hint });
      // Auto-clear hint after 5 seconds
      setTimeout(() => setInvisibleHint(null), 5000);
    });

    // Start idle detection for invisible guide
    const idleCheck = setInterval(() => {
      guide.showIdleHint();
    }, 5000);

    const bootLines = [
      { text: "Connecting to lab server...", type: "info", delay: 0 },
      { text: "Establishing SSH session...", type: "info", delay: 600 },
      { text: "Connected to oracle-linux-8.lab.local", type: "success", delay: 1400 },
      { text: "", type: "out", delay: 1600 },
      { text: `⚠️  ${currentLab.title}`, type: "warn", delay: 2000 },
      { text: "Your server has a critical issue.", type: "err", delay: 2600 },
      { text: "Fix it to unlock the next skill.", type: "info", delay: 3200 },
      { text: "", type: "out", delay: 3400 },
      { text: "🤖 AI Mentor available (type 'ai' or click 💡 for hints)", type: "hint", delay: 3800 },
    ];

    // Staggered boot lines with simulated latency
    bootLines.forEach(({ text, type, delay }) => {
      setTimeout(() => {
        setLines(prev => [...prev, { text, type }]);
      }, delay);
    });

    // Adaptive hint timer
    if (diffSettings.hintDelay > 0) {
      hintTimerRef.current = setTimeout(() => {
        if (commandCount === 0 && !labCompleted) {
          showAiHint(1);
        }
      }, diffSettings.hintDelay);
    }

    // AI nudge after inactivity
    resetInactivityTimer();

    return () => {
      clearTimeout(hintTimerRef.current);
      clearTimeout(inactivityTimerRef.current);
      clearInterval(idleCheck);
      unsub();
      guide.stop();
    };
  }, [currentLabIndex]);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, aiMessages]);

  // ── Adaptive difficulty engine ─────────────────────────────────────────────
  useEffect(() => {
    if (!adaptiveMode) return;

    // Adjust difficulty based on user performance
    if (commandCount > 0 && commandCount % 5 === 0) {
      if (errorCount === 0 && commandCount <= 10) {
        // User is doing well - increase difficulty
        const difficulties = ["easy", "medium", "hard", "expert"];
        const currentIndex = difficulties.indexOf(difficulty);
        if (currentIndex < difficulties.length - 1) {
          const newDifficulty = difficulties[currentIndex + 1];
          setDifficulty(newDifficulty);
          setLatency(DIFFICULTY_LEVELS[newDifficulty].latency);
          addLine(`📊 Difficulty adjusted to: ${newDifficulty.toUpperCase()}`, "info");
        }
      } else if (errorCount > 3 && commandCount <= 10) {
        // User struggling - decrease difficulty
        const difficulties = ["easy", "medium", "hard", "expert"];
        const currentIndex = difficulties.indexOf(difficulty);
        if (currentIndex > 0) {
          const newDifficulty = difficulties[currentIndex - 1];
          setDifficulty(newDifficulty);
          setLatency(DIFFICULTY_LEVELS[newDifficulty].latency);
          addLine(`📊 Difficulty adjusted to: ${newDifficulty.toUpperCase()}`, "info");
        }
      }
    }
  }, [commandCount, errorCount, adaptiveMode]);

  // ── Helper functions ───────────────────────────────────────────────────────
  const addLine = useCallback((text, type = "out") => {
    setLines(prev => [...prev, { text, type }]);
  }, []);

  const showAiHint = useCallback((level) => {
    if (level > diffSettings.hintCount) return;

    const hints = AI_HINTS[currentLab.id];
    if (!hints) return;

    const hintKey = `level${level}`;
    if (hints[hintKey]) {
      addLine(hints[hintKey], "hint");
      analytics.track("hint_shown", { labId: currentLab.id, level });
    }
  }, [currentLab.id, diffSettings, addLine]);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      if (!aiMentorOpen) {
        setShowAiNudge(true);
      }
    }, 15000);
  }, [aiMentorOpen]);

  // ── Focus input on click ───────────────────────────────────────────────────
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // ── AI Mentor logic ────────────────────────────────────────────────────────
  const processAiQuestion = useCallback((question) => {
    const q = question.toLowerCase();
    let response = "";

    // Context-aware AI responses
    if (q.includes("help") || q.includes("stuck")) {
      const hints = AI_HINTS[currentLab.id];
      response = hints ? `AI Mentor: ${hints.solution}` : "Try exploring systemctl commands.";
    } else if (q.includes("systemctl")) {
      response = "AI Mentor: systemctl manages system services. Try 'systemctl status <service>' to check status, or 'systemctl start <service>' to start it.";
    } else if (q.includes("disk") || q.includes("space") || q.includes("full")) {
      response = "AI Mentor: Use 'df -h' to check disk usage. If logs are consuming too much space, try 'journalctl --vacuum-size=100M' to free up space.";
    } else if (q.includes("firewall") || q.includes("security") || q.includes("firewalld")) {
      response = "AI Mentor: Firewalld is the firewall service. Check it with 'systemctl status firewalld' and enable with 'systemctl start firewalld'.";
    } else if (q.includes("apache") || q.includes("httpd") || q.includes("web")) {
      response = "AI Mentor: Apache runs as 'httpd' service. Check status: 'systemctl status httpd'. Start it: 'systemctl start httpd'.";
    } else if (q.includes("hint")) {
      const hints = AI_HINTS[currentLab.id];
      const nextHint = hintLevel + 1;
      if (hints && hints[`level${nextHint}`]) {
        setHintLevel(nextHint);
        response = hints[`level${nextHint}`];
      } else {
        response = "AI Mentor: You've used all available hints for this lab. Try exploring commands!";
      }
    } else {
      // Generic helpful response
      response = `AI Mentor: Good question! For this lab, focus on diagnosing the issue with status checks first, then apply the fix. Type 'hint' for guided help.`;
    }

    return response;
  }, [currentLab.id, hintLevel]);

  // ── Command processing with AI mentor integration ──────────────────────────
  const processCommand = useCallback((cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    resetInactivityTimer();
    setCommandCount(prev => prev + 1);

    // Record command in invisible guide
    const guide = getInvisibleGuide();

    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // ── AI Mentor command ────────────────────────────────────────────────
    if (command === "ai" || command === "mentor" || command === "hint") {
      const rest = trimmed.split(" ").slice(1).join(" ");
      if (!rest) {
        const hints = AI_HINTS[currentLab.id];
        if (hints) {
          setHintLevel(prev => prev + 1);
          const nextHint = hints[`level${hintLevel + 1}`] || hints.solution;
          addLine(nextHint, "hint");
          analytics.track("hint_use", { labId: currentLab.id, type: "ai" });
        }
        return;
      } else {
        // Process AI question
        const response = processAiQuestion(rest);
        addLine(response, "hint");
        setAiMessages(prev => [...prev, { role: "user", text: trimmed }]);
        setAiMessages(prev => [...prev, { role: "ai", text: response }]);
        return;
      }
    }

    // ── Simulated latency (adaptive) ─────────────────────────────────────
    setIsProcessing(true);

    setTimeout(() => {
      let responseLines = [];
      let commandSuccess = false;

      // ── systemctl ─────────────────────────────────────────────────────
      if (command === "systemctl") {
        const subcmd = args[0];
        const service = args[1]?.replace(/\.service$/, "");

        if (subcmd === "status") {
          if (!service) {
            responseLines = [{ text: REAL_ERRORS.systemctl, type: "err" }];
            setErrorCount(prev => prev + 1);
          } else if (service === "httpd" && currentLabIndex === 0) {
            responseLines = [
              { text: "● httpd.service - The Apache HTTP Server", type: "out" },
              { text: "   Loaded: loaded (/usr/lib/systemd/system/httpd.service; enabled)", type: "out" },
              { text: "   Active: inactive (dead) since " + new Date().toLocaleString(), type: "err" },
              { text: "  Process: 3412 ExecStart=/usr/sbin/httpd (code=exited, status=1/FAILURE)", type: "err" },
              { text: "", type: "out" },
              { text: "⚠️  Service is DOWN — Start it with: systemctl start httpd", type: "warn" },
            ];
            if (diffSettings.showErrorHints) {
              responseLines.push({ text: "💡 Use 'systemctl start httpd' to fix this.", type: "hint" });
            }
          } else if (service === "firewalld" && currentLabIndex === 2) {
            responseLines = [
              { text: "● firewalld.service - firewalld - dynamic firewall daemon", type: "out" },
              { text: "   Loaded: loaded (/usr/lib/systemd/system/firewalld.service; disabled)", type: "out" },
              { text: "   Active: inactive (dead)", type: "err" },
              { text: "", type: "out" },
              { text: "⚠️  Firewall is DISABLED — Security risk! Enable with: systemctl start firewalld", type: "warn" },
            ];
          } else {
            responseLines = [
              { text: `● ${service}.service`, type: "out" },
              { text: `   Active: active (running) since ${new Date().toLocaleString()}`, type: "success" },
            ];
            commandSuccess = true;
          }
        } else if (subcmd === "start" || subcmd === "restart") {
          if (service === "httpd" && currentLabIndex === 0) {
            // SUCCESS: Lab 1 complete
            const timeToComplete = Date.now() - labStartTime;
            setLabCompleted(true);
            setSkillUnlocked("Linux Service Management");
            responseLines = [
              { text: "Starting httpd.service...", type: "info" },
              { text: "Started httpd.service - The Apache HTTP Server", type: "success" },
              { text: "", type: "out" },
              { text: "🎉 Server fixed!", type: "success" },
              { text: "+1 Real Skill Unlocked: Linux Service Management", type: "success" },
              { text: `⏱️  Time to complete: ${(timeToComplete / 1000).toFixed(1)}s`, type: "info" },
              { text: "You just solved a real production incident.", type: "success" },
            ];
            // Invisible guide reward
            getInvisibleGuide().showReward();
            analytics.track("lab_complete", {
              labId: currentLab.id,
              difficulty,
              timeMs: timeToComplete,
              commands: commandCount,
              errors: errorCount,
            });
            setTimeout(() => setShowPaywall(true), 2000);
          } else if (service === "firewalld" && currentLabIndex === 2) {
            // SUCCESS: Lab 3 complete
            const timeToComplete = Date.now() - labStartTime;
            setLabCompleted(true);
            setSkillUnlocked("Security Configuration");
            responseLines = [
              { text: "Starting firewalld.service...", type: "info" },
              { text: "Started firewalld.service - dynamic firewall daemon", type: "success" },
              { text: "", type: "out" },
              { text: "🎉 Security hardened!", type: "success" },
              { text: "+1 Real Skill Unlocked: Security Configuration", type: "success" },
              { text: `⏱️  Time to complete: ${(timeToComplete / 1000).toFixed(1)}s`, type: "info" },
              { text: "Enterprise-grade skills unlocked.", type: "success" },
            ];
            analytics.track("lab_complete", {
              labId: currentLab.id,
              difficulty,
              timeMs: timeToComplete,
              commands: commandCount,
              errors: errorCount,
            });
            setTimeout(() => setShowPaywall(true), 2000);
          } else {
            responseLines = [
              { text: `Started ${service}.service`, type: "success" },
            ];
            commandSuccess = true;
          }
        } else if (subcmd === "stop") {
          responseLines = [{ text: `Stopped ${service || "unknown"}.service`, type: "out" }];
        } else if (subcmd === "list-units") {
          responseLines = [
            { text: "UNIT                   LOAD   ACTIVE   SUB", type: "out" },
            { text: "httpd.service          loaded active   running", type: "success" },
            { text: "sshd.service           loaded active   running", type: "success" },
            { text: "firewalld.service      loaded inactive dead", type: "err" },
            { text: "crond.service          loaded active   running", type: "success" },
          ];
        } else {
          responseLines = [{ text: `Unknown operation '${subcmd || ""}'.`, type: "err" }];
          setErrorCount(prev => prev + 1);
        }

      // ── df (disk free) ─────────────────────────────────────────────────
      } else if (command === "df") {
        if (currentLabIndex === 1) {
          responseLines = [
            { text: "Filesystem      Size  Used Avail Use% Mounted on", type: "out" },
            { text: "/dev/sda1        50G   50G     0 100% /", type: "err" },
            { text: "tmpfs           3.9G     0  3.9G   0% /tmp", type: "out" },
            { text: "", type: "out" },
            { text: "⚠️  Disk is FULL! Clean up with: journalctl --vacuum-size=100M", type: "warn" },
          ];
        } else {
          responseLines = [
            { text: "Filesystem      Size  Used Avail Use% Mounted on", type: "out" },
            { text: "/dev/sda1        50G   18G   32G  36% /", type: "success" },
            { text: "tmpfs           3.9G     0  3.9G   0% /tmp", type: "out" },
          ];
          commandSuccess = true;
        }
      } else if (command === "journalctl") {
        if (args.includes("--vacuum-size=100M") && currentLabIndex === 1) {
          const timeToComplete = Date.now() - labStartTime;
          setLabCompleted(true);
          setSkillUnlocked("Storage Management");
          responseLines = [
            { text: "Vacuuming journal files...", type: "info" },
            { text: "Freed 32G of disk space.", type: "success" },
            { text: "", type: "out" },
            { text: "🎉 Disk space recovered!", type: "success" },
            { text: "+1 Real Skill Unlocked: Storage Management", type: "success" },
            { text: `⏱️  Time to complete: ${(timeToComplete / 1000).toFixed(1)}s`, type: "info" },
            { text: "Production servers depend on this skill daily.", type: "success" },
          ];
          analytics.track("lab_complete", {
            labId: currentLab.id,
            difficulty,
            timeMs: timeToComplete,
            commands: commandCount,
            errors: errorCount,
          });
          setTimeout(() => setShowPaywall(true), 2000);
        } else {
          responseLines = [
            { text: "-- Logs begin at " + new Date().toLocaleString() + " --", type: "out" },
            { text: "Apr 12 10:23:01 server01 systemd[1]: Started Session 42.", type: "out" },
          ];
        }

      // ── whoami / id ────────────────────────────────────────────────────
      } else if (command === "whoami") {
        responseLines = [{ text: "root", type: "out" }];
      } else if (command === "id") {
        responseLines = [{ text: "uid=0(root) gid=0(root) groups=0(root)", type: "out" }];

      // ── help / clear ───────────────────────────────────────────────────
      } else if (command === "help") {
        responseLines = [
          { text: "Available commands:", type: "info" },
          { text: "  systemctl [status|start|stop] <service>", type: "out" },
          { text: "  df [-h]                    - Check disk space", type: "out" },
          { text: "  journalctl [--vacuum-size=N] - Manage logs", type: "out" },
          { text: "  whoami / id                - Check user", type: "out" },
          { text: "  clear                      - Clear terminal", type: "out" },
          { text: "  ai <question>              - Ask AI Mentor", type: "out" },
          { text: "  hint                       - Get AI hint", type: "out" },
        ];
      } else if (command === "clear") {
        setLines([]);
        setIsProcessing(false);
        return;
      } else if (command === "stats") {
        // Show analytics stats
        const conversionRate = analytics.getConversionRate();
        const avgTime = analytics.getAverageTimeToComplete();
        responseLines = [
          { text: "📊 Analytics Dashboard:", type: "info" },
          { text: `   Session ID: ${analytics.sessionId}`, type: "out" },
          { text: `   Conversion Rate: ${conversionRate.toFixed(1)}%`, type: "success" },
          { text: `   Lab Starts: ${analytics.conversionData.labStarts}`, type: "out" },
          { text: `   Lab Completions: ${analytics.conversionData.labCompletions}`, type: "out" },
          { text: `   Hints Used: ${analytics.conversionData.hintUses}`, type: "out" },
          { text: `   Avg Time to Complete: ${(avgTime / 1000).toFixed(1)}s`, type: "out" },
          { text: `   Upgrade Clicks: ${analytics.conversionData.upgradeClicks}`, type: "out" },
          { text: `   Region: ${analytics.conversionData.region}`, type: "out" },
        ];
      } else if (command === "difficulty") {
        responseLines = [
          { text: `📊 Current Difficulty: ${difficulty.toUpperCase()}`, type: "info" },
          { text: `   Hint Delay: ${diffSettings.hintDelay}ms`, type: "out" },
          { text: `   Hints Remaining: ${diffSettings.hintCount - hintLevel}`, type: "out" },
          { text: `   Latency: ${latency}ms`, type: "out" },
          { text: `   Commands: ${commandCount}`, type: "out" },
          { text: `   Errors: ${errorCount}`, type: "out" },
        ];
      } else {
        // Unknown command
        const errorType = Math.random();
        if (errorType < 0.3) {
          responseLines = [{ text: REAL_ERRORS.notfound.replace("{cmd}", command), type: "err" }];
        } else if (errorType < 0.5) {
          responseLines = [{ text: REAL_ERRORS.permission, type: "err" }];
        } else if (errorType < 0.7) {
          responseLines = [{ text: REAL_ERRORS.connection, type: "err" }];
        } else {
          responseLines = [{ text: `bash: ${command}: command not found`, type: "err" }];
        }
        setErrorCount(prev => prev + 1);
        analytics.track("command_error", { command, labId: currentLab.id });

        // AI hint after error (if enabled)
        if (diffSettings.showErrorHints && errorCount < 3) {
          setTimeout(() => {
            addLine(`💡 Not sure what to do? Type 'ai help' or 'hint' for guidance.`, "hint");
          }, 1000);
        }
      }

      setLines(prev => [...prev, ...responseLines]);
      setIsProcessing(false);

      // Record command result in invisible guide
      guide.recordCommand(trimmed, responseLines.some(r => r.type === "success" || r.type === "out"), null);
    }, latency + Math.random() * 400);
  }, [currentLabIndex, latency, difficulty, hintLevel, commandCount, errorCount, labStartTime, diffSettings, resetInactivityTimer, addLine, processAiQuestion]);

  // ── Handle Enter key ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !isProcessing) {
      processCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  }, [input, isProcessing, history, historyIndex, processCommand]);

  // ── Go to next lab ─────────────────────────────────────────────────────────
  const goToNextLab = useCallback(() => {
    if (currentLabIndex < LABS.length - 1) {
      setCurrentLabIndex(prev => prev + 1);
      setLines([]);
      setLabCompleted(false);
      setSkillUnlocked(null);
      setShowPaywall(false);
      setHintLevel(0);
      setCommandCount(0);
      setErrorCount(0);
      setInput("");
    }
  }, [currentLabIndex]);

  // ── AI Mentor panel ────────────────────────────────────────────────────────
  const handleAiSend = useCallback(() => {
    if (!aiInput.trim()) return;

    const response = processAiQuestion(aiInput);
    setAiMessages(prev => [...prev, { role: "user", text: aiInput }]);
    setAiMessages(prev => [...prev, { role: "ai", text: response }]);
    setAiInput("");
    analytics.track("ai_mentor_use", { labId: currentLab.id });
  }, [aiInput, currentLab.id, processAiQuestion]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-black rounded-lg overflow-hidden border border-slate-800 relative">
      {/* ── Progress Bar ─────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">{currentLab.title}</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2 py-1 rounded bg-blue-600/20 text-blue-400">
              {difficulty.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500">
              {currentLabIndex + 1} of {LABS.length}
            </span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${((currentLabIndex + (labCompleted ? 1 : 0)) / LABS.length) * 100}%` }}
          />
        </div>
        {skillUnlocked && (
          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
            <span>🏅</span>
            <span>Skill Unlocked: <strong>{skillUnlocked}</strong></span>
          </div>
        )}
      </div>

      {/* ── Terminal Output ──────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-sm cursor-text"
        onClick={handleContainerClick}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={`
              ${line.type === "command" ? "text-white font-semibold" : ""}
              ${line.type === "out" ? "text-green-400" : ""}
              ${line.type === "err" ? "text-red-400" : ""}
              ${line.type === "warn" ? "text-yellow-400" : ""}
              ${line.type === "info" ? "text-blue-400" : ""}
              ${line.type === "success" ? "text-emerald-300 font-bold" : ""}
              ${line.type === "hint" ? "text-slate-500 italic" : ""}
            `}
          >
            {line.text}
          </div>
        ))}

        {isProcessing && (
          <div className="text-slate-500 animate-pulse">Processing...</div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Input Area ───────────────────────────────────────────────────── */}
      <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono text-sm">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              resetInactivityTimer();
            }}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="flex-1 bg-transparent outline-none text-green-400 font-mono text-sm placeholder-slate-600"
            placeholder={isProcessing ? "Processing..." : "Type a command... (try 'ai help' or 'hint')"}
            autoComplete="off"
            spellCheck="false"
            aria-label="Terminal input"
          />
          {!isProcessing && input && (
            <button
              onClick={() => {
                processCommand(input);
                setInput("");
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-colors min-h-[44px]"
              aria-label="Execute command"
            >
              Enter
            </button>
          )}
        </div>
      </div>

      {/* ── Success + Next Lab CTA ───────────────────────────────────────── */}
      {labCompleted && currentLab.nextLab && !showPaywall && (
        <div className="px-4 py-3 border-t border-emerald-600/30 bg-emerald-600/10">
          <button
            onClick={goToNextLab}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors min-h-[44px]"
          >
            Next Lab: {LABS[currentLabIndex + 1]?.title} →
          </button>
        </div>
      )}

      {/* ── Soft Paywall ─────────────────────────────────────────────────── */}
      {showPaywall && (() => {
        const optimized = getOptimizedPaywall();
        analytics.track("paywall_shown", { labId: currentLab.id });
        return (
        <div className="px-4 py-4 border-t border-yellow-600/30 bg-gradient-to-r from-yellow-600/10 to-orange-600/10">
          <p className="text-sm text-yellow-300 mb-3">{optimized.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                analytics.track("upgrade_click", { labId: currentLab.id, region });
                onUpgrade();
              }}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all min-h-[44px]"
            >
              Unlock — {optimized.price} →
            </button>
            {currentLab.nextLab && (
              <button
                onClick={goToNextLab}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors min-h-[44px]"
              >
                Try Next Lab
              </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── AI Mentor Nudge ──────────────────────────────────────────────── */}
      {showAiNudge && !aiMentorOpen && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-br-sm px-4 py-3 max-w-[240px] shadow-xl">
            <p className="text-sm text-white font-medium">Need a hint? 🤔</p>
            <p className="text-xs text-slate-400 mt-0.5">Type 'ai help' or click 💡 below.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setShowAiNudge(false);
                  setInput("ai help");
                  inputRef.current?.focus();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
              >
                Get Hint
              </button>
              <button
                onClick={() => setShowAiNudge(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Mentor Panel (floating) ───────────────────────────────────── */}
      {aiMentorOpen && (
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-slate-900 border-t border-slate-700 flex flex-col z-20">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
            <span className="text-sm font-semibold text-white">🤖 AI Mentor</span>
            <button
              onClick={() => setAiMentorOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {aiMessages.length === 0 && (
              <p className="text-xs text-slate-500 text-center">Ask me anything about this lab!</p>
            )}
            {aiMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 px-3 py-2 flex gap-2">
            <input
              ref={aiInputRef}
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAiSend();
                }
              }}
              className="flex-1 bg-slate-800 text-white text-xs px-3 py-1.5 rounded outline-none"
              placeholder="Ask AI Mentor..."
              aria-label="AI Mentor input"
            />
            <button
              onClick={handleAiSend}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
              disabled={aiLoading}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── AI Mentor Toggle Button ──────────────────────────────────────── */}
      <button
        onClick={() => {
          setAiMentorOpen(!aiMentorOpen);
          setShowAiNudge(false);
        }}
        className="absolute bottom-20 right-4 w-12 h-12 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white text-xl z-30 transition-transform hover:scale-110"
        aria-label="Toggle AI Mentor"
      >
        💡
      </button>

      {/* ── Region Badge ─────────────────────────────────────────────────── */}
      {region !== "GLOBAL" && (
        <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full bg-slate-800/80 text-slate-500">
          {region === "IN" ? "🇮🇳 India" : "🌍 Africa"}
        </div>
      )}

      {/* ── Network Profile Badge ────────────────────────────────────────── */}
      {networkProfile !== "standard" && (
        <div className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-slate-800/80 text-slate-500">
          {networkProfile === "minimal" ? "📶 2G/3G Mode" : "⚡ 4G Mode"}
        </div>
      )}

      {/* ── Invisible Guide Hint ─────────────────────────────────────────── */}
      {invisibleHint && (
        <div className="absolute bottom-24 left-4 right-4 z-30">
          <div className="bg-slate-800/95 border border-slate-700/60 rounded-lg px-4 py-2.5 shadow-lg">
            <p className="text-xs text-slate-300 font-medium">{invisibleHint.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
