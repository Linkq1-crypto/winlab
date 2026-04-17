// useChaosEngine.jsx — Chaos engine as a React hook
import { useRef, useCallback, useEffect, useState } from "react";
import {
  ChaosEngine,
  createDefaultChaosEngine,
  createExpertChaosEngine,
  createJuniorChaosEngine,
  createSeniorChaosEngine,
} from "../../realism";

export function useChaosEngine(options = {}) {
  const {
    skill = "mid",
    intensity = 0.3,
    intervalMs = 5000,
    correlated = true,
    autoStart = false,
    onEvent,
  } = options;

  const engineRef = useRef(null);
  const loopRef = useRef(null);
  const runningRef = useRef(false);

  const [events, setEvents] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Initialize engine
  useEffect(() => {
    const config = {
      intensity,
      intervalMs,
      correlated,
      userSkill: skill,
    };

    switch (skill) {
      case "junior":
        engineRef.current = createJuniorChaosEngine(config);
        break;
      case "senior":
        engineRef.current = createSeniorChaosEngine(config);
        break;
      case "expert":
        engineRef.current = createExpertChaosEngine(config);
        break;
      default:
        engineRef.current = createDefaultChaosEngine(config);
    }
  }, [skill, intensity, intervalMs, correlated]);

  // Chaos loop
  const startLoop = useCallback(
    async (env) => {
      if (!engineRef.current || runningRef.current) return;
      runningRef.current = true;
      setIsRunning(true);

      const stopSignal = { stopped: false };
      loopRef.current = engineRef.current.chaosLoop(env, stopSignal);

      // Listen for events
      const checkEvents = () => {
        if (!runningRef.current) return;
        const currentEvents = engineRef.current?.getEventTypes() || [];
        setEvents((prev) => {
          const newEvents = currentEvents.filter(
            (e) => !prev.find((p) => p.type === e.type && p.timestamp > Date.now() - 1000)
          );
          return [...prev, ...newEvents].slice(-100);
        });
        if (onEvent && newEvents.length > 0) {
          onEvent(newEvents);
        }
        setTimeout(checkEvents, intervalMs);
      };

      checkEvents();
    },
    [intervalMs, onEvent]
  );

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
  }, []);

  // Run single chaos event
  const runChaos = useCallback((env) => {
    if (!engineRef.current || !env) return [];
    return engineRef.current.runChaos(env);
  }, []);

  // Force specific incident
  const triggerIncident = useCallback((env, type) => {
    if (!engineRef.current || !env) return;
    engineRef.current.triggerIncident(env, type);
  }, []);

  // Get available types
  const getEventTypes = useCallback(() => {
    return engineRef.current?.getEventTypes() || [];
  }, []);

  // Auto-start
  useEffect(() => {
    if (autoStart) {
      return () => stopLoop();
    }
  }, [autoStart, stopLoop]);

  return {
    events,
    isRunning,
    startLoop,
    stopLoop,
    runChaos,
    triggerIncident,
    getEventTypes,
  };
}
