import { useEffect, useMemo, useState } from "react";

const baseScore = { tempo: 100, costo: 100, sicurezza: 100, stabilita: 100 };

export function useScenarioEngine(storageKey, definition) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return definition.initialState;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : definition.initialState;
    } catch {
      return definition.initialState;
    }
  });
  const [timeline, setTimeline] = useState(definition.initialTimeline);
  const [startTime] = useState(Date.now());
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, state]);

  const score = useMemo(() => {
    const penalties = state.penalties || { tempo: 0, costo: 0, sicurezza: 0, stabilita: 0 };
    const merged = Object.keys(baseScore).reduce((acc, key) => {
      acc[key] = Math.max(0, baseScore[key] - (penalties[key] || 0));
      return acc;
    }, {});
    const risk = Math.round((400 - Object.values(merged).reduce((a, b) => a + b, 0)) / 4);
    const businessImpact = state.businessImpact || 0;
    return { ...merged, risk, businessImpact };
  }, [state.businessImpact, state.penalties]);

  const elapsedMin = Math.max(1, Math.floor((Date.now() - startTime) / 60000));

  // Adaptive difficulty: increases pressure as score degrades
  const adaptiveDifficulty = useMemo(() => {
    if (score.risk < 15) return { level: "Easy", label: "🟢 Easy", hint: "You're managing well — stay proactive." };
    if (score.risk < 35) return { level: "Medium", label: "🟡 Medium", hint: "Risk is growing — prioritize critical paths." };
    if (score.risk < 60) return { level: "Hard", label: "🟠 Hard", hint: "High risk detected — escalate immediately." };
    return { level: "Critical", label: "🔴 Critical", hint: "Incident out of control — executive notification required." };
  }, [score.risk]);

  // Skill gap detection based on penalty distribution
  const skillGapDetection = useMemo(() => {
    const penalties = state.penalties || {};
    const gaps = [];
    if ((penalties.sicurezza || 0) > 15) gaps.push({ skill: "Security Incident Response", level: "Needs improvement" });
    if ((penalties.costo || 0) > 20) gaps.push({ skill: "Cost Management", level: "Needs improvement" });
    if ((penalties.tempo || 0) > 20) gaps.push({ skill: "Time-to-Resolve", level: "Needs improvement" });
    if ((penalties.stabilita || 0) > 10) gaps.push({ skill: "Infrastructure Stability", level: "Needs improvement" });
    if (gaps.length === 0) gaps.push({ skill: "All competencies", level: "On track" });
    return gaps;
  }, [state.penalties]);

  // Leaderboard score: starts at 500, penalized by risk, impact, time, and actions taken
  const leaderboardScore = Math.max(
    0,
    500 - score.risk * 3 - score.businessImpact / 250 - elapsedMin * 5 - actionCount
  );

  const injectEvent = () => {
    const random = definition.randomEvents[Math.floor(Math.random() * definition.randomEvents.length)];
    if (!random) return;
    setState((prev) => ({
      ...prev,
      penalties: {
        ...prev.penalties,
        ...Object.keys(random.penalty || {}).reduce((acc, key) => {
          acc[key] = (prev.penalties?.[key] || 0) + random.penalty[key];
          return acc;
        }, {}),
      },
      businessImpact: (prev.businessImpact || 0) + (random.businessImpact || 0),
    }));
    setTimeline((log) => [`⚠️ Chaos: ${random.message}`, ...log]);
  };

  const applyDecision = (decision) => {
    setState((prev) => decision.reducer(prev));
    setTimeline((log) => [decision.log, ...log]);
    setActionCount((n) => n + 1);
  };

  return {
    state,
    setState,
    score,
    timeline,
    setTimeline,
    injectEvent,
    applyDecision,
    elapsedMin,
    actionCount,
    adaptiveDifficulty,
    skillGapDetection,
    leaderboardScore,
  };
}
