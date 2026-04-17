// useRealismEngine.jsx — React hook that bridges the realism engine into the app
import { useRef, useCallback, useEffect, useState } from "react";
import {
  validateInvariants,
  ALL_INVARIANTS,
  ChaosEngine,
  createRealityAuditor,
  createSeniorSimulator,
  createLogIncidentPipeline,
  AIIncidentGenerator,
} from "../../realism";
import { loadTelemetry, getStats, saveTelemetry } from "./telemetry-storage";

export function useRealismEngine() {
  const chaosRef = useRef(null);
  const auditorRef = useRef(null);
  const seniorRef = useRef(null);
  const logPipelineRef = useRef(null);
  const aiRef = useRef(null);
  const runningRef = useRef(false);

  const [auditResult, setAuditResult] = useState(null);
  const [activeAnomalies, setActiveAnomalies] = useState([]);
  const [chaosEvents, setChaosEvents] = useState([]);

  // Initialize engines
  useEffect(() => {
    chaosRef.current = new ChaosEngine({
      intensity: 0.3,
      intervalMs: 5000,
      correlated: true,
      userSkill: "mid",
    });

    auditorRef.current = createRealityAuditor();
    seniorRef.current = createSeniorSimulator();
    logPipelineRef.current = createLogIncidentPipeline();
    aiRef.current = new AIIncidentGenerator();

    return () => {
      runningRef.current = false;
    };
  }, []);

  // Run invariant check against environment
  const checkInvariants = useCallback((env) => {
    if (!env) return { passed: true, violations: [] };
    const violations = ALL_INVARIANTS.filter((inv) => !inv.check(env));
    return {
      passed: violations.length === 0,
      violations,
      checked: ALL_INVARIANTS.length,
    };
  }, []);

  // Run chaos on environment
  const runChaos = useCallback((env) => {
    if (!env || !chaosRef.current) return [];
    const events = chaosRef.current.runChaos(env);
    setChaosEvents((prev) => [...prev, ...events].slice(-50));
    return events;
  }, []);

  // Run senior simulation
  const runSeniorSimulation = useCallback(async (env) => {
    if (!env || !seniorRef.current) return null;
    const result = await seniorRef.current.simulate(env);
    return result;
  }, []);

  // Process logs into an incident
  const processLogs = useCallback((logs) => {
    if (!logs || !logPipelineRef.current) return null;
    return logPipelineRef.current.process({ logs });
  }, []);

  // Generate AI incident for a user
  const generateAIIncident = useCallback((userProfile) => {
    if (!aiRef.current) return null;
    return aiRef.current.generate(userProfile);
  }, []);

  // Run full audit
  const runAudit = useCallback(
    (env, seniorResult) => {
      if (!env || !auditorRef.current) return null;
      const result = auditorRef.current.audit(env, seniorResult);
      setAuditResult(result);
      setActiveAnomalies(
        result.drift.flags.map((f) => ({ flag: f, timestamp: Date.now() }))
      );
      return result;
    },
    []
  );

  // Get telemetry stats
  const telemetryStats = useCallback(() => {
    const telemetry = loadTelemetry();
    return getStats(telemetry);
  }, []);

  // Trigger specific incident
  const triggerIncident = useCallback((env, type) => {
    if (!env || !chaosRef.current) return;
    chaosRef.current.triggerIncident(env, type);
  }, []);

  // Get available event types
  const getChaosEventTypes = useCallback(() => {
    return chaosRef.current?.getEventTypes() || [];
  }, []);

  return {
    // State
    auditResult,
    activeAnomalies,
    chaosEvents,

    // Actions
    checkInvariants,
    runChaos,
    runSeniorSimulation,
    processLogs,
    generateAIIncident,
    runAudit,
    telemetryStats,
    triggerIncident,
    getChaosEventTypes,
  };
}
