// realism/index.ts — Complete exports for the ultimate realism engine

// ─── Core Engine ─────────────────────────────────────────────────────────────
export { exec, execBatch, execAndCompare } from "./engine";
export { parse } from "./parsers";
export type { CommandAST } from "./parsers";
export { Env, createDefaultEnv } from "./state";
export type { Env as EnvType, ServiceState, LogEntry, LogLevel, Service, VirtualFS, NetworkState, RAIDState, StorageState } from "./state";
export { DependencyGraph, createDefaultDependencyGraph } from "./deps";
export { Noise, createDefaultNoise, createTestNoise } from "./noise";
export { emitLog, genLogs, queryLogs, formatLog, rotateLogs } from "./logs";
export { snapshot, diffSnapshots, loadBaseline, saveBaseline, normalize, compareOutputs } from "./snapshots";

// ─── Self-Learning ───────────────────────────────────────────────────────────
export { TelemetryCollector, InMemoryStorage, createCommandTelemetry } from "./telemetry";
export type { CommandTelemetry, SessionTelemetry, RealityTelemetry, TelemetryStorage } from "./telemetry";
export { ClusteringEngine } from "./clustering";
export type { Cluster, BehavioralProfile, ClusterResult } from "./clustering";
export { AnomalyDetector } from "./anomaly";
export type { AnomalyReport, DriftScore, AnomalyConfig } from "./anomaly";
export { IncrementalModel } from "./model";
export type { SimulationModel, ModelUpdate } from "./model";
export { LabGenerator } from "./lab-generator";
export type { GeneratedScenario, GenerationConfig } from "./lab-generator";
export { ProductionMirror, MirrorManager } from "./mirror";
export type { MirrorConfig, MirrorState, IncidentReport } from "./mirror";

// ─── Invariants & Chaos ─────────────────────────────────────────────────────
export { validateInvariants, ALL_INVARIANTS } from "./invariants";
export type { Invariant } from "./invariants";
export { ChaosEngine, createDefaultChaosEngine, createExpertChaosEngine, createJuniorChaosEngine, createSeniorChaosEngine } from "./chaos-engine";
export type { ChaosEvent, ChaosConfig } from "./chaos-engine";

// ─── Incidents ───────────────────────────────────────────────────────────────
export { ALL_INCIDENTS, getIncidentsByCategory, getIncidentsByDifficulty, getIncidentById } from "./incident-library";
export type { Incident, IncidentStage } from "./incident-library";
export { IncidentOrchestrator, createOrchestrator } from "./incident-orchestrator";
export type { IncidentResult } from "./incident-orchestrator";

// ─── AI Incident Generation ─────────────────────────────────────────────────
export { AIIncidentGenerator, createAIIncidentGenerator } from "./ai-incident-generator";
export type { UserProfile, MutatedIncident } from "./ai-incident-generator";
export { LogIncidentPipeline, createLogIncidentPipeline, applyRoot, applyCascade } from "./log-incident-pipeline";
export type { LogInput, ParsedLog, SignalExtraction, RootCauseInference, GeneratedIncident } from "./log-incident-pipeline";

// ─── Senior Simulation & Audit ──────────────────────────────────────────────
export { SeniorSimulator, createSeniorSimulator } from "./senior-simulator";
export type { SimulationResult, Profile, ProfileConfig } from "./senior-simulator";
export { RealityAuditor, createRealityAuditor } from "./reality-audit";
export type { RealityCheck, DriftReport, AuditResult } from "./reality-audit";

// ─── Language & Tone ────────────────────────────────────────────────────────
export { detectLanguage, hasForbiddenPattern, extractStringsFromContent, scanContent, validateLanguage, DEFAULT_EXCLUDED, HINGLISH_HINTS, FORBIDDEN_PATTERNS } from "./language-gate";
export type { LanguageViolation, LanguageCheckResult } from "./language-gate";
export { ToneEnforcer, createToneEnforcer } from "./tone-enforcer";
export type { ToneRule, ToneViolation, ToneResult } from "./tone-enforcer";

// ─── Copy Optimization ──────────────────────────────────────────────────────
export { CopyOptimizer, createCopyOptimizer } from "./copy-optimizer";
export type { CopyType, CopyVariant, OptimizationResult } from "./copy-optimizer";
