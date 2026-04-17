// useIncidentRunner.jsx — React hook to run incidents from the library
import { useCallback, useState } from "react";
import {
  ALL_INCIDENTS,
  getIncidentsByCategory,
  getIncidentsByDifficulty,
  getIncidentById,
  IncidentOrchestrator,
  createOrchestrator,
  AIIncidentGenerator,
  createAIIncidentGenerator,
} from "../../realism";

export function useIncidentRunner(options = {}) {
  const {
    autoValidate = true,
    onStageComplete,
    onIncidentComplete,
    onViolation,
  } = options;

  const orchestratorRef = useState(() => createOrchestrator())[0];
  const aiGeneratorRef = useState(() => createAIIncidentGenerator())[0];

  const [activeIncident, setActiveIncident] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);

  // Run a specific incident from the library
  const runIncident = useCallback(
    async (env, incidentId) => {
      const incident = getIncidentById(incidentId);
      if (!incident) throw new Error(`Incident not found: ${incidentId}`);

      setActiveIncident(incident);
      setRunning(true);
      setResult(null);

      const res = await orchestratorRef.runScenario(env, incident);

      setActiveIncident(null);
      setRunning(false);
      setResult(res);

      if (onIncidentComplete) onIncidentComplete(res);
      return res;
    },
    [orchestratorRef, onIncidentComplete]
  );

  // Run a random incident
  const runRandomIncident = useCallback(
    async (env, filters = {}) => {
      let pool = ALL_INCIDENTS;

      if (filters.category) {
        pool = getIncidentsByCategory(filters.category);
      }
      if (filters.difficulty) {
        pool = getIncidentsByDifficulty(filters.difficulty);
      }

      if (pool.length === 0) throw new Error("No incidents match filters");

      const incident = pool[Math.floor(Math.random() * pool.length)];
      return runIncident(env, incident.id);
    },
    [runIncident]
  );

  // Run an AI-generated incident
  const runAIIncident = useCallback(
    async (env, userProfile) => {
      const incident = aiGeneratorRef.generate(userProfile);
      setActiveIncident(incident);
      setRunning(true);
      setResult(null);

      const res = await orchestratorRef.runScenario(env, incident);

      setActiveIncident(null);
      setRunning(false);
      setResult(res);

      if (onIncidentComplete) onIncidentComplete(res);
      return res;
    },
    [orchestratorRef, aiGeneratorRef, onIncidentComplete]
  );

  // Run multiple incidents
  const runMultiple = useCallback(
    async (env, incidentIds, sequential = true) => {
      const incidents = incidentIds
        .map((id) => getIncidentById(id))
        .filter(Boolean);

      if (incidents.length === 0) throw new Error("No valid incidents");

      setRunning(true);
      const results = await orchestratorRef.runMultiple(env, incidents, {
        sequential,
      });
      setRunning(false);

      setResult({ combined: results });
      return results;
    },
    [orchestratorRef]
  );

  // Get all available incidents
  const getLibrary = useCallback(() => {
    return ALL_INCIDENTS.map((i) => ({
      id: i.id,
      category: i.category,
      difficulty: i.difficulty,
      description: i.description,
      rootCauses: i.rootCauses,
      layers: i.layers,
      stageCount: i.stages.length,
    }));
  }, []);

  // Get incident details
  const getIncident = useCallback((id) => {
    return getIncidentById(id);
  }, []);

  return {
    // State
    activeIncident,
    running,
    result,
    currentStage,

    // Actions
    runIncident,
    runRandomIncident,
    runAIIncident,
    runMultiple,
    getLibrary,
    getIncident,

    // Info
    totalIncidents: ALL_INCIDENTS.length,
    categories: ["network", "db", "app", "storage", "auth", "infra"],
  };
}
